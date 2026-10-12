-- F2-07: payments on a shared agreement (spec 5.5, state-machines.md "Ödeme durumları").
-- Creditor records → confirmed (debtor informed). Debtor records → reported (creditor asked); it does
-- not reduce the balance until the creditor confirms (BR-08). Personal mode is unchanged.

-- The other party's account, if linked (a web-only counterparty has none yet, F2-10).
create function private.other_party(p_agreement public.agreements, p_uid uuid) returns uuid
language sql
stable
set search_path = ''
as $$
	select case when p_agreement.creator_id = p_uid then p_agreement.counterparty_profile_id else p_agreement.creator_id end;
$$;

-- Queues a template for the other party (rendered by dispatch-notifications, copy-tr notif.*).
create function private.notify(p_user uuid, p_template text, p_payload jsonb) returns void
language sql
set search_path = ''
as $$
	insert into public.notification_outbox (user_id, template, payload)
	select p_user, p_template, p_payload where p_user is not null;
$$;

-- Applies a confirmed payment: FIFO allocation, balance, settlement in the same transaction.
create function private.confirm_payment_effects(p_agreement public.agreements, p_payment_id uuid, p_amount bigint)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
	v_settled boolean := p_agreement.outstanding_minor - p_amount = 0;
begin
	perform private.apply_allocation(p_agreement.id, p_agreement.active_version, p_payment_id, p_amount);
	update public.agreements
	set outstanding_minor = outstanding_minor - p_amount,
		status = case when v_settled then 'settled'::public.agreement_status else status end,
		settled_at = case when v_settled then now() else settled_at end
	where id = p_agreement.id;
	if v_settled then
		insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
		values (p_agreement.id, null, 'system', 'settled', p_agreement.active_version);
	end if;
	return v_settled;
end;
$$;

-- record_payment ---------------------------------------------------------------------------------------

