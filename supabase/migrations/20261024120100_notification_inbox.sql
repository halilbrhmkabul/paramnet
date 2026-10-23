-- F4-02a: notification inbox (design 06) and the before-due reminder preference (ADR-051).

-- Inbox ----------------------------------------------------------------------------------------------------

create table public.notifications (
	id bigint generated always as identity primary key,
	user_id uuid not null references public.profiles (id) on delete cascade,
	template text not null check (char_length(template) <= 50),
	payload jsonb not null default '{}'::jsonb,
	-- No foreign key: an erased account deletes its personal agreements, the inbox row may outlive them.
	agreement_id uuid,
	category text not null check (category in ('approval', 'reminder', 'completed', 'info')),
	read_at timestamptz,
	created_at timestamptz not null default now()
);
create index notifications_user_id_idx on public.notifications (user_id, id desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_created_at_idx on public.notifications (created_at);
-- Server only: read through list_notifications.
alter table public.notifications enable row level security;

-- The design's filters: "Onay gereken", "Hatırlatmalar", "Tamamlanan"; everything else is plain news.
create function private.notification_category(p_template text) returns text
language sql
immutable
set search_path = ''
as $$
	select case
		when p_template in ('shareReceived', 'shareCountered', 'paymentReported', 'paymentPending', 'amendmentProposed', 'cancelRequested')
			then 'approval'
		when p_template in ('dueSoon', 'dueToday', 'overdue1', 'overdue7') then 'reminder'
		when p_template in ('paymentConfirmed', 'paymentRecorded', 'amendmentAccepted', 'cancelAccepted', 'settled',
			'shareAccepted', 'counterAccepted', 'forgiven', 'disputeResolved') then 'completed'
		else 'info'
	end;
$$;

-- Every push also lands in the inbox: the outbox is the one place all notices pass through (RPCs, the event
-- trigger and both reminder jobs).
create function private.outbox_to_inbox() returns trigger
language plpgsql
set search_path = ''
as $$
begin
	insert into public.notifications (user_id, template, payload, agreement_id, category)
	values (
		new.user_id, new.template, new.payload,
		case when new.payload ->> 'agreement_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
			then (new.payload ->> 'agreement_id')::uuid end,
		private.notification_category(new.template)
	);
	return null;
end;
$$;

create trigger notification_outbox_to_inbox
	after insert on public.notification_outbox
	for each row execute function private.outbox_to_inbox();

-- Newest first, paged by id (rows written in one transaction share a timestamp). The approval count comes from
-- what is still waiting for me, so a decided request does not keep the badge up.
create function public.list_notifications(p_category text, p_before_id bigint, p_limit int) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_limit int := coalesce(p_limit, 50);
begin
	if p_category is not null and p_category not in ('approval', 'reminder', 'completed', 'info') then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'category';
	end if;
	if v_limit not between 1 and 100 then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'limit';
	end if;
	return jsonb_build_object(
		'items', (
			select coalesce(jsonb_agg(jsonb_build_object(
				'id', n.id, 'template', n.template, 'category', n.category, 'payload', n.payload,
				'agreement_id', n.agreement_id, 'created_at', n.created_at, 'read_at', n.read_at
			) order by n.id desc), '[]'::jsonb)
			from (
				select * from public.notifications
				where user_id = v_uid
					and (p_category is null or category = p_category)
					and (p_before_id is null or id < p_before_id)
				order by id desc
				limit v_limit
			) n
		),
		'unread_count', (select count(*) from public.notifications where user_id = v_uid and read_at is null),
		'approval_count', jsonb_array_length(public.list_requests())
	);
end;
$$;

-- null marks everything read ("Tümünü okundu işaretle").
create function public.mark_notifications_read(p_ids bigint[]) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_count int;
begin
	update public.notifications set read_at = now()
	where user_id = v_uid and read_at is null and (p_ids is null or id = any (p_ids));
	get diagnostics v_count = row_count;
	return jsonb_build_object('marked', v_count);
end;
$$;

create function private.purge_notifications(p_now timestamptz default now()) returns int
language plpgsql
set search_path = ''
as $$
declare
	v_count int;
begin
	delete from public.notifications where created_at < p_now - interval '90 days';
	get diagnostics v_count = row_count;
	return v_count;
end;
$$;

select cron.schedule('purge-notifications', '23 3 * * *', $$select private.purge_notifications(now())$$);

-- Before-due reminder preference ----------------------------------------------------------------------------

create function public.set_reminder_prefs(p_days int[]) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_days int[];
begin
	if p_days is null or not (p_days <@ array[7, 3, 1, 0]) or array_position(p_days, null) is not null then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'reminder_before_days';
	end if;
	select coalesce(array_agg(d order by d desc), '{}') into v_days from (select distinct unnest(p_days) as d) s;
	update public.profiles set reminder_before_days = v_days where id = private.require_uid();
	return jsonb_build_object('reminder_before_days', to_jsonb(v_days));
end;
$$;

-- Spec 5.9 with the preference: who gets what, relative to the due date, always at 10:00 Europe/Istanbul.
--   dueSoon  −7 / −3 / −1 days  debtor, if chosen (default: −3)
--   dueToday  0                 debtor and creditor, if chosen (default: yes)
--   overdue1 +1 day             debtor (only while unpaid)
--   overdue7 +7 days            debtor and creditor
-- Nothing is queued in quiet hours (22:00–09:00); a missed slot is not sent later than 22:00 that day,
-- so a record created after its dates never fires a burst of stale reminders.
create or replace function private.enqueue_due_reminders(p_now timestamptz default now()) returns int
language plpgsql
set search_path = ''
as $$
declare
	v_local_hour int := extract(hour from p_now at time zone 'Europe/Istanbul');
	v_count int;
begin
	if v_local_hour < 9 or v_local_hour >= 22 then
		return 0;
	end if;

	with recipients as (
		-- The creator always; the counterparty once the agreement is shared.
		select a.id as agreement_id, a.creator_id as user_id, a.creator_role as role
		from public.agreements a
		where a.status in ('personal', 'active', 'amendment_pending')
		union all
		select a.id, a.counterparty_profile_id,
			case when a.creator_role = 'creditor' then 'debtor'::public.party_role else 'creditor'::public.party_role end
		from public.agreements a
		where a.status in ('active', 'amendment_pending') and a.counterparty_profile_id is not null
	),
	-- reminders.kind is snake_case; the outbox template is the copy key (copy-tr.md notif.*). due_soon keeps its
	-- name for −3 so reminders already sent are not sent again.
	kinds (kind, template, day_offset, debtor_only, pref_day) as (
		values ('due_before_7', 'dueSoon', -7, true, 7), ('due_soon', 'dueSoon', -3, true, 3),
			('due_before_1', 'dueSoon', -1, true, 1), ('due_today', 'dueToday', 0, false, 0),
			('overdue_1', 'overdue1', 1, true, null::int), ('overdue_7', 'overdue7', 7, false, null::int)
	),
	candidates as (
		select r.agreement_id, r.user_id, i.id as installment_id, k.kind, k.template,
			((i.due_date + k.day_offset) + time '10:00') at time zone 'Europe/Istanbul' as fire_at,
			jsonb_build_object(
				'agreement_id', a.id,
				'name', private.counterparty_of(a, r.user_id) ->> 'display_name',
				'amount_minor', i.amount_minor - i.paid_minor,
				'due_date', i.due_date,
				'seq', i.seq,
				'count', (select count(*) from public.installments x where x.agreement_id = a.id and x.version = a.active_version)
			) as payload
		from recipients r
		join public.agreements a on a.id = r.agreement_id
		join public.profiles pr on pr.id = r.user_id
		join public.installments i on i.agreement_id = a.id and i.version = a.active_version
		cross join kinds k
		where i.due_date is not null
			and i.paid_minor < i.amount_minor
			and (not k.debtor_only or r.role = 'debtor')
			and (k.pref_day is null or k.pref_day = any (pr.reminder_before_days))
	),
	due as (
		select * from candidates c
		where p_now >= c.fire_at and p_now < c.fire_at + interval '12 hours'
	),
	inserted as (
		insert into public.reminders (agreement_id, installment_id, user_id, fire_at, kind, status)
		select agreement_id, installment_id, user_id, fire_at, kind, 'sent' from due
		on conflict (installment_id, user_id, kind) where installment_id is not null do nothing
		returning installment_id, user_id, kind
	)
	insert into public.notification_outbox (user_id, template, payload)
	select d.user_id, d.template, d.payload
	from inserted ins
	join due d on d.installment_id = ins.installment_id and d.user_id = ins.user_id and d.kind = ins.kind
	order by d.fire_at, d.installment_id;

	get diagnostics v_count = row_count;
	return v_count;
end;
$$;

-- Account deletion and export cover the new fields (ADR-039, ADR-050, ADR-051) ----------------------------

create or replace function public.delete_account_data(p_uid uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_phone text;
	v_avatar text;
	v_paramnet_id text;
	v_deleted int;
	v_kept int;
begin
	if not exists (select 1 from public.profiles where id = p_uid) then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	select phone_e164, avatar_path, paramnet_id into v_phone, v_avatar, v_paramnet_id from public.profiles where id = p_uid;
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

	-- Plans shared to this account by ID can no longer be decided; the expiry job returns them to their creators.
	update public.invites set expires_at = now() where target_profile_id = p_uid and status = 'active';

	delete from public.push_tokens where user_id = p_uid;
	delete from public.reminders where user_id = p_uid;
	delete from public.notification_outbox where user_id = p_uid;
	delete from public.notifications where user_id = p_uid;
	delete from public.consents where user_id = p_uid;
	delete from public.rate_limits where key like '%' || p_uid::text || '%';

	if v_paramnet_id is not null then
		insert into public.retired_paramnet_ids (paramnet_id) values (v_paramnet_id) on conflict do nothing;
	end if;
	update public.profiles
	set display_name = 'Silinmiş kullanıcı', phone_e164 = null, deleted_at = coalesce(deleted_at, now()),
		first_name = null, last_name = null, username = null, avatar_path = null, paramnet_id = null, id_discoverable = false
	where id = p_uid;

	perform set_config('paramnet.erasure', 'off', true);
	-- The photo file is removed by the delete-account edge function through the Storage API.
	return jsonb_build_object('deleted_agreements', v_deleted, 'kept_agreements', v_kept, 'avatar_path', v_avatar);
end;
$$;

create or replace function public.export_my_data() returns jsonb
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
			select jsonb_build_object('id', p.id, 'display_name', p.display_name, 'first_name', p.first_name,
				'last_name', p.last_name, 'username', p.username, 'phone_e164', p.phone_e164, 'paramnet_id', p.paramnet_id,
				'id_discoverable', p.id_discoverable, 'avatar_path', p.avatar_path, 'reminder_before_days', to_jsonb(p.reminder_before_days),
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
		'notifications', (
			select coalesce(jsonb_agg(jsonb_build_object('template', n.template, 'payload', n.payload,
				'created_at', n.created_at, 'read_at', n.read_at) order by n.id), '[]'::jsonb)
			from public.notifications n where n.user_id = v_uid
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

-- Grants ---------------------------------------------------------------------------------------------------

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_agreement(uuid) to authenticated;
grant execute on function private.avatar_visible(text) to authenticated;

revoke all on function public.list_notifications(text, bigint, int) from public, anon;
revoke all on function public.mark_notifications_read(bigint[]) from public, anon;
revoke all on function public.set_reminder_prefs(int[]) from public, anon;
grant execute on function public.list_notifications(text, bigint, int) to authenticated;
grant execute on function public.mark_notifications_read(bigint[]) to authenticated;
grant execute on function public.set_reminder_prefs(int[]) to authenticated;
