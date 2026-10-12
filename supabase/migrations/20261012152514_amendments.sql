-- F2-08: amendment requests on an active agreement (spec 5.6, state-machines.md).
-- A proposal is full terms (BR-03, terms_hash); while it is open the old terms stay in force
-- (amendment_pending). Accepting puts it into force like a counter offer (private.activate_version):
-- new installments, confirmed payments re-allocated, old allocations kept as history.

-- One open request at a time (BR-07); on a disputed agreement a proposal may resolve the dispute.
create function public.propose_amendment(p_id uuid, p_terms jsonb, p_reason text, p_row_version int) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
	v_ag public.agreements;
	v_terms jsonb;
	v_version int;
	v_reason text;
	v_me text;
begin
	if v_uid is null then
		raise exception 'not_authenticated' using errcode = '28000';
	end if;
	select * into v_ag from public.agreements where id = p_id for update;
	if not found or not private.is_party(v_ag, v_uid) then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if v_ag.status not in ('active', 'disputed') or v_ag.pending_version is not null then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if v_ag.row_version <> p_row_version then
		raise exception using message = 'conflict', errcode = 'P0001';
	end if;
	v_terms := private.proposal_terms(v_ag, p_terms);
	v_reason := private.check_text(to_jsonb(p_reason), 500, false);

	select max(version) + 1 into v_version from public.agreement_versions where agreement_id = p_id;
	insert into public.agreement_versions (agreement_id, version, terms, terms_hash, proposed_by, reason, status)
	values (p_id, v_version, v_terms, private.terms_hash(v_terms), v_uid, v_reason, 'proposed');
	update public.agreements
	set pending_version = v_version,
		status = case when status = 'active' then 'amendment_pending'::public.agreement_status else status end,
		row_version = row_version + 1
	where id = p_id;

	insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
	values (p_id, v_uid, 'app', 'amendment_proposed', v_version);
	select display_name into v_me from public.profiles where id = v_uid;
	perform private.notify(private.other_party(v_ag, v_uid), 'amendmentProposed', jsonb_build_object('agreement_id', p_id, 'name', v_me, 'amount_minor', 0));
	return jsonb_build_object('status', (select status from public.agreements where id = p_id), 'version', v_version);
end;
$$;

-- Status after an open proposal ends without taking effect: back to active, or still disputed.
create function private.close_proposal(p_agreement public.agreements, p_version_status public.version_status) returns void
language sql
set search_path = ''
as $$
	update public.agreement_versions set status = p_version_status
	where agreement_id = p_agreement.id and version = p_agreement.pending_version;
	update public.agreements
	set pending_version = null,
		status = case when status = 'amendment_pending' then 'active'::public.agreement_status else status end
	where id = p_agreement.id;
$$;