create or replace function public.record_payment(
	p_agreement_id uuid,
	p_input jsonb,
	p_row_version int,
	p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
	v_existing public.payments;
	v_ag public.agreements;
	v_role public.party_role;
	v_status public.payment_status;
	v_amount bigint;
	v_paid_on date;
	v_method public.payment_method;
	v_note text;
	v_payment_id uuid;
	v_settled boolean := false;
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
		if v_existing.reported_by <> v_uid or v_existing.agreement_id <> p_agreement_id then
			raise exception using message = 'conflict', errcode = 'P0001';
		end if;
		return jsonb_build_object('payment_id', v_existing.id, 'status', v_existing.status, 'replayed', true, 'settled', false);
	end if;

	select * into v_ag from public.agreements where id = p_agreement_id for update;
	if not found or not private.is_party(v_ag, v_uid) then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	-- BR-14: nothing new on a closed or disputed agreement; amendment_pending keeps the old terms in force.
	if v_ag.status not in ('personal', 'active', 'amendment_pending') then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if v_ag.row_version <> p_row_version then
		raise exception using message = 'conflict', errcode = 'P0001';
	end if;

	if jsonb_typeof(p_input) is distinct from 'object'
		or (select array_agg(k order by k) from jsonb_object_keys(p_input) as k) <> array['amount_minor', 'method', 'note', 'paid_on'] then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'input_keys';
	end if;
	if not private.is_minor(p_input -> 'amount_minor') or (p_input ->> 'amount_minor')::numeric = 0 then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'amount';
	end if;
	v_amount := (p_input ->> 'amount_minor')::bigint;
	v_paid_on := private.try_date(p_input ->> 'paid_on');
	if v_paid_on is null or v_paid_on > private.today() then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'paid_on';
	end if;
	begin
		v_method := (p_input ->> 'method')::public.payment_method;
	exception when invalid_text_representation then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'method';
	end;
	if v_method is null then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'method';
	end if;
	v_note := private.check_text(p_input -> 'note', 500, false);
	if v_amount > v_ag.outstanding_minor then
		raise exception using message = 'amount_exceeds_outstanding', errcode = 'P0001';
	end if;

	v_role := private.my_role(v_ag, v_uid);
	-- The owner in personal mode and the creditor are believed at once; the debtor's word waits for the creditor.
	v_status := case when v_ag.status = 'personal' or v_role = 'creditor' then 'confirmed'::public.payment_status else 'reported'::public.payment_status end;

	insert into public.payments (agreement_id, amount_minor, paid_on, method, kind, status, note, reported_by, idempotency_key)
	values (p_agreement_id, v_amount, v_paid_on, v_method, 'payment', v_status, v_note, v_uid, p_idempotency_key)
	returning id into v_payment_id;

	insert into public.agreement_events (agreement_id, actor_id, channel, type, version, payload)
	values (p_agreement_id, v_uid, 'app', case when v_status = 'confirmed' then 'payment_recorded' else 'payment_reported' end,
		v_ag.active_version, jsonb_build_object('payment_id', v_payment_id, 'amount_minor', v_amount));

	if v_status = 'confirmed' then
		v_settled := private.confirm_payment_effects(v_ag, v_payment_id, v_amount);
	end if;

	if v_ag.status <> 'personal' then
		select display_name into v_me from public.profiles where id = v_uid;
		perform private.notify(
			private.other_party(v_ag, v_uid),
			case when v_status = 'confirmed' then 'paymentRecorded' else 'paymentReported' end,
			jsonb_build_object('agreement_id', v_ag.id, 'name', v_me, 'amount_minor', v_amount,
				'remaining_minor', v_ag.outstanding_minor - case when v_status = 'confirmed' then v_amount else 0 end)
		);
	end if;

	update public.agreements set row_version = row_version + 1 where id = p_agreement_id;
	return jsonb_build_object('payment_id', v_payment_id, 'status', v_status, 'replayed', false, 'settled', v_settled);
end;
$$;

-- decide_payment: the creditor answers a reported payment ---------------------------------------------

create function public.decide_payment(p_payment_id uuid, p_decision text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
	v_payment public.payments;
	v_ag public.agreements;
	v_target public.payment_status;
	v_me text;
	v_remaining bigint;
begin
	if v_uid is null then
		raise exception 'not_authenticated' using errcode = '28000';
	end if;
	if p_decision is null or p_decision not in ('confirm', 'reject') then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'decision';
	end if;
	select * into v_payment from public.payments where id = p_payment_id;
	if found then
		select * into v_ag from public.agreements where id = v_payment.agreement_id for update;
	end if;
	if v_payment.id is null or not private.is_party(v_ag, v_uid) then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	select * into v_payment from public.payments where id = p_payment_id for update;
	if private.my_role(v_ag, v_uid) <> 'creditor' or v_payment.reported_by = v_uid then
		raise exception using message = 'forbidden', errcode = 'P0001';
	end if;

	v_target := case when p_decision = 'confirm' then 'confirmed'::public.payment_status else 'rejected'::public.payment_status end;
	-- A repeated tap returns the first result (BR-09) instead of failing.
	if v_payment.status = v_target and v_payment.decided_by = v_uid then
		return jsonb_build_object('status', v_payment.status, 'replayed', true);
	end if;
	if v_payment.status <> 'reported' or v_ag.status not in ('active', 'amendment_pending') then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if v_target = 'confirmed' and v_payment.amount_minor > v_ag.outstanding_minor then
		raise exception using message = 'amount_exceeds_outstanding', errcode = 'P0001';
	end if;

	update public.payments set status = v_target, decided_by = v_uid, decided_at = now() where id = p_payment_id;
	insert into public.agreement_events (agreement_id, actor_id, channel, type, version, payload)
	values (v_ag.id, v_uid, 'app', case when v_target = 'confirmed' then 'payment_confirmed' else 'payment_rejected' end,
		v_ag.active_version, jsonb_build_object('payment_id', p_payment_id, 'amount_minor', v_payment.amount_minor));
	v_remaining := v_ag.outstanding_minor;
	if v_target = 'confirmed' then
		perform private.confirm_payment_effects(v_ag, p_payment_id, v_payment.amount_minor);
		v_remaining := v_remaining - v_payment.amount_minor;
	end if;

	select display_name into v_me from public.profiles where id = v_uid;
	perform private.notify(
		v_payment.reported_by,
		case when v_target = 'confirmed' then 'paymentConfirmed' else 'paymentRejected' end,
		jsonb_build_object('agreement_id', v_ag.id, 'name', v_me, 'amount_minor', v_payment.amount_minor, 'remaining_minor', v_remaining)
	);
	update public.agreements set row_version = row_version + 1 where id = v_ag.id;
	return jsonb_build_object('status', v_target, 'replayed', false);
end;
$$;

-- withdraw_payment: the reporter takes a reported payment back ----------------------------------------

create function public.withdraw_payment(p_payment_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
	v_payment public.payments;
	v_ag public.agreements;
begin
	if v_uid is null then
		raise exception 'not_authenticated' using errcode = '28000';
	end if;
	select * into v_payment from public.payments where id = p_payment_id;
	if found then
		select * into v_ag from public.agreements where id = v_payment.agreement_id for update;
	end if;
	if v_payment.id is null or not private.is_party(v_ag, v_uid) then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	select * into v_payment from public.payments where id = p_payment_id for update;
	if v_payment.reported_by <> v_uid then
		raise exception using message = 'forbidden', errcode = 'P0001';
	end if;
	if v_payment.status <> 'reported' then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	update public.payments set status = 'withdrawn' where id = p_payment_id;
	insert into public.agreement_events (agreement_id, actor_id, channel, type, version, payload)
	values (v_ag.id, v_uid, 'app', 'payment_withdrawn', v_ag.active_version,
		jsonb_build_object('payment_id', p_payment_id, 'amount_minor', v_payment.amount_minor));
	update public.agreements set row_version = row_version + 1 where id = v_ag.id;
	return jsonb_build_object('status', 'withdrawn');
end;
$$;

-- list_requests: + payments waiting for my confirmation (S19 "Ödemeler") -------------------------------

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
				'kind', case when private.decision_actor(a, v_uid) = 'creator' then 'counter' else 'share' end,
				'title', a.title,
				'from_name', case
					when a.creator_id = v_uid then (select display_name from public.profiles where id = a.counterparty_profile_id)
					else (select display_name from public.profiles where id = a.creator_id)
				end,
				'my_role', private.my_role(a, v_uid),
				'principal_minor', a.principal_minor
			) as item
			from public.agreements a
			where a.status in ('pending', 'countered') and private.decision_actor(a, v_uid) is not null
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

-- The dashboard band counts the same items as Talepler (no double counting of payments).
create or replace function public.get_dashboard() returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_today date := private.today();
	v_month_start date := date_trunc('month', v_today)::date;
	v_month_end date := (date_trunc('month', v_today) + interval '1 month - 1 day')::date;
	v_open jsonb := private.due_items(v_uid, v_today, null, null, false);
	v_month jsonb := private.due_items(v_uid, v_today, v_month_start, v_month_end, false);
begin
	return jsonb_build_object(
		'receivable_minor', (
			select coalesce(sum(a.outstanding_minor), 0) from public.agreements a
			where (a.creator_id = v_uid or (a.counterparty_profile_id = v_uid and a.status <> 'personal'))
				and private.is_open(a.status) and private.my_role(a, v_uid) = 'creditor'
		),
		'payable_minor', (
			select coalesce(sum(a.outstanding_minor), 0) from public.agreements a
			where (a.creator_id = v_uid or (a.counterparty_profile_id = v_uid and a.status <> 'personal'))
				and private.is_open(a.status) and private.my_role(a, v_uid) = 'debtor'
		),
		'due_this_month_minor', (
			select coalesce(sum((d ->> 'due_minor')::bigint), 0) from jsonb_array_elements(v_month) as d where d ->> 'my_role' = 'debtor'
		),
		'collect_this_month_minor', (
			select coalesce(sum((d ->> 'due_minor')::bigint), 0) from jsonb_array_elements(v_month) as d where d ->> 'my_role' = 'creditor'
		),
		'overdue', (
			select coalesce(jsonb_agg(d order by ord), '[]'::jsonb)
			from jsonb_array_elements(v_open) with ordinality as o(d, ord) where d -> 'state' ->> 'status' = 'overdue'
		),
		'upcoming', (
			select coalesce(jsonb_agg(d order by ord), '[]'::jsonb)
			from (
				select d, ord from jsonb_array_elements(v_open) with ordinality as o(d, ord)
				where (d ->> 'due_date')::date >= v_today
				order by ord
				limit 5
			) as next
		),
		-- Payments the other side reported and I, as creditor, have to confirm (Faz 2; zero in personal mode).
		-- Everything waiting for me in Talepler (shares, counter offers, reported payments).
		'pending_count', jsonb_array_length(public.list_requests()),
		'has_agreements', exists (
			select 1 from public.agreements a
			where a.creator_id = v_uid or (a.counterparty_profile_id = v_uid and a.status <> 'personal')
		)
	);
end;
$$;

-- Payments in the detail say whether I reported them.
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

-- Grants ---------------------------------------------------------------------------------------------

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_agreement(uuid) to authenticated;

revoke all on function public.decide_payment(uuid, text) from public, anon;
revoke all on function public.withdraw_payment(uuid) from public, anon;
grant execute on function public.decide_payment(uuid, text) to authenticated;
grant execute on function public.withdraw_payment(uuid) to authenticated;
