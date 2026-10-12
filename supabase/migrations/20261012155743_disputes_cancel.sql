-- F2-09: disputes, mutual cancellation and forgiveness on a shared agreement (spec 5.7, 5.8,
-- state-machines.md). The app is no referee: a dispute only freezes the agreement (BR-14, no
-- reminders) and records the reason; it ends when its opener withdraws it, an amendment is accepted,
-- or both sides cancel.

create table public.disputes (
	id uuid primary key default gen_random_uuid(),
	agreement_id uuid not null references public.agreements (id) on delete cascade,
	opened_by uuid not null references public.profiles (id),
	-- Spec 5.7: the whole agreement or one payment.
	payment_id uuid references public.payments (id) on delete cascade,
	reason text not null check (char_length(reason) between 1 and 500),
	-- resolved: withdrawn by its opener; amended: an accepted amendment; closed: the agreement was cancelled.
	status text not null default 'open' check (status in ('open', 'resolved', 'amended', 'closed')),
	resolved_at timestamptz,
	created_at timestamptz not null default now(),
	constraint disputes_resolved_at check ((status = 'open') = (resolved_at is null))
);
create unique index disputes_one_open_idx on public.disputes (agreement_id) where status = 'open';
create index disputes_opened_by_idx on public.disputes (opened_by);
create index disputes_payment_id_idx on public.disputes (payment_id);
-- Read only through get_agreement_detail / list_requests.
alter table public.disputes enable row level security;

-- An open cancellation request waits on the agreement itself; its history is in agreement_events.
alter table public.agreements
	add column cancel_requested_by uuid references public.profiles (id),
	add column cancel_requested_at timestamptz,
	add constraint agreements_cancel_request check ((cancel_requested_by is null) = (cancel_requested_at is null));
create index agreements_cancel_requested_by_idx on public.agreements (cancel_requested_by);

-- Ends the open dispute of an agreement, if any.
create function private.end_dispute(p_agreement_id uuid, p_status text) returns boolean
language plpgsql
set search_path = ''
as $$
begin
	update public.disputes set status = p_status, resolved_at = now()
	where agreement_id = p_agreement_id and status = 'open';
	return found;
end;
$$;

-- open_dispute ---------------------------------------------------------------------------------------

-- Allowed while an amendment is open too: the proposal stays and may itself settle the dispute.
create function public.open_dispute(p_id uuid, p_reason text, p_payment_id uuid, p_row_version int) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
	v_ag public.agreements;
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
	if v_ag.status not in ('active', 'amendment_pending') then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if v_ag.row_version <> p_row_version then
		raise exception using message = 'conflict', errcode = 'P0001';
	end if;
	v_reason := private.check_text(to_jsonb(p_reason), 500, true);
	if p_payment_id is not null and not exists (select 1 from public.payments where id = p_payment_id and agreement_id = p_id) then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'payment_id';
	end if;

	insert into public.disputes (agreement_id, opened_by, payment_id, reason)
	values (p_id, v_uid, p_payment_id, v_reason);
	update public.agreements set status = 'disputed', row_version = row_version + 1 where id = p_id;
	insert into public.agreement_events (agreement_id, actor_id, channel, type, version, payload)
	values (p_id, v_uid, 'app', 'dispute_opened', v_ag.active_version,
		case when p_payment_id is null then '{}'::jsonb else jsonb_build_object('payment_id', p_payment_id) end);
	select display_name into v_me from public.profiles where id = v_uid;
	perform private.notify(private.other_party(v_ag, v_uid), 'disputeOpened', jsonb_build_object('agreement_id', p_id, 'name', v_me, 'amount_minor', 0));
	return jsonb_build_object('status', 'disputed');
end;
$$;

-- resolve_dispute: its opener withdraws it -----------------------------------------------------------

