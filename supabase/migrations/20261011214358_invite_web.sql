-- F2-02: web confirmation backend (spec 5.4, 11.2; paramnet-domain security.md).
-- The edge functions (invite-open, invite-otp-send, invite-otp-verify, invite-decide) are thin; the
-- rules live here in service-role-only RPCs so they are tested with pgTAP.

alter table public.invites
	add column otp_hash bytea,
	add column otp_expires_at timestamptz,
	add column otp_last_sent_at timestamptz;

-- Rate limit counters (SMS pumping, spec 11.2). Server only.
create table public.rate_limits (
	key text not null check (char_length(key) <= 200),
	window_start timestamptz not null,
	count int not null default 0 check (count >= 0),
	created_at timestamptz not null default now(),
	primary key (key, window_start)
);
alter table public.rate_limits enable row level security;

-- Counts one hit in a fixed window; false when the limit is already reached.
create function private.take_rate_limit(p_key text, p_window interval, p_max int) returns boolean
language plpgsql
set search_path = ''
as $$
declare
	v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / extract(epoch from p_window)) * extract(epoch from p_window));
	v_count int;
begin
	insert into public.rate_limits (key, window_start, count) values (p_key, v_start, 1)
	on conflict (key, window_start) do update set count = public.rate_limits.count + 1
	returning count into v_count;
	return v_count <= p_max;
end;
$$;

create function private.normalize_phone_tr(p_input text) returns text
language sql
stable
set search_path = ''
as $$
	-- Same rule as packages/shared normalizePhoneTR.
	select '+90' || substring(regexp_replace(coalesce(p_input, ''), '[\s().-]', '', 'g') from '^(?:\+90|90|0)?(5[0-9]{9})$');
$$;

create function private.invite_by_token(p_token text) returns public.invites
language sql
stable
set search_path = ''
as $$
	select * from public.invites where token_hash = sha256(convert_to(coalesce(p_token, ''), 'UTF8'));
$$;

-- Effective status: an active invite past its expiry is reported as expired before the cron runs.
create function private.invite_status_now(p_invite public.invites) returns text
language sql
stable
set search_path = ''
as $$
	select case when p_invite.status = 'active' and p_invite.expires_at <= now() then 'expired' else p_invite.status::text end;
$$;

-- Decision core shared by the app (decide_agreement) and the web (invite_decide) -------------------------

