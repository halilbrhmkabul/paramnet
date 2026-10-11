-- F1-14: personal-mode write RPCs (paramnet-domain SKILL "RPC şablonu", state-machines.md).
-- Each runs in one transaction: lock → authorise → check transition → check row_version → write →
-- agreement_events → bump row_version. Errors: SQLSTATE P0001 with the code as message (ADR-021).

-- create_agreement replays by key, like payments do.
alter table public.agreements add column idempotency_key uuid unique;

-- Validation helpers ---------------------------------------------------------------------------------

-- Required text: already trimmed and NFC (the client sends shared zod output), length within limit.
create function private.check_text(p_value jsonb, p_max int, p_required boolean) returns text
language plpgsql
stable
set search_path = ''
as $$
declare
	v_text text;
begin
	if p_value is null or jsonb_typeof(p_value) = 'null' then
		if p_required then
			raise exception using message = 'validation_error', errcode = 'P0001', detail = 'required';
		end if;
		return null;
	end if;
	if jsonb_typeof(p_value) <> 'string' then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'not_text';
	end if;
	v_text := p_value #>> '{}';
	if v_text = '' or v_text <> btrim(v_text) or v_text <> normalize(v_text, nfc) or char_length(v_text) > p_max then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'text';
	end if;
	return v_text;
end;
$$;

create function private.today() returns date
language sql
stable
set search_path = ''
as $$
	-- BR-16: calendar days are Europe/Istanbul days.
	select (now() at time zone 'Europe/Istanbul')::date;
$$;

-- Terms must be exactly { principal_minor, down_payment_minor, plan, notes } (terms_hash covers all of
-- it, BR-15: no interest field can slip in). Returns the normalised terms.
create function private.parse_terms(p_terms jsonb) returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
	v_plan jsonb;
	v_rows jsonb;
begin
	if jsonb_typeof(p_terms) is distinct from 'object'
		or (select array_agg(k order by k) from jsonb_object_keys(p_terms) as k)
			<> array['down_payment_minor', 'notes', 'plan', 'principal_minor'] then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'terms_keys';
	end if;
	if jsonb_typeof(p_terms -> 'plan') <> 'array' then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'plan';
	end if;
	if exists (
		select 1 from jsonb_array_elements(p_terms -> 'plan') with ordinality as r(row, n)
		where jsonb_typeof(r.row) <> 'object'
			or (select array_agg(k order by k) from jsonb_object_keys(r.row) as k) <> array['amount_minor', 'due_date', 'seq']
			or r.row -> 'seq' <> to_jsonb(r.n)
	) then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'invalid_seq';
	end if;

	select coalesce(jsonb_agg(r.row - 'seq' order by r.n), '[]'::jsonb) into v_rows
	from jsonb_array_elements(p_terms -> 'plan') with ordinality as r(row, n);
	begin
		v_plan := private.validate_plan(jsonb_build_object(
			'principal', p_terms -> 'principal_minor',
			'down_payment', p_terms -> 'down_payment_minor',
			'installments', v_rows
		));
	exception when sqlstate 'P0001' then
		-- Keep the plan code for debugging; clients only need "validation_error".
		raise exception using message = 'validation_error', errcode = 'P0001', detail = sqlerrm;
	end;

	return jsonb_build_object(
		'principal_minor', p_terms -> 'principal_minor',
		'down_payment_minor', p_terms -> 'down_payment_minor',
		'plan', v_plan,
		'notes', to_jsonb(private.check_text(p_terms -> 'notes', 1000, false))
	);
end;
$$;

-- Writes one version's installments from normalised terms.
create function private.insert_installments(p_agreement_id uuid, p_version int, p_plan jsonb) returns void
language sql
set search_path = ''
as $$
	insert into public.installments (agreement_id, version, seq, due_date, amount_minor)
	select p_agreement_id, p_version, (r ->> 'seq')::int, (r ->> 'due_date')::date, (r ->> 'amount_minor')::bigint
	from jsonb_array_elements(p_plan) as r;
$$;

-- FIFO-allocates one payment onto the active version's installments (locked by the caller's agreement lock).
create function private.apply_allocation(p_agreement_id uuid, p_version int, p_payment_id uuid, p_amount bigint)
returns void
language plpgsql
set search_path = ''
as $$
declare
	v_allocation jsonb;
	v_row jsonb;
