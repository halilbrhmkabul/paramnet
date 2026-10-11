-- F2-03: decisions on a shared agreement (state-machines.md: pending / countered / rejected).
-- Every decision names the version and its terms_hash (BR-06): what was shown is what is decided.

-- Shared helpers -------------------------------------------------------------------------------------

-- Terms proposed in a counter offer. The down payment is a recorded payment and cannot change here,
-- and the new total may not fall below what has already been paid (same rules as ADR-021).
create function private.proposal_terms(p_agreement public.agreements, p_terms jsonb) returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
	v_terms jsonb := private.parse_terms(p_terms);
	v_down bigint;
	v_paid bigint;
begin
	select (terms ->> 'down_payment_minor')::bigint into v_down
	from public.agreement_versions where agreement_id = p_agreement.id and version = p_agreement.active_version;
	if (v_terms ->> 'down_payment_minor')::bigint <> v_down then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'down_payment_locked';
	end if;
	select coalesce(sum(amount_minor), 0) into v_paid
	from public.payments
	where agreement_id = p_agreement.id and status = 'confirmed' and kind <> 'down_payment';
	if (v_terms ->> 'principal_minor')::bigint - v_down < v_paid then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'paid_exceeds_total';
	end if;
	return v_terms;
end;
$$;

-- Adds a proposed version and returns its number.
create function private.add_proposal(p_agreement public.agreements, p_terms jsonb, p_by uuid) returns int
language plpgsql
set search_path = ''
as $$
declare
	v_version int;
begin
	select max(version) + 1 into v_version from public.agreement_versions where agreement_id = p_agreement.id;
	insert into public.agreement_versions (agreement_id, version, terms, terms_hash, proposed_by, status)
	values (p_agreement.id, v_version, p_terms, private.terms_hash(p_terms), p_by, 'proposed');
	return v_version;
end;
$$;

-- Puts a version into force: installments, re-allocation of confirmed payments (the down payment is
-- never allocated), principal/outstanding, active status. Old allocations stay on the old version.
create function private.activate_version(p_agreement public.agreements, p_version int) returns void
language plpgsql
set search_path = ''
as $$
declare
	v_terms jsonb;
	v_down bigint;
	v_paid bigint;
	v_outstanding bigint;
	v_payment record;
begin
	select terms into v_terms from public.agreement_versions where agreement_id = p_agreement.id and version = p_version;
	v_down := (v_terms ->> 'down_payment_minor')::bigint;

	if p_version <> p_agreement.active_version then
		update public.agreement_versions set status = 'superseded'
		where agreement_id = p_agreement.id and version = p_agreement.active_version;
		perform private.insert_installments(p_agreement.id, p_version, v_terms -> 'plan');
		for v_payment in
			select id, amount_minor from public.payments
			where agreement_id = p_agreement.id and status = 'confirmed' and kind <> 'down_payment'
			order by paid_on, created_at, id
		loop
			perform private.apply_allocation(p_agreement.id, p_version, v_payment.id, v_payment.amount_minor);
		end loop;
	end if;
	update public.agreement_versions set status = 'accepted' where agreement_id = p_agreement.id and version = p_version;

	select coalesce(sum(amount_minor), 0) into v_paid
	from public.payments
	where agreement_id = p_agreement.id and status = 'confirmed' and kind <> 'down_payment';
	v_outstanding := (v_terms ->> 'principal_minor')::bigint - v_down - v_paid;

	update public.agreements
	set principal_minor = (v_terms ->> 'principal_minor')::bigint,
		outstanding_minor = v_outstanding,
		active_version = p_version,
		pending_version = null,
		status = case when v_outstanding = 0 then 'settled'::public.agreement_status else 'active' end,
		settled_at = case when v_outstanding = 0 then now() else null end
	where id = p_agreement.id;
end;
$$;

create function private.check_decision_terms(p_agreement public.agreements, p_version int, p_terms_hash text) returns void
language plpgsql
stable
set search_path = ''
as $$
begin
	-- BR-06: a stale screen (older version or changed terms) cannot be approved.
	if p_version is distinct from p_agreement.pending_version
		or p_terms_hash is distinct from (
			select terms_hash from public.agreement_versions where agreement_id = p_agreement.id and version = p_version
		) then
		raise exception using message = 'conflict', errcode = 'P0001';
	end if;
