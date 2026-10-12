-- F3-03: data export and account deletion (spec 12 "Silme hakkı", spec 16/10, security.md, ADR-039).
-- Deleting an account erases what only that person has and anonymises their traces in agreements
-- someone else is party to; the other side keeps the agreement and its history ("Silinmiş kullanıcı").

-- A deleted profile keeps its id (history points at it) but no number.
alter table public.profiles alter column phone_e164 drop not null;
alter table public.profiles add constraint profiles_deleted_phone check ((deleted_at is null) = (phone_e164 is not null));

-- BR-13: the history is append only, except for the erasure of an account (KVKK). erase_account opens
-- this door for its own transaction only.
create or replace function public.reject_change() returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if current_setting('paramnet.erasure', true) = 'on' then
		return case when tg_op = 'DELETE' then old else new end;
	end if;
	raise exception '% on %.% is not allowed (append only)', tg_op, tg_table_schema, tg_table_name
		using errcode = 'P0001';
end;
$$;

create or replace function public.guard_agreement_version_update() returns trigger
language plpgsql
set search_path = ''
as $$
begin
	-- Erasure may remove the reason someone wrote; the approved terms never change.
	if new.agreement_id is distinct from old.agreement_id
		or new.version is distinct from old.version
		or new.terms is distinct from old.terms
		or new.terms_hash is distinct from old.terms_hash
		or new.proposed_by is distinct from old.proposed_by
		or (new.reason is distinct from old.reason and not (current_setting('paramnet.erasure', true) = 'on' and new.reason is null))
		or new.created_at is distinct from old.created_at then
		raise exception 'agreement version terms are immutable' using errcode = 'P0001';
	end if;
	return new;
end;
$$;

-- Account deletion ---------------------------------------------------------------------------------------

-- Service role only: the delete-account edge function calls it for the signed-in user, then soft-deletes
-- the auth user. Idempotent.
create function public.delete_account_data(p_uid uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_phone text;
	v_deleted int;
	v_kept int;
begin
	if not exists (select 1 from public.profiles where id = p_uid) then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	select phone_e164 into v_phone from public.profiles where id = p_uid;
	perform set_config('paramnet.erasure', 'on', true);

	-- Agreements no other account is party to are only this person's data.
	delete from public.agreements where creator_id = p_uid and counterparty_profile_id is null;
	get diagnostics v_deleted = row_count;
	select count(*) into v_kept from public.agreements where creator_id = p_uid or counterparty_profile_id = p_uid;

	-- Their address book: entries still behind a kept agreement lose name and number.
	delete from public.contacts c
	where c.owner_id = p_uid and not exists (select 1 from public.agreements a where a.counterparty_contact_id = c.id);
	update public.contacts set display_name = 'Silinmiş kişi', phone_e164 = null, linked_profile_id = null
	where owner_id = p_uid;
	-- Other people's contacts keep what they typed, but no longer point at this account.
	update public.contacts set linked_profile_id = null where linked_profile_id = p_uid;

	-- Their words and traces inside kept agreements; amounts, dates and statuses stay for the other side.
	update public.agreement_events set actor_phone_e164 = null, ip_hash = null, user_agent = null
	where actor_id = p_uid or (v_phone is not null and actor_phone_e164 = v_phone);
	update public.payments set note = null, attachment_path = null where reported_by = p_uid;
	update public.agreement_versions set reason = null where proposed_by = p_uid and reason is not null;
	update public.disputes set reason = '—' where opened_by = p_uid;
	update public.analytics_events set user_id = null where user_id = p_uid;

	delete from public.push_tokens where user_id = p_uid;
	delete from public.reminders where user_id = p_uid;
	delete from public.notification_outbox where user_id = p_uid;
	delete from public.consents where user_id = p_uid;
	delete from public.rate_limits where key like '%' || p_uid::text || '%';

	update public.profiles
	set display_name = 'Silinmiş kullanıcı', phone_e164 = null, deleted_at = coalesce(deleted_at, now())
	where id = p_uid;

	perform set_config('paramnet.erasure', 'off', true);
	return jsonb_build_object('deleted_agreements', v_deleted, 'kept_agreements', v_kept);
end;
$$;

-- Data export (KVKK m.11) ---------------------------------------------------------------------------------

-- Everything the app keeps about the signed-in user, in the same shape the app reads it.
create function public.export_my_data() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
begin
	return jsonb_build_object(
		'exported_at', now(),
		'profile', (
			select jsonb_build_object('id', p.id, 'display_name', p.display_name, 'phone_e164', p.phone_e164,
				'locale', p.locale, 'timezone', p.timezone, 'created_at', p.created_at)
			from public.profiles p where p.id = v_uid
		),
		'consents', (
			select coalesce(jsonb_agg(jsonb_build_object('document', c.document, 'version', c.version, 'accepted_at', c.accepted_at)
				order by c.accepted_at), '[]'::jsonb)
			from public.consents c where c.user_id = v_uid
		),
		'contacts', (
			select coalesce(jsonb_agg(jsonb_build_object('display_name', c.display_name, 'phone_e164', c.phone_e164,
				'kind', c.kind, 'created_at', c.created_at) order by c.created_at), '[]'::jsonb)
			from public.contacts c where c.owner_id = v_uid
		),
		'agreements', (
			select coalesce(jsonb_agg(public.get_agreement_detail(a.id) order by a.created_at), '[]'::jsonb)
			from public.agreements a
			where a.creator_id = v_uid or (a.counterparty_profile_id = v_uid and a.status <> 'personal')
		),
		'devices', (
			select coalesce(jsonb_agg(jsonb_build_object('platform', t.platform, 'last_seen_at', t.last_seen_at)), '[]'::jsonb)
			from public.push_tokens t where t.user_id = v_uid
		),
		'analytics_events', (
			select coalesce(jsonb_agg(jsonb_build_object('name', e.name, 'props', e.props, 'created_at', e.created_at)
				order by e.created_at), '[]'::jsonb)
			from public.analytics_events e where e.user_id = v_uid
		)
	);
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_agreement(uuid) to authenticated;

revoke all on function public.delete_account_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_account_data(uuid) to service_role;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