create function public.resolve_dispute(p_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
	v_ag public.agreements;
	v_opener uuid;
	v_status public.agreement_status;
	v_me text;
begin
	if v_uid is null then
		raise exception 'not_authenticated' using errcode = '28000';
	end if;
	select * into v_ag from public.agreements where id = p_id for update;
	if not found or not private.is_party(v_ag, v_uid) then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	select opened_by into v_opener from public.disputes where agreement_id = p_id and status = 'open';
	if v_ag.status <> 'disputed' or v_opener is null then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if v_opener <> v_uid then
		raise exception using message = 'forbidden', errcode = 'P0001';
	end if;

	perform private.end_dispute(p_id, 'resolved');
	-- An amendment proposed during the dispute is still waiting for its answer.
	v_status := case when v_ag.pending_version is null then 'active'::public.agreement_status else 'amendment_pending'::public.agreement_status end;
	update public.agreements set status = v_status, row_version = row_version + 1 where id = p_id;
	insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
	values (p_id, v_uid, 'app', 'dispute_resolved', v_ag.active_version);
	select display_name into v_me from public.profiles where id = v_uid;
	perform private.notify(private.other_party(v_ag, v_uid), 'disputeResolved', jsonb_build_object('agreement_id', p_id, 'name', v_me, 'amount_minor', 0));
	return jsonb_build_object('status', v_status);
end;
$$;

-- An accepted amendment also ends the dispute (state-machines.md "disputed → decide_amendment(accept)").
create or replace function public.decide_amendment(p_id uuid, p_version int, p_terms_hash text, p_decision text) returns jsonb
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
		perform private.activate_version(v_ag, p_version);
		if private.end_dispute(p_id, 'amended') then
			insert into public.agreement_events (agreement_id, actor_id, channel, type, version, payload)
			values (p_id, v_uid, 'app', 'dispute_resolved', p_version, '{"via": "amendment"}'::jsonb);
		end if;
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

-- request_cancel / decide_cancel ---------------------------------------------------------------------

-- Also while disputed: cancelling together is one of the ways out of a dispute.
create function public.request_cancel(p_id uuid, p_row_version int) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
	v_ag public.agreements;
	v_me text;
begin
	if v_uid is null then
		raise exception 'not_authenticated' using errcode = '28000';
	end if;
	select * into v_ag from public.agreements where id = p_id for update;
	if not found or not private.is_party(v_ag, v_uid) then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if v_ag.status not in ('active', 'amendment_pending', 'disputed') or v_ag.cancel_requested_by is not null then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if v_ag.row_version <> p_row_version then
		raise exception using message = 'conflict', errcode = 'P0001';
	end if;

	update public.agreements
	set cancel_requested_by = v_uid, cancel_requested_at = now(), row_version = row_version + 1
	where id = p_id;
	insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
	values (p_id, v_uid, 'app', 'cancel_requested', v_ag.active_version);
	select display_name into v_me from public.profiles where id = v_uid;
	perform private.notify(private.other_party(v_ag, v_uid), 'cancelRequested', jsonb_build_object('agreement_id', p_id, 'name', v_me, 'amount_minor', 0));
	return jsonb_build_object('status', v_ag.status);
end;
$$;

create function public.decide_cancel(p_id uuid, p_decision text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
	v_ag public.agreements;
	v_requester uuid;
	v_status public.agreement_status;
	v_me text;
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
	-- A repeated "accept" returns the first result (BR-09) instead of failing.
	if v_ag.status = 'cancelled' and p_decision = 'accept' and exists (
		select 1 from public.agreement_events
		where agreement_id = p_id and type = 'cancel_accepted' and actor_id = v_uid
	) then
		return jsonb_build_object('status', 'cancelled', 'replayed', true);
	end if;
	v_requester := v_ag.cancel_requested_by;
	if v_ag.status not in ('active', 'amendment_pending', 'disputed') or v_requester is null then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if v_requester = v_uid then
		raise exception using message = 'forbidden', errcode = 'P0001';
	end if;

	if p_decision = 'accept' then
		perform private.end_dispute(p_id, 'closed');
		if v_ag.pending_version is not null then
			perform private.close_proposal(v_ag, 'superseded');
		end if;
		update public.agreements
		set status = 'cancelled', cancelled_at = now(), cancel_requested_by = null, cancel_requested_at = null,
			row_version = row_version + 1
		where id = p_id
		returning status into v_status;
		insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
		values (p_id, v_uid, 'app', 'cancel_accepted', v_ag.active_version),
			(p_id, null, 'system', 'cancelled', v_ag.active_version);
	else
		update public.agreements
		set cancel_requested_by = null, cancel_requested_at = null, row_version = row_version + 1
		where id = p_id
		returning status into v_status;
		insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
		values (p_id, v_uid, 'app', 'cancel_rejected', v_ag.active_version);
	end if;
	select display_name into v_me from public.profiles where id = v_uid;
	perform private.notify(v_requester, case when p_decision = 'accept' then 'cancelAccepted' else 'cancelRejected' end,
		jsonb_build_object('agreement_id', p_id, 'name', v_me, 'amount_minor', 0));
	return jsonb_build_object('status', v_status, 'replayed', false);
end;
$$;

-- forgive_remaining: the creditor's discount or full forgiveness --------------------------------------

-- Against the creditor's own interest, so the debtor is only informed (spec 5.6). A discount is a
-- confirmed payment of kind "discount": it allocates FIFO and settles like any confirmed payment (BR-04).
create function public.forgive_remaining(p_id uuid, p_amount_minor bigint, p_row_version int, p_idempotency_key uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
	v_existing public.payments;
	v_ag public.agreements;
	v_amount bigint;
	v_payment_id uuid;
	v_settled boolean;
	v_me text;
begin
	if v_uid is null then
		raise exception 'not_authenticated' using errcode = '28000';
	end if;
	if p_idempotency_key is null then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'idempotency_key';
	end if;
	select * into v_existing from public.payments where idempotency_key = p_idempotency_key;
	if found then
		if v_existing.reported_by <> v_uid or v_existing.agreement_id <> p_id then
			raise exception using message = 'conflict', errcode = 'P0001';
		end if;
		return jsonb_build_object('payment_id', v_existing.id, 'replayed', true, 'settled', false);
	end if;

	select * into v_ag from public.agreements where id = p_id for update;
	if not found or not private.is_party(v_ag, v_uid) then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if private.my_role(v_ag, v_uid) <> 'creditor' then
		raise exception using message = 'forbidden', errcode = 'P0001';
	end if;
	-- BR-14: nothing new on a closed or disputed agreement.
	if v_ag.status not in ('personal', 'active', 'amendment_pending') then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if v_ag.row_version <> p_row_version then
		raise exception using message = 'conflict', errcode = 'P0001';
	end if;
	v_amount := coalesce(p_amount_minor, v_ag.outstanding_minor);
	if v_amount <= 0 then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'amount';
	end if;
	if v_amount > v_ag.outstanding_minor then
		raise exception using message = 'amount_exceeds_outstanding', errcode = 'P0001';
	end if;

	insert into public.payments (agreement_id, amount_minor, paid_on, method, kind, status, reported_by, decided_by, decided_at, idempotency_key)
	values (p_id, v_amount, private.today(), 'other', 'discount', 'confirmed', v_uid, v_uid, now(), p_idempotency_key)
	returning id into v_payment_id;
	insert into public.agreement_events (agreement_id, actor_id, channel, type, version, payload)
	values (p_id, v_uid, 'app', 'forgiven', v_ag.active_version, jsonb_build_object('payment_id', v_payment_id, 'amount_minor', v_amount));
	v_settled := private.confirm_payment_effects(v_ag, v_payment_id, v_amount);

	if v_ag.status <> 'personal' then
		select display_name into v_me from public.profiles where id = v_uid;
		perform private.notify(private.other_party(v_ag, v_uid), 'forgiven', jsonb_build_object(
			'agreement_id', p_id, 'name', v_me, 'amount_minor', v_amount, 'remaining_minor', v_ag.outstanding_minor - v_amount));
	end if;
	update public.agreements set row_version = row_version + 1 where id = p_id;
	return jsonb_build_object('payment_id', v_payment_id, 'replayed', false, 'settled', v_settled);
end;
$$;

-- Read side --------------------------------------------------------------------------------------------

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
			union all
			-- The other side's open dispute (only its opener can withdraw it, so it is news, not a question).
			select d.created_at, jsonb_build_object(
				'agreement_id', a.id,
				'kind', 'dispute',
				'title', a.title,
				'from_name', (select display_name from public.profiles where id = d.opened_by),
				'my_role', private.my_role(a, v_uid),
				'principal_minor', a.principal_minor,
				'reason', d.reason
			)
			from public.disputes d
			join public.agreements a on a.id = d.agreement_id
			where d.status = 'open' and d.opened_by <> v_uid and private.is_party(a, v_uid)
			union all
			select a.cancel_requested_at, jsonb_build_object(
				'agreement_id', a.id,
				'kind', 'cancel',
				'title', a.title,
				'from_name', (select display_name from public.profiles where id = a.cancel_requested_by),
				'my_role', private.my_role(a, v_uid),
				'principal_minor', a.principal_minor
			)
			from public.agreements a
			where a.cancel_requested_by is not null and a.cancel_requested_by <> v_uid
				and a.status in ('active', 'amendment_pending', 'disputed') and private.is_party(a, v_uid)
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
		'dispute', (
			select jsonb_build_object('by_me', d.opened_by = v_uid, 'reason', d.reason, 'payment_id', d.payment_id, 'opened_at', d.created_at)
			from public.disputes d where d.agreement_id = p_id and d.status = 'open'
		),
		'cancel_request', case when v_ag.cancel_requested_by is not null and v_ag.status in ('active', 'amendment_pending', 'disputed') then
			jsonb_build_object('by_me', v_ag.cancel_requested_by = v_uid, 'requested_at', v_ag.cancel_requested_at)
		end,
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

revoke all on function public.open_dispute(uuid, text, uuid, int) from public, anon;
revoke all on function public.resolve_dispute(uuid) from public, anon;
revoke all on function public.request_cancel(uuid, int) from public, anon;
revoke all on function public.decide_cancel(uuid, text) from public, anon;
revoke all on function public.forgive_remaining(uuid, bigint, int, uuid) from public, anon;
grant execute on function public.open_dispute(uuid, text, uuid, int) to authenticated;
grant execute on function public.resolve_dispute(uuid) to authenticated;
grant execute on function public.request_cancel(uuid, int) to authenticated;
grant execute on function public.decide_cancel(uuid, text) to authenticated;
grant execute on function public.forgive_remaining(uuid, bigint, int, uuid) to authenticated;