end;
$$;

-- decide_agreement: the counterparty answers a shared plan -----------------------------------------------

create function public.decide_agreement(
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
	v_version int;
	v_status public.agreement_status;
	v_type text;
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
	if v_ag.status <> 'pending' then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if p_decision is null or p_decision not in ('accept', 'counter', 'reject') then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'decision';
	end if;
	perform private.check_decision_terms(v_ag, p_version, p_terms_hash);

	case p_decision
		when 'accept' then
			update public.agreements set counterparty_profile_id = v_uid where id = p_id;
			perform private.activate_version(v_ag, p_version);
			v_version := p_version;
			v_type := 'accepted';
		when 'counter' then
			-- A creator's counter offer that is answered with another one is rejected.
			update public.agreement_versions set status = 'rejected'
			where agreement_id = p_id and version = p_version and status = 'proposed';
			v_version := private.add_proposal(v_ag, private.proposal_terms(v_ag, p_counter_terms), v_uid);
			update public.agreements
			set status = 'countered', pending_version = v_version, counterparty_profile_id = v_uid
			where id = p_id;
			v_type := 'countered';
		else
			update public.agreement_versions set status = 'rejected'
			where agreement_id = p_id and version = p_version and status = 'proposed';
			-- "Bu plan bana ait değil": a rejection does not link the account to the agreement.
			update public.agreements set status = 'rejected', pending_version = null where id = p_id;
			v_version := p_version;
			v_type := 'rejected';
	end case;

	update public.invites set status = 'consumed', consumed_at = now() where id = v_invite.id;
	update public.agreements set row_version = row_version + 1 where id = p_id returning status into v_status;
	insert into public.agreement_events (agreement_id, actor_id, actor_phone_e164, channel, type, version)
	values (p_id, v_uid, v_me.phone_e164, 'app', v_type, v_version);
	return jsonb_build_object('status', v_status, 'version', v_version);
end;
$$;

-- decide_counter: the creator answers a counter offer --------------------------------------------------

create function public.decide_counter(
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
	v_ag public.agreements;
	v_version int;
	v_status public.agreement_status;
begin
	v_ag := private.lock_own_agreement(p_id);
	if v_ag.status <> 'countered' then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	-- Withdrawing the share is the creator's "no" (withdraw_share).
	if p_decision is null or p_decision not in ('accept', 'counter') then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'decision';
	end if;
	perform private.check_decision_terms(v_ag, p_version, p_terms_hash);

	if p_decision = 'accept' then
		perform private.activate_version(v_ag, p_version);
		v_version := p_version;
	else
		update public.agreement_versions set status = 'rejected' where agreement_id = p_id and version = p_version;
		v_version := private.add_proposal(v_ag, private.proposal_terms(v_ag, p_counter_terms), v_ag.creator_id);
		update public.agreements set status = 'pending', pending_version = v_version where id = p_id;
	end if;

	update public.agreements set row_version = row_version + 1 where id = p_id returning status into v_status;
	insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
	values (p_id, v_ag.creator_id, 'app', case when p_decision = 'accept' then 'accepted' else 'countered' end, v_version);
	return jsonb_build_object('status', v_status, 'version', v_version);
end;
$$;

-- make_personal: rejected → personal ------------------------------------------------------------------

create function public.make_personal(p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_ag public.agreements;
begin
	v_ag := private.lock_own_agreement(p_id);
	if v_ag.status <> 'rejected' then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	update public.agreements set status = 'personal', row_version = row_version + 1 where id = p_id;
	insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
	values (p_id, v_ag.creator_id, 'app', 'made_personal', v_ag.active_version);
	return jsonb_build_object('status', 'personal');
end;
$$;

-- Grants ---------------------------------------------------------------------------------------------

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_agreement(uuid) to authenticated;

revoke all on function public.decide_agreement(uuid, int, text, text, jsonb) from public, anon;
revoke all on function public.decide_counter(uuid, int, text, text, jsonb) from public, anon;
revoke all on function public.make_personal(uuid) from public, anon;
grant execute on function public.decide_agreement(uuid, int, text, text, jsonb) to authenticated;
grant execute on function public.decide_counter(uuid, int, text, text, jsonb) to authenticated;
grant execute on function public.make_personal(uuid) to authenticated;