begin
	v_allocation := private.allocate_payment(jsonb_build_object(
		'amount', p_amount,
		'installments', (
			select coalesce(jsonb_agg(jsonb_build_object('seq', seq, 'amount_minor', amount_minor, 'paid_minor', paid_minor) order by seq), '[]'::jsonb)
			from public.installments
			where agreement_id = p_agreement_id and version = p_version
		)
	));
	for v_row in select value from jsonb_array_elements(v_allocation) loop
		update public.installments
		set paid_minor = paid_minor + (v_row ->> 'amount_minor')::bigint
		where agreement_id = p_agreement_id and version = p_version and seq = (v_row ->> 'seq')::int;
		insert into public.payment_allocations (payment_id, installment_id, amount_minor)
		select p_payment_id, id, (v_row ->> 'amount_minor')::bigint
		from public.installments
		where agreement_id = p_agreement_id and version = p_version and seq = (v_row ->> 'seq')::int;
	end loop;
end;
$$;

-- Locks the agreement and applies the checks every personal-mode write shares.
create function private.lock_personal_agreement(p_agreement_id uuid, p_row_version int)
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
	if not found or not (
		v_ag.creator_id = v_uid or (v_ag.counterparty_profile_id = v_uid and v_ag.status <> 'personal')
	) then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if v_ag.creator_id <> v_uid then
		raise exception using message = 'forbidden', errcode = 'P0001';
	end if;
	-- Faz 1 only has personal mode; shared transitions arrive in Faz 2 (F2-03, F2-07).
	if v_ag.status <> 'personal' then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if v_ag.row_version <> p_row_version then
		raise exception using message = 'conflict', errcode = 'P0001';
	end if;
	return v_ag;
end;
$$;

-- create_agreement ----------------------------------------------------------------------------------

