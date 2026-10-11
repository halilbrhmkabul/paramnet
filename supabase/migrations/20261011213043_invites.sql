-- F2-01: invites (spec 5.4, 10.1; paramnet-domain security.md).
-- The link carries a 256-bit random token; only sha256(token) is stored and the plain token is
-- returned once by share_agreement. A link grants nothing by itself: deciding needs an OTP to the
-- invite's target number (F2-02) or a signed-in account with that verified number (F2-03).

create table public.invites (
	id uuid primary key default gen_random_uuid(),
	agreement_id uuid not null,
	version int not null,
	token_hash bytea not null unique check (octet_length(token_hash) = 32),
	target_phone_e164 public.phone_tr not null,
	status public.invite_status not null default 'active',
	expires_at timestamptz not null,
	otp_attempts int not null default 0 check (otp_attempts between 0 and 5),
	consumed_at timestamptz,
	created_at timestamptz not null default now(),
	foreign key (agreement_id, version) references public.agreement_versions (agreement_id, version) on delete cascade,
	constraint invites_consumed check ((status = 'consumed') = (consumed_at is not null))
);
create index invites_agreement_id_idx on public.invites (agreement_id, version);
create index invites_active_expiry_idx on public.invites (expires_at) where status = 'active';

-- Server only: no grants, no policies (ADR-020 defaults keep it closed).
alter table public.invites enable row level security;

-- Whether a signed-in user is a party who may see the agreement. Null-safe: an unshared agreement has
-- no counterparty_profile_id, and `not (… or null)` would let the visibility check fall through.
create function private.is_party(p_agreement public.agreements, p_uid uuid) returns boolean
language sql
stable
set search_path = ''
as $$
	select p_agreement.creator_id = p_uid
		or (p_agreement.counterparty_profile_id is not distinct from p_uid and p_agreement.status <> 'personal');
$$;

-- Fix for F1-14: a stranger acting on a shared-but-unaccepted agreement got "forbidden" (revealing
-- that it exists) instead of "not_found", because of the null comparison above.
create or replace function private.lock_personal_agreement(p_agreement_id uuid, p_row_version int)
returns public.agreements
language plpgsql
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
	v_ag public.agreements;
begin
	if v_uid is null then
		raise exception 'not_authenticated' using errcode = '28000';
	end if;
	select * into v_ag from public.agreements where id = p_agreement_id for update;
	-- Someone who cannot see the agreement must not learn that it exists.
	if not found or not private.is_party(v_ag, v_uid) then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if v_ag.creator_id <> v_uid then
		raise exception using message = 'forbidden', errcode = 'P0001';
	end if;
	if v_ag.status <> 'personal' then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if v_ag.row_version <> p_row_version then
		raise exception using message = 'conflict', errcode = 'P0001';
	end if;
	return v_ag;
end;
$$;

-- Locks an agreement the caller created, for the creator-only sharing actions.
create function private.lock_own_agreement(p_agreement_id uuid) returns public.agreements
language plpgsql
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
	v_ag public.agreements;
begin
	if v_uid is null then
		raise exception 'not_authenticated' using errcode = '28000';
	end if;
	select * into v_ag from public.agreements where id = p_agreement_id for update;
	if not found or not private.is_party(v_ag, v_uid) then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if v_ag.creator_id <> v_uid then
		raise exception using message = 'forbidden', errcode = 'P0001';
	end if;
	return v_ag;
end;
$$;

-- share_agreement: personal → pending ----------------------------------------------------------------

create function public.share_agreement(p_id uuid, p_phone text, p_row_version int) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_ag public.agreements;
	v_phone public.phone_tr;
	v_me public.profiles;
	v_contact public.contacts;
	v_token text;
	v_expires timestamptz := now() + interval '7 days';
begin
	v_ag := private.lock_own_agreement(p_id);
	if v_ag.status <> 'personal' then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if v_ag.row_version <> p_row_version then
		raise exception using message = 'conflict', errcode = 'P0001';
	end if;

	-- Same normalisation as the app (normalizePhoneTR): spaces, dashes, leading 0 / 90 / +90.
	begin
		v_phone := '+90' || substring(regexp_replace(coalesce(p_phone, ''), '[\s().-]', '', 'g') from '^(?:\+90|90|0)?(5[0-9]{9})$');
	exception when check_violation then
		v_phone := null;
	end;
	if v_phone is null then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'phone';
	end if;
	select * into v_me from public.profiles where id = v_ag.creator_id;
	if v_phone = v_me.phone_e164 then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'self';
	end if;

	-- The contact keeps the number the agreement was shared with.
	select * into v_contact from public.contacts where id = v_ag.counterparty_contact_id;
	if v_contact.phone_e164 is null then
		begin
			update public.contacts
			set phone_e164 = v_phone, linked_profile_id = (select id from public.profiles where phone_e164 = v_phone)
			where id = v_contact.id;
		exception when unique_violation then
			-- Another contact of mine already has this number; the invite still goes to it.
			null;
		end;
	end if;

	v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
	insert into public.invites (agreement_id, version, token_hash, target_phone_e164, expires_at)
	values (p_id, v_ag.active_version, sha256(convert_to(v_token, 'UTF8')), v_phone, v_expires);

	update public.agreements
	set status = 'pending', pending_version = active_version, row_version = row_version + 1
	where id = p_id;
	insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
	values (p_id, v_ag.creator_id, 'app', 'shared', v_ag.active_version);

	-- The only time the plain token exists outside the creator's share sheet.
	return jsonb_build_object('token', v_token, 'expires_at', v_expires);
end;
$$;

-- withdraw_share: pending / countered → personal -------------------------------------------------------

create function public.withdraw_share(p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_ag public.agreements;
begin
	v_ag := private.lock_own_agreement(p_id);
	if v_ag.status not in ('pending', 'countered') then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	update public.invites set status = 'revoked' where agreement_id = p_id and status = 'active';
	update public.agreements
	set status = 'personal', pending_version = null, row_version = row_version + 1
	where id = p_id;
	insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
	values (p_id, v_ag.creator_id, 'app', 'share_withdrawn', v_ag.active_version);
	return jsonb_build_object('status', 'personal');
end;
$$;

-- Expiry (7 days) ------------------------------------------------------------------------------------

create function private.expire_invites(p_now timestamptz default now()) returns int
language plpgsql
set search_path = ''
as $$
declare
	v_count int;
begin
	with expired as (
		update public.invites set status = 'expired'
		where status = 'active' and expires_at <= p_now
		returning agreement_id, version
	),
	reverted as (
		update public.agreements a
		set status = 'personal', pending_version = null, row_version = a.row_version + 1
		from expired e
		where a.id = e.agreement_id and a.status = 'pending'
		returning a.id, e.version
	)
	insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
	select id, null, 'system', 'invite_expired', version from reverted;
	get diagnostics v_count = row_count;
	return v_count;
end;
$$;

select cron.schedule('expire-invites', '7 * * * *', $$select private.expire_invites(now())$$);

-- Grants ---------------------------------------------------------------------------------------------

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_agreement(uuid) to authenticated;

revoke all on function public.share_agreement(uuid, text, int) from public, anon;
revoke all on function public.withdraw_share(uuid) from public, anon;
grant execute on function public.share_agreement(uuid, text, int) to authenticated;
grant execute on function public.withdraw_share(uuid) to authenticated;