create function public.decide_amendment(p_id uuid, p_version int, p_terms_hash text, p_decision text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
	v_ag public.agreements;
	v_proposer uuid;
	v_me text;
	v_status public.agreement_status;
	v_active int;
begin
	if v_uid is null then
		raise exception 'not_authenticated' using errcode = '28000';
	end if;
	if p_decision is null or p_decision not in ('accept', 'reject') then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'decision';
	end if;
	select * into v_ag from public.agreements where id = p_id for update;
	if not found or not private.is_party(v_ag, v_uid) then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if v_ag.status not in ('amendment_pending', 'disputed') or v_ag.pending_version is null then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	select proposed_by into v_proposer from public.agreement_versions where agreement_id = p_id and version = v_ag.pending_version;
	-- The other side decides (state-machines.md "Diğer taraf").
	if v_proposer = v_uid then
		raise exception using message = 'forbidden', errcode = 'P0001';
	end if;
	perform private.check_decision_terms(v_ag, p_version, p_terms_hash);

	if p_decision = 'accept' then
		-- Also ends a dispute: the agreement becomes active under the new terms.
		perform private.activate_version(v_ag, p_version);
	else
		perform private.close_proposal(v_ag, 'rejected');
	end if;
	update public.agreements set row_version = row_version + 1 where id = p_id returning status, active_version into v_status, v_active;
	insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
	values (p_id, v_uid, 'app', case when p_decision = 'accept' then 'amendment_accepted' else 'amendment_rejected' end, p_version);
	select display_name into v_me from public.profiles where id = v_uid;
	perform private.notify(v_proposer, case when p_decision = 'accept' then 'amendmentAccepted' else 'amendmentRejected' end,
		jsonb_build_object('agreement_id', p_id, 'name', v_me, 'amount_minor', 0));
	return jsonb_build_object('status', v_status, 'version', v_active);
end;
$$;

create function public.withdraw_amendment(p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
	v_ag public.agreements;
	v_status public.agreement_status;
begin
	if v_uid is null then
		raise exception 'not_authenticated' using errcode = '28000';
	end if;
	select * into v_ag from public.agreements where id = p_id for update;
	if not found or not private.is_party(v_ag, v_uid) then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if v_ag.pending_version is null or v_ag.status not in ('amendment_pending', 'disputed') then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if (select proposed_by from public.agreement_versions where agreement_id = p_id and version = v_ag.pending_version) <> v_uid then
		raise exception using message = 'forbidden', errcode = 'P0001';
	end if;
	-- version_status has no "withdrawn"; a withdrawn proposal is simply no longer current.
	perform private.close_proposal(v_ag, 'superseded');
	update public.agreements set row_version = row_version + 1 where id = p_id returning status into v_status;
	insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
	values (p_id, v_uid, 'app', 'amendment_withdrawn', v_ag.pending_version);
	return jsonb_build_object('status', v_status);
end;
$$;

-- The reviewer of an open amendment is a decision actor too.
create or replace function private.decision_actor(p_agreement public.agreements, p_uid uuid) returns text
language sql
stable
set search_path = ''
as $$
	select case
		when p_agreement.status = 'countered' and p_agreement.creator_id = p_uid then 'creator'
		when p_agreement.status = 'pending' and p_agreement.creator_id <> p_uid and (
			p_agreement.counterparty_profile_id = p_uid
			or (
				p_agreement.counterparty_profile_id is null
				and exists (
					select 1 from public.invites i
					where i.agreement_id = p_agreement.id and i.status = 'active' and i.expires_at > now()
						and i.target_phone_e164 = (select phone_e164 from public.profiles where id = p_uid)
				)
			)
		) then 'counterparty'
		when p_agreement.status in ('amendment_pending', 'disputed') and p_agreement.pending_version is not null
			and private.is_party(p_agreement, p_uid)
			and (select proposed_by from public.agreement_versions v where v.agreement_id = p_agreement.id and v.version = p_agreement.pending_version) <> p_uid
			then 'amendment'
	end;
$$;

create or replace function public.get_pending_decision(p_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_ag public.agreements;
	v_actor text;
	v_current public.agreement_versions;
	v_proposed public.agreement_versions;
begin
	select * into v_ag from public.agreements where id = p_id;
	v_actor := case when found then private.decision_actor(v_ag, v_uid) end;
	if v_actor is null then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	select * into v_current from public.agreement_versions where agreement_id = p_id and version = v_ag.active_version;
	select * into v_proposed from public.agreement_versions where agreement_id = p_id and version = v_ag.pending_version;
	return jsonb_build_object(
		'agreement_id', v_ag.id,
		'title', v_ag.title,
		'actor', v_actor,
		'other_name', (select display_name from public.profiles where id = private.other_party(v_ag, v_uid)),
		'reason', v_proposed.reason,
		'my_role', private.my_role(v_ag, v_uid),
		'version', v_proposed.version,
		'terms_hash', v_proposed.terms_hash,
		'current', v_current.terms,
		'proposed', v_proposed.terms,
		-- The creator's "no" to a counter offer is withdraw_share, not a rejection.
		'can_reject', v_actor in ('counterparty', 'amendment'),
		'payments', (
			select coalesce(jsonb_agg(jsonb_build_object('amount_minor', p.amount_minor, 'paid_on', p.paid_on, 'kind', p.kind) order by p.paid_on, p.created_at), '[]'::jsonb)
			from public.payments p where p.agreement_id = p_id and p.status = 'confirmed'
		)
	);
end;
$$;

create or replace function public.list_requests() returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
begin
	return (
		select coalesce(jsonb_agg(item order by created_at desc), '[]'::jsonb)
		from (
			select a.created_at, jsonb_build_object(
				'agreement_id', a.id,
				'kind', case private.decision_actor(a, v_uid) when 'creator' then 'counter' when 'amendment' then 'amendment' else 'share' end,
				'title', a.title,
				'from_name', (select display_name from public.profiles where id = private.other_party(a, v_uid)),
				'my_role', private.my_role(a, v_uid),
				'principal_minor', a.principal_minor
			) as item
			from public.agreements a
			where a.status in ('pending', 'countered', 'amendment_pending', 'disputed') and private.decision_actor(a, v_uid) is not null
			union all
			select p.created_at, jsonb_build_object(
				'agreement_id', a.id,
				'kind', 'payment',
				'payment_id', p.id,
				'title', a.title,
				'from_name', (select display_name from public.profiles where id = p.reported_by),
				'my_role', 'creditor',
				'principal_minor', a.principal_minor,
				'amount_minor', p.amount_minor,
				'paid_on', p.paid_on,
				'note', p.note
			)
			from public.payments p
			join public.agreements a on a.id = p.agreement_id
			where p.status = 'reported' and p.reported_by <> v_uid
				and a.status in ('active', 'amendment_pending')
				and private.is_party(a, v_uid) and private.my_role(a, v_uid) = 'creditor'
		) as requests
	);
end;
$$;

create or replace function public.get_agreement_detail(p_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_today date := private.today();
	v_ag public.agreements;
	v_terms jsonb;
begin
	select * into v_ag from public.agreements a
	where a.id = p_id and (a.creator_id = v_uid or (a.counterparty_profile_id = v_uid and a.status <> 'personal'));
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	select terms into v_terms from public.agreement_versions where agreement_id = p_id and version = v_ag.active_version;

	return private.agreement_summary(v_ag, v_uid, v_today) || jsonb_build_object(
		'description', v_ag.description,
		'started_on', v_ag.started_on,
		-- An open counter offer or amendment I proposed (I may withdraw it) vs. one waiting for me.
		'pending_by_me', (
			select proposed_by = v_uid from public.agreement_versions
			where agreement_id = p_id and version = v_ag.pending_version and status = 'proposed'
		),
		'notes', v_terms -> 'notes',
		'down_payment_minor', (v_terms ->> 'down_payment_minor')::bigint,
		'created_at', v_ag.created_at,
		'installments', (
			select coalesce(jsonb_agg(jsonb_build_object(
				'id', i.id, 'seq', i.seq, 'due_date', i.due_date, 'amount_minor', i.amount_minor, 'paid_minor', i.paid_minor,
				'state', private.installment_state(i.due_date, i.amount_minor, i.paid_minor, v_today)
			) order by i.seq), '[]'::jsonb)
			from public.installments i where i.agreement_id = p_id and i.version = v_ag.active_version
		),
		'payments', (
			select coalesce(jsonb_agg(jsonb_build_object(
				'id', p.id, 'amount_minor', p.amount_minor, 'paid_on', p.paid_on, 'method', p.method, 'kind', p.kind,
				'status', p.status, 'note', p.note, 'created_at', p.created_at,
				-- Decides which actions a reported payment offers (withdraw vs confirm / reject).
				'by_me', p.reported_by = v_uid
			) order by p.paid_on desc, p.created_at desc, p.id), '[]'::jsonb)
			from public.payments p where p.agreement_id = p_id
		),
		'events', (
			select coalesce(jsonb_agg(jsonb_build_object(
				'id', e.id::text,
				'type', e.type,
				'at', e.created_at,
				'actor', case when e.actor_id = v_uid then 'me' when e.actor_id is null then 'system' else 'counterparty' end,
				'amount_minor', e.payload -> 'amount_minor'
			) order by e.id), '[]'::jsonb)
			from public.agreement_events e where e.agreement_id = p_id
		)
	);
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_agreement(uuid) to authenticated;

revoke all on function public.propose_amendment(uuid, jsonb, text, int) from public, anon;
revoke all on function public.decide_amendment(uuid, int, text, text) from public, anon;
revoke all on function public.withdraw_amendment(uuid) from public, anon;
grant execute on function public.propose_amendment(uuid, jsonb, text, int) to authenticated;
grant execute on function public.decide_amendment(uuid, int, text, text) to authenticated;
grant execute on function public.withdraw_amendment(uuid) to authenticated;