create function private.apply_decision(
	p_agreement public.agreements,
	p_invite_id uuid,
	p_actor_id uuid,
	p_actor_phone text,
	p_link_profile uuid,
	p_channel public.event_channel,
	p_version int,
	p_terms_hash text,
	p_decision text,
	p_counter_terms jsonb,
	p_ip_hash text,
	p_user_agent text
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
	v_version int;
	v_status public.agreement_status;
	v_type text;
begin
	if p_agreement.status <> 'pending' then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if p_decision is null or p_decision not in ('accept', 'counter', 'reject') then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'decision';
	end if;
	perform private.check_decision_terms(p_agreement, p_version, p_terms_hash);

	case p_decision
		when 'accept' then
			update public.agreements set counterparty_profile_id = coalesce(p_link_profile, counterparty_profile_id)
			where id = p_agreement.id;
			perform private.activate_version(p_agreement, p_version);
			v_version := p_version;
			v_type := 'accepted';
		when 'counter' then
			-- A creator's counter offer that is answered with another one is rejected.
			update public.agreement_versions set status = 'rejected'
			where agreement_id = p_agreement.id and version = p_version and status = 'proposed';
			v_version := private.add_proposal(
				p_agreement, private.proposal_terms(p_agreement, p_counter_terms), coalesce(p_actor_id, p_agreement.creator_id)
			);
			update public.agreements
			set status = 'countered', pending_version = v_version,
				counterparty_profile_id = coalesce(p_link_profile, counterparty_profile_id)
			where id = p_agreement.id;
			v_type := 'countered';
		else
			update public.agreement_versions set status = 'rejected'
			where agreement_id = p_agreement.id and version = p_version and status = 'proposed';
			-- "Bu plan bana ait değil": a rejection never links an account to the agreement.
			update public.agreements set status = 'rejected', pending_version = null where id = p_agreement.id;
			v_version := p_version;
			v_type := 'rejected';
	end case;

	update public.invites set status = 'consumed', consumed_at = now()
	where id = p_invite_id and status = 'active';
	update public.agreements set row_version = row_version + 1 where id = p_agreement.id returning status into v_status;
	insert into public.agreement_events (agreement_id, actor_id, actor_phone_e164, channel, type, version, ip_hash, user_agent)
	values (p_agreement.id, p_actor_id, p_actor_phone, p_channel, v_type, v_version, p_ip_hash, left(p_user_agent, 200));
	return jsonb_build_object('status', v_status, 'version', v_version);
end;
$$;

-- The in-app path now uses the same core (behaviour unchanged, 090_decisions.test.sql).
create or replace function public.decide_agreement(
	p_id uuid,
	p_version int,
	p_terms_hash text,
	p_decision text,
	p_counter_terms jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
	v_me public.profiles;
	v_ag public.agreements;
	v_invite public.invites;
begin
	if v_uid is null then
		raise exception 'not_authenticated' using errcode = '28000';
	end if;
	select * into v_me from public.profiles where id = v_uid;
	select * into v_ag from public.agreements where id = p_id for update;
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if v_ag.creator_id = v_uid then
		raise exception using message = 'forbidden', errcode = 'P0001';
	end if;
	select * into v_invite from public.invites
	where agreement_id = p_id and status = 'active' and expires_at > now()
	order by created_at desc
	limit 1;
	-- The counterparty is either already linked, or proves it with the verified number of their account,
	-- which must be the number the invite was sent to (BR-11).
	if not (
		v_ag.counterparty_profile_id is not distinct from v_uid
		or (v_ag.counterparty_profile_id is null and v_invite.id is not null and v_invite.target_phone_e164 = v_me.phone_e164)
	) or v_ag.status = 'personal' then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	return private.apply_decision(
		v_ag, v_invite.id, v_uid, v_me.phone_e164,
		case when p_decision = 'reject' then null else v_uid end,
		'app', p_version, p_terms_hash, p_decision, p_counter_terms, null, null
	);
end;
$$;

-- Service-role RPCs for the edge functions --------------------------------------------------------------

-- invite-open (GET): only the creator's name before OTP; never changes state.
create function public.invite_open(p_token text) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_invite public.invites := private.invite_by_token(p_token);
begin
	if v_invite.id is null then
		return jsonb_build_object('status', 'invalid');
	end if;
	return jsonb_build_object(
		'status', private.invite_status_now(v_invite),
		'creator_name', (select p.display_name from public.agreements a join public.profiles p on p.id = a.creator_id where a.id = v_invite.agreement_id)
	);
end;
$$;

-- invite-otp-send: stores the hash of a code generated by the edge function. A number other than the
-- invite's target gets the same answer shape but no code, so the target cannot be probed; its
-- verification attempts still count towards the lock.
create function public.invite_send_otp(p_token text, p_phone text, p_code text, p_ip_hash text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_invite public.invites := private.invite_by_token(p_token);
	v_phone text := private.normalize_phone_tr(p_phone);
begin
	if v_invite.id is null or private.invite_status_now(v_invite) <> 'active' then
		raise exception using message = 'invite_unavailable', errcode = 'P0001';
	end if;
	if v_phone is null then
		raise exception using message = 'invalid_phone', errcode = 'P0001';
	end if;
	if p_code is null or p_code !~ '^[0-9]{6}$' then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'code';
	end if;
	-- The 60 s resend wait applies to the real target only, so someone trying other numbers cannot
	-- delay the invitee; those tries are capped by the IP and number windows instead.
	if (v_phone = v_invite.target_phone_e164 and v_invite.otp_last_sent_at > now() - interval '60 seconds')
		or not private.take_rate_limit('otp:ip:' || coalesce(p_ip_hash, ''), interval '1 hour', 10)
		or not private.take_rate_limit('otp:phone:' || v_phone, interval '1 hour', 5) then
		raise exception using message = 'rate_limited', errcode = 'P0001';
	end if;

	if v_phone <> v_invite.target_phone_e164 then
		return jsonb_build_object('send', false);
	end if;
	update public.invites
	set otp_hash = sha256(convert_to(v_invite.id::text || ':' || p_code, 'UTF8')),
		otp_expires_at = now() + interval '5 minutes',
		otp_last_sent_at = now()
	where id = v_invite.id;
	return jsonb_build_object('send', true, 'phone', v_phone);
end;
$$;

-- invite-otp-verify: returns { ok, ... } instead of raising so a failed attempt is committed.
-- Five failed attempts lock the invite (spec 11.2).
create function public.invite_verify_otp(p_token text, p_phone text, p_code text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_invite public.invites := private.invite_by_token(p_token);
	v_phone text := private.normalize_phone_tr(p_phone);
	v_attempts int;
begin
	if v_invite.id is null or private.invite_status_now(v_invite) <> 'active' then
		return jsonb_build_object('ok', false, 'error', 'invite_unavailable');
	end if;
	if v_phone is not distinct from v_invite.target_phone_e164
		and v_invite.otp_hash is not null
		and v_invite.otp_expires_at > now()
		and v_invite.otp_hash = sha256(convert_to(v_invite.id::text || ':' || coalesce(p_code, ''), 'UTF8')) then
		update public.invites set otp_hash = null, otp_expires_at = null where id = v_invite.id;
		return jsonb_build_object('ok', true, 'invite_id', v_invite.id, 'phone', v_phone);
	end if;

	update public.invites
	set otp_attempts = least(otp_attempts + 1, 5),
		status = case when otp_attempts + 1 >= 5 then 'locked'::public.invite_status else status end
	where id = v_invite.id
	returning otp_attempts into v_attempts;
	return jsonb_build_object('ok', false, 'error', case when v_attempts >= 5 then 'locked' else 'otp_invalid' end);
end;
$$;

-- W03: what the invitee decides on, from their side. Only after OTP (the edge function checks the
-- signed approval session before calling this).
create function public.invite_details(p_invite_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_invite public.invites;
	v_ag public.agreements;
	v_version public.agreement_versions;
begin
	select * into v_invite from public.invites where id = p_invite_id;
	if not found or private.invite_status_now(v_invite) <> 'active' then
		raise exception using message = 'invite_unavailable', errcode = 'P0001';
	end if;
	select * into v_ag from public.agreements where id = v_invite.agreement_id;
	select * into v_version from public.agreement_versions where agreement_id = v_ag.id and version = v_ag.pending_version;
	return jsonb_build_object(
		'creator_name', (select display_name from public.profiles where id = v_ag.creator_id),
		'title', v_ag.title,
		'kind', v_ag.kind,
		'my_role', case when v_ag.creator_role = 'creditor' then 'debtor' else 'creditor' end,
		'version', v_version.version,
		'terms_hash', v_version.terms_hash,
		'principal_minor', (v_version.terms ->> 'principal_minor')::bigint,
		'down_payment_minor', (v_version.terms ->> 'down_payment_minor')::bigint,
		'notes', v_version.terms -> 'notes',
		'plan', v_version.terms -> 'plan',
		-- Payments recorded before sharing are listed as "not yet verified by the other side" (spec 5.3).
		'payments', (
			select coalesce(jsonb_agg(jsonb_build_object('amount_minor', p.amount_minor, 'paid_on', p.paid_on, 'kind', p.kind) order by p.paid_on, p.created_at), '[]'::jsonb)
			from public.payments p where p.agreement_id = v_ag.id and p.status = 'confirmed'
		)
	);
end;
$$;

-- invite-decide: the approval session proves the number; the decision runs through the shared core.
create function public.invite_decide(
	p_invite_id uuid,
	p_phone text,
	p_version int,
	p_terms_hash text,
	p_decision text,
	p_counter_terms jsonb,
	p_ip_hash text,
	p_user_agent text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_invite public.invites;
	v_ag public.agreements;
begin
	select * into v_invite from public.invites where id = p_invite_id for update;
	if not found or private.invite_status_now(v_invite) <> 'active' then
		raise exception using message = 'invite_unavailable', errcode = 'P0001';
	end if;
	if private.normalize_phone_tr(p_phone) is distinct from v_invite.target_phone_e164 then
		raise exception using message = 'forbidden', errcode = 'P0001';
	end if;
	select * into v_ag from public.agreements where id = v_invite.agreement_id for update;
	return private.apply_decision(
		v_ag, v_invite.id, null, v_invite.target_phone_e164,
		-- An existing account with the verified number is linked at once; otherwise F2-10 links it on sign-up.
		case when p_decision = 'reject' then null else (select id from public.profiles where phone_e164 = v_invite.target_phone_e164) end,
		'web', p_version, p_terms_hash, p_decision, p_counter_terms, p_ip_hash, p_user_agent
	);
end;
$$;

-- Grants ---------------------------------------------------------------------------------------------

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_agreement(uuid) to authenticated;

revoke all on function public.invite_open(text) from public, anon, authenticated;
revoke all on function public.invite_send_otp(text, text, text, text) from public, anon, authenticated;
revoke all on function public.invite_verify_otp(text, text, text) from public, anon, authenticated;
revoke all on function public.invite_details(uuid) from public, anon, authenticated;
revoke all on function public.invite_decide(uuid, text, int, text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.invite_open(text) to service_role;
grant execute on function public.invite_send_otp(text, text, text, text) to service_role;
grant execute on function public.invite_verify_otp(text, text, text) to service_role;
grant execute on function public.invite_details(uuid) to service_role;
grant execute on function public.invite_decide(uuid, text, int, text, text, jsonb, text, text) to service_role;