create function public.create_agreement(input jsonb, idem_key uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
	v_existing public.agreements;
	v_me public.profiles;
	v_terms jsonb;
	v_kind public.agreement_kind;
	v_role public.party_role;
	v_title text;
	v_description text;
	v_started_on date;
	v_counterparty jsonb := input -> 'counterparty';
	v_contact_id uuid;
	v_contact_phone public.phone_tr;
	v_contact_kind public.contact_kind;
	v_agreement_id uuid;
	v_down bigint;
begin
	if v_uid is null then
		raise exception 'not_authenticated' using errcode = '28000';
	end if;
	if idem_key is null then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'idempotency_key';
	end if;

	select * into v_existing from public.agreements where idempotency_key = idem_key;
	if found then
		if v_existing.creator_id <> v_uid then
			raise exception using message = 'conflict', errcode = 'P0001';
		end if;
		return jsonb_build_object('agreement_id', v_existing.id, 'replayed', true);
	end if;

	select * into v_me from public.profiles where id = v_uid;
	if not found then
		raise exception using message = 'forbidden', errcode = 'P0001', detail = 'profile_required';
	end if;

	if jsonb_typeof(input) is distinct from 'object'
		or (select array_agg(k order by k) from jsonb_object_keys(input) as k)
			<> array['counterparty', 'creator_role', 'description', 'kind', 'started_on', 'terms', 'title'] then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'input_keys';
	end if;
	begin
		v_kind := (input ->> 'kind')::public.agreement_kind;
		v_role := (input ->> 'creator_role')::public.party_role;
	exception when invalid_text_representation then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'enum';
	end;
	if v_kind is null or v_role is null then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'enum';
	end if;
	v_title := private.check_text(input -> 'title', 80, true);
	v_description := private.check_text(input -> 'description', 500, false);
	if jsonb_typeof(input -> 'started_on') <> 'null' then
		v_started_on := private.try_date(input ->> 'started_on');
		if v_started_on is null then
			raise exception using message = 'validation_error', errcode = 'P0001', detail = 'started_on';
		end if;
	end if;
	v_terms := private.parse_terms(input -> 'terms');

	-- Counterparty: one of my contacts, or a new one.
	if jsonb_typeof(v_counterparty) = 'object' and v_counterparty ? 'contact_id' and not v_counterparty ? 'contact' then
		select id into v_contact_id
		from public.contacts
		where id = private.try_uuid(v_counterparty ->> 'contact_id') and owner_id = v_uid;
		if v_contact_id is null then
			raise exception using message = 'not_found', errcode = 'P0001';
		end if;
	elsif jsonb_typeof(v_counterparty -> 'contact') = 'object' and not v_counterparty ? 'contact_id' then
		begin
			v_contact_phone := nullif(v_counterparty -> 'contact' ->> 'phone_e164', '');
			v_contact_kind := coalesce((v_counterparty -> 'contact' ->> 'kind')::public.contact_kind, 'person');
		exception when check_violation or invalid_text_representation then
			raise exception using message = 'validation_error', errcode = 'P0001', detail = 'contact';
		end;
		-- BR-12: nobody makes an agreement with themselves.
		if v_contact_phone = v_me.phone_e164 then
			raise exception using message = 'validation_error', errcode = 'P0001', detail = 'self';
		end if;
		insert into public.contacts (owner_id, display_name, phone_e164, kind, linked_profile_id)
		values (
			v_uid,
			private.check_text(v_counterparty -> 'contact' -> 'display_name', 80, true),
			v_contact_phone,
			v_contact_kind,
			(select id from public.profiles where phone_e164 = v_contact_phone)
		)
		-- The same number is the same person for this owner: reuse the saved contact.
		on conflict (owner_id, phone_e164) do update set phone_e164 = excluded.phone_e164
		returning id into v_contact_id;
	else
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'counterparty';
	end if;

	v_down := (v_terms ->> 'down_payment_minor')::bigint;
	insert into public.agreements (
		creator_id, creator_role, counterparty_contact_id, kind, title, description, started_on,
		principal_minor, outstanding_minor, status, active_version, idempotency_key
	) values (
		v_uid, v_role, v_contact_id, v_kind, v_title, v_description, v_started_on,
		(v_terms ->> 'principal_minor')::bigint, (v_terms ->> 'principal_minor')::bigint - v_down,
		'personal', 1, idem_key
	)
	returning id into v_agreement_id;

	-- In personal mode the owner's own terms are the accepted version.
	insert into public.agreement_versions (agreement_id, version, terms, terms_hash, proposed_by, status)
	values (v_agreement_id, 1, v_terms, private.terms_hash(v_terms), v_uid, 'accepted');
	perform private.insert_installments(v_agreement_id, 1, v_terms -> 'plan');

	-- The down payment is a payment that counts as confirmed from the start (spec 5.2); it is not
	-- allocated, because the installments only cover what remains after it.
	if v_down > 0 then
		insert into public.payments (agreement_id, amount_minor, paid_on, method, kind, status, reported_by, idempotency_key)
		values (v_agreement_id, v_down, coalesce(v_started_on, private.today()), 'other', 'down_payment', 'confirmed', v_uid, gen_random_uuid());
	end if;

	insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
	values (v_agreement_id, v_uid, 'app', 'created', 1);

	return jsonb_build_object('agreement_id', v_agreement_id, 'replayed', false);
end;
$$;

create function private.try_uuid(p_value text) returns uuid
language plpgsql
stable
set search_path = ''
as $$
begin
	return p_value::uuid;
exception when others then
	return null;
end;
$$;

-- record_payment (personal mode) ---------------------------------------------------------------------

create function public.record_payment(
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
	v_amount bigint;
	v_paid_on date;
	v_method public.payment_method;
	v_note text;
	v_payment_id uuid;
	v_settled boolean;
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

	v_ag := private.lock_personal_agreement(p_agreement_id, p_row_version);

	if jsonb_typeof(p_input) is distinct from 'object'
		or (select array_agg(k order by k) from jsonb_object_keys(p_input) as k) <> array['amount_minor', 'method', 'note', 'paid_on'] then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'input_keys';
	end if;
	if not private.is_minor(p_input -> 'amount_minor') or (p_input ->> 'amount_minor')::numeric = 0 then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'amount';
	end if;
	v_amount := (p_input ->> 'amount_minor')::bigint;
	v_paid_on := private.try_date(p_input ->> 'paid_on');
	-- ADR-018: a payment cannot be dated in the future.
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

	-- Personal mode: the owner's record is the truth, so it is confirmed at once (spec 5.5).
	insert into public.payments (agreement_id, amount_minor, paid_on, method, kind, status, note, reported_by, idempotency_key)
	values (p_agreement_id, v_amount, v_paid_on, v_method, 'payment', 'confirmed', v_note, v_uid, p_idempotency_key)
	returning id into v_payment_id;
	perform private.apply_allocation(p_agreement_id, v_ag.active_version, v_payment_id, v_amount);

	insert into public.agreement_events (agreement_id, actor_id, channel, type, version, payload)
	values (p_agreement_id, v_uid, 'app', 'payment_recorded', v_ag.active_version,
		jsonb_build_object('payment_id', v_payment_id, 'amount_minor', v_amount));

	-- Closing happens in the same transaction as the last payment (business-rules "Kapanış").
	v_settled := v_ag.outstanding_minor - v_amount = 0;
	update public.agreements
	set outstanding_minor = outstanding_minor - v_amount,
		status = case when v_settled then 'settled'::public.agreement_status else status end,
		settled_at = case when v_settled then now() else settled_at end,
		row_version = row_version + 1
	where id = p_agreement_id;
	if v_settled then
		insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
		values (p_agreement_id, null, 'system', 'settled', v_ag.active_version);
	end if;

	return jsonb_build_object('payment_id', v_payment_id, 'status', 'confirmed', 'replayed', false, 'settled', v_settled);
end;
$$;

-- update_personal_agreement ---------------------------------------------------------------------------

-- New version from edited terms. The down payment is a recorded payment, so it cannot change here; every
-- other confirmed payment is re-allocated FIFO onto the new installments.
create function public.update_personal_agreement(p_id uuid, p_terms jsonb, p_row_version int) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
	v_ag public.agreements;
	v_terms jsonb;
	v_current_down bigint;
	v_paid bigint;
	v_version int;
	v_payment record;
	v_outstanding bigint;
begin
	v_ag := private.lock_personal_agreement(p_id, p_row_version);
	v_terms := private.parse_terms(p_terms);

	select (terms ->> 'down_payment_minor')::bigint into v_current_down
	from public.agreement_versions where agreement_id = p_id and version = v_ag.active_version;
	if (v_terms ->> 'down_payment_minor')::bigint <> v_current_down then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'down_payment_locked';
	end if;

	select coalesce(sum(amount_minor), 0) into v_paid
	from public.payments
	where agreement_id = p_id and status = 'confirmed' and kind <> 'down_payment';
	v_outstanding := (v_terms ->> 'principal_minor')::bigint - v_current_down - v_paid;
	if v_outstanding < 0 then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'paid_exceeds_total';
	end if;

	v_version := v_ag.active_version + 1;
	update public.agreement_versions set status = 'superseded' where agreement_id = p_id and version = v_ag.active_version;
	insert into public.agreement_versions (agreement_id, version, terms, terms_hash, proposed_by, status)
	values (p_id, v_version, v_terms, private.terms_hash(v_terms), v_uid, 'accepted');
	perform private.insert_installments(p_id, v_version, v_terms -> 'plan');

	-- Earlier allocations stay attached to the old version's installments as history.
	for v_payment in
		select id, amount_minor from public.payments
		where agreement_id = p_id and status = 'confirmed' and kind <> 'down_payment'
		order by paid_on, created_at, id
	loop
		perform private.apply_allocation(p_id, v_version, v_payment.id, v_payment.amount_minor);
	end loop;

	update public.agreements
	set principal_minor = (v_terms ->> 'principal_minor')::bigint,
		outstanding_minor = v_outstanding,
		active_version = v_version,
		status = case when v_outstanding = 0 then 'settled'::public.agreement_status else status end,
		settled_at = case when v_outstanding = 0 then now() else settled_at end,
		row_version = row_version + 1
	where id = p_id;

	insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
	values (p_id, v_uid, 'app', 'updated', v_version);
	if v_outstanding = 0 then
		insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
		values (p_id, null, 'system', 'settled', v_version);
	end if;

	return jsonb_build_object('version', v_version);
end;
$$;

-- cancel_agreement (personal mode only; shared ones need both sides, F2-09) ---------------------------

create function public.cancel_agreement(p_id uuid, p_row_version int) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_ag public.agreements;
begin
	v_ag := private.lock_personal_agreement(p_id, p_row_version);
	update public.agreements
	set status = 'cancelled', cancelled_at = now(), row_version = row_version + 1
	where id = p_id;
	insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
	values (p_id, auth.uid(), 'app', 'cancelled', v_ag.active_version);
	return jsonb_build_object('status', 'cancelled');
end;
$$;

-- Grants ---------------------------------------------------------------------------------------------

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_agreement(uuid) to authenticated;

revoke all on function public.create_agreement(jsonb, uuid) from public, anon;
revoke all on function public.record_payment(uuid, jsonb, int, uuid) from public, anon;
revoke all on function public.update_personal_agreement(uuid, jsonb, int) from public, anon;
revoke all on function public.cancel_agreement(uuid, int) from public, anon;
grant execute on function public.create_agreement(jsonb, uuid) to authenticated;
grant execute on function public.record_payment(uuid, jsonb, int, uuid) to authenticated;
grant execute on function public.update_personal_agreement(uuid, jsonb, int) to authenticated;
grant execute on function public.cancel_agreement(uuid, int) to authenticated;
