-- F4-06: the user's own bank loans (design 28, 34; ADR-056). Interest is computed only to show the plan
-- (ADR-045); a loan never touches an agreement. An installment is a transfer from an account to the loan.

create table public.loans (
	id uuid primary key default gen_random_uuid(),
	owner_id uuid not null references public.profiles (id) on delete cascade,
	bank_name text not null check (char_length(bank_name) between 1 and 40),
	loan_type text not null check (char_length(loan_type) between 1 and 40),
	principal_minor bigint not null check (principal_minor > 0 and principal_minor <= 10000000000000),
	-- Hundredths of a percent a month: 339 = %3,39.
	monthly_rate_bps int not null check (monthly_rate_bps between 0 and 2000),
	term_months int not null check (term_months between 1 and 120),
	first_due_on date not null,
	installment_minor bigint not null check (installment_minor > 0 and installment_minor <= 10000000000000),
	payment_account_id uuid references public.accounts (id) on delete set null,
	archived_at timestamptz,
	idempotency_key uuid unique,
	row_version int not null default 1,
	created_at timestamptz not null default clock_timestamp(),
	updated_at timestamptz not null default now()
);
create index loans_owner_id_idx on public.loans (owner_id, created_at);
create index loans_payment_account_id_idx on public.loans (payment_account_id) where payment_account_id is not null;
alter table public.loans enable row level security;

alter table public.transactions add column to_loan_id uuid references public.loans (id) on delete cascade;
create index transactions_to_loan_id_idx on public.transactions (to_loan_id) where to_loan_id is not null;
alter table public.transactions drop constraint transactions_target_check;
alter table public.transactions add constraint transactions_target_check check (
	case kind
		when 'transfer' then account_id is not null and card_id is null
			and (to_account_id is not null)::int + (to_card_id is not null)::int + (to_loan_id is not null)::int = 1
		when 'adjustment' then account_id is not null and card_id is null and to_account_id is null and to_card_id is null
			and to_loan_id is null
		else ((account_id is not null) <> (card_id is not null)) and to_account_id is null and to_card_id is null
			and to_loan_id is null
	end
);

-- The plan, the same as packages/shared/src/loans.ts (test-vectors/loans.json) ------------------------------

-- Half up to the kuruş.
create function private.round_div(p_numerator numeric, p_denominator numeric) returns bigint
language sql
immutable
set search_path = ''
as $$
	select floor((p_numerator * 2 + p_denominator) / (2 * p_denominator))::bigint;
$$;

-- P·r / (1 − (1 + r)^−n) with r = bps / 10000, in exact numeric (no floating point).
create function private.loan_payment(p_principal bigint, p_rate_bps int, p_term int) returns bigint
language plpgsql
immutable
set search_path = ''
as $$
declare
	v_a numeric := 1;
	v_b numeric := 1;
begin
	if p_rate_bps = 0 then
		return private.round_div(p_principal, p_term);
	end if;
	for k in 1..p_term loop
		v_a := v_a * (10000 + p_rate_bps);
		v_b := v_b * 10000;
	end loop;
	return private.round_div(p_principal::numeric * p_rate_bps * v_a, 10000 * (v_a - v_b));
end;
$$;

create function private.loan_schedule(p_principal bigint, p_rate_bps int, p_term int, p_first date, p_installment bigint)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
	v_balance bigint := p_principal;
	v_interest bigint;
	v_principal bigint;
	v_rows jsonb := '[]'::jsonb;
begin
	for k in 1..p_term loop
		v_interest := private.round_div(v_balance::numeric * p_rate_bps, 10000);
		v_principal := greatest(0, p_installment - v_interest);
		if k = p_term or v_principal > v_balance then
			v_principal := v_balance;
		end if;
		v_balance := v_balance - v_principal;
		v_rows := v_rows || jsonb_build_object('seq', k, 'due_date', (p_first + make_interval(months => k - 1))::date,
			'payment_minor', v_principal + v_interest, 'principal_minor', v_principal, 'interest_minor', v_interest,
			'balance_minor', v_balance);
	end loop;
	return v_rows;
end;
$$;

-- Loans ---------------------------------------------------------------------------------------------------

create function private.loan_json(p_loan public.loans) returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
	v_rows jsonb := private.loan_schedule(p_loan.principal_minor, p_loan.monthly_rate_bps, p_loan.term_months,
		p_loan.first_due_on, p_loan.installment_minor);
	v_paid int := least(p_loan.term_months, (select count(*)::int from public.transactions t
		where t.to_loan_id = p_loan.id and t.deleted_at is null));
	v_total bigint := (select sum((r ->> 'payment_minor')::bigint) from jsonb_array_elements(v_rows) r);
begin
	return jsonb_build_object(
		'id', p_loan.id,
		'bank_name', p_loan.bank_name,
		'loan_type', p_loan.loan_type,
		'principal_minor', p_loan.principal_minor,
		'monthly_rate_bps', p_loan.monthly_rate_bps,
		'term_months', p_loan.term_months,
		'first_due_on', p_loan.first_due_on,
		'installment_minor', p_loan.installment_minor,
		'payment_account_id', p_loan.payment_account_id,
		'payment_account_name', (select a.name from public.accounts a where a.id = p_loan.payment_account_id),
		'archived_at', p_loan.archived_at,
		'row_version', p_loan.row_version,
		'created_at', p_loan.created_at,
		'schedule', v_rows,
		'paid', v_paid,
		'remaining_principal_minor', case when v_paid = 0 then p_loan.principal_minor
			else (v_rows -> (v_paid - 1) ->> 'balance_minor')::bigint end,
		'remaining_total_minor', (select coalesce(sum((r ->> 'payment_minor')::bigint), 0)
			from jsonb_array_elements(v_rows) with ordinality x(r, n) where x.n > v_paid),
		'total_payment_minor', v_total,
		'total_interest_minor', v_total - p_loan.principal_minor,
		'next', v_rows -> v_paid
	);
end;
$$;

create function private.parse_loan_input(p_uid uuid, p_input jsonb) returns public.loans
language plpgsql
stable
set search_path = ''
as $$
declare
	v_loan public.loans;
	v_key text;
	v_date text;
begin
	if jsonb_typeof(p_input) is distinct from 'object'
		or (select array_agg(k order by k) from jsonb_object_keys(p_input) as k)
			is distinct from array['bank_name', 'first_due_on', 'installment_minor', 'loan_type', 'monthly_rate_bps',
				'payment_account_id', 'principal_minor', 'term_months'] then
		perform private.cash_invalid('input_keys');
	end if;
	v_loan.bank_name := private.check_text(p_input -> 'bank_name', 40, true);
	v_loan.loan_type := private.check_text(p_input -> 'loan_type', 40, true);
	v_loan.principal_minor := private.cash_amount(p_input -> 'principal_minor', true);
	v_loan.installment_minor := private.cash_amount(p_input -> 'installment_minor', true);
	foreach v_key in array array['monthly_rate_bps', 'term_months'] loop
		if jsonb_typeof(p_input -> v_key) is distinct from 'number'
			or (p_input ->> v_key)::numeric <> trunc((p_input ->> v_key)::numeric) then
			perform private.cash_invalid(v_key);
		end if;
	end loop;
	v_loan.monthly_rate_bps := (p_input ->> 'monthly_rate_bps')::int;
	v_loan.term_months := (p_input ->> 'term_months')::int;
	if v_loan.monthly_rate_bps not between 0 and 2000 then
		perform private.cash_invalid('monthly_rate_bps');
	end if;
	if v_loan.term_months not between 1 and 120 then
		perform private.cash_invalid('term_months');
	end if;
	if jsonb_typeof(p_input -> 'first_due_on') is distinct from 'string' then
		perform private.cash_invalid('first_due_on');
	end if;
	v_date := p_input ->> 'first_due_on';
	begin
		v_loan.first_due_on := v_date::date;
	exception when others then
		perform private.cash_invalid('first_due_on');
	end;
	if to_char(v_loan.first_due_on, 'YYYY-MM-DD') <> v_date or v_loan.first_due_on < date '2000-01-01' then
		perform private.cash_invalid('first_due_on');
	end if;
	v_loan.payment_account_id := private.json_uuid(p_input -> 'payment_account_id', 'payment_account_id');
	if v_loan.payment_account_id is not null then
		perform private.own_account_for_write(p_uid, v_loan.payment_account_id, false);
	end if;
	return v_loan;
end;
$$;

create function public.create_loan(p_input jsonb, p_idempotency_key uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_input public.loans;
	v_loan public.loans;
begin
	if p_idempotency_key is null then
		perform private.cash_invalid('idempotency_key');
	end if;
	select * into v_loan from public.loans where idempotency_key = p_idempotency_key;
	if found then
		if v_loan.owner_id <> v_uid then
			raise exception using message = 'conflict', errcode = 'P0001';
		end if;
		return jsonb_build_object('loan', private.loan_json(v_loan), 'replayed', true);
	end if;
	v_input := private.parse_loan_input(v_uid, p_input);
	perform 1 from public.profiles where id = v_uid and deleted_at is null for update;
	if not found then
		raise exception using message = 'forbidden', errcode = 'P0001', detail = 'profile_required';
	end if;
	if (select count(*) from public.loans where owner_id = v_uid and archived_at is null) >= 20 then
		perform private.cash_invalid('too_many_loans');
	end if;
	insert into public.loans (owner_id, bank_name, loan_type, principal_minor, monthly_rate_bps, term_months,
		first_due_on, installment_minor, payment_account_id, idempotency_key)
	values (v_uid, v_input.bank_name, v_input.loan_type, v_input.principal_minor, v_input.monthly_rate_bps,
		v_input.term_months, v_input.first_due_on, v_input.installment_minor, v_input.payment_account_id, p_idempotency_key)
	returning * into v_loan;
	return jsonb_build_object('loan', private.loan_json(v_loan), 'replayed', false);
end;
$$;

create function public.update_loan(p_id uuid, p_input jsonb, p_row_version int) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_input public.loans := private.parse_loan_input(v_uid, p_input);
	v_loan public.loans;
begin
	select * into v_loan from public.loans where id = p_id and owner_id = v_uid for update;
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if v_loan.archived_at is not null then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if v_loan.row_version <> p_row_version then
		raise exception using message = 'conflict', errcode = 'P0001';
	end if;
	update public.loans
	set bank_name = v_input.bank_name, loan_type = v_input.loan_type, principal_minor = v_input.principal_minor,
		monthly_rate_bps = v_input.monthly_rate_bps, term_months = v_input.term_months,
		first_due_on = v_input.first_due_on, installment_minor = v_input.installment_minor,
		payment_account_id = v_input.payment_account_id, row_version = row_version + 1, updated_at = now()
	where id = p_id
	returning * into v_loan;
	return jsonb_build_object('loan', private.loan_json(v_loan));
end;
$$;

create function public.archive_loan(p_id uuid, p_row_version int) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_loan public.loans;
begin
	select * into v_loan from public.loans where id = p_id and owner_id = v_uid for update;
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if v_loan.archived_at is not null then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if v_loan.row_version <> p_row_version then
		raise exception using message = 'conflict', errcode = 'P0001';
	end if;
	update public.loans set archived_at = now(), row_version = row_version + 1, updated_at = now()
	where id = p_id returning * into v_loan;
	return jsonb_build_object('loan', private.loan_json(v_loan));
end;
$$;

create function public.list_loans() returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_items jsonb;
begin
	select coalesce(jsonb_agg(private.loan_json(l) order by l.created_at, l.id), '[]'::jsonb) into v_items
	from public.loans l where l.owner_id = v_uid and l.archived_at is null;
	return jsonb_build_object(
		'loans', v_items,
		'remaining_principal_minor', (select coalesce(sum((i ->> 'remaining_principal_minor')::bigint), 0) from jsonb_array_elements(v_items) i),
		'monthly_minor', (select coalesce(sum((i -> 'next' ->> 'payment_minor')::bigint), 0) from jsonb_array_elements(v_items) i)
	);
end;
$$;

create function public.get_loan(p_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_loan public.loans;
begin
	select * into v_loan from public.loans where id = p_id and owner_id = v_uid;
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	return jsonb_build_object(
		'loan', private.loan_json(v_loan),
		'payments', (
			select coalesce(jsonb_agg(private.transaction_json(t) order by t.occurred_on desc, t.created_at desc), '[]'::jsonb)
			from public.transactions t where t.to_loan_id = v_loan.id and t.deleted_at is null
		)
	);
end;
$$;

-- "Taksit ödedim kaydet" (design 28): the next installment's amount, from an account, as a transfer.
create function public.record_loan_payment(p_loan_id uuid, p_account_id uuid, p_paid_on date, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_loan public.loans;
	v_next jsonb;
	v_tx public.transactions;
begin
	if p_idempotency_key is null then
		perform private.cash_invalid('idempotency_key');
	end if;
	select * into v_tx from public.transactions where idempotency_key = p_idempotency_key;
	if found then
		if v_tx.owner_id <> v_uid then
			raise exception using message = 'conflict', errcode = 'P0001';
		end if;
		return jsonb_build_object('transaction', private.transaction_json(v_tx), 'replayed', true);
	end if;
	select * into v_loan from public.loans where id = p_loan_id and owner_id = v_uid for update;
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if v_loan.archived_at is not null then
		perform private.cash_invalid('loan_archived');
	end if;
	perform private.own_account_for_write(v_uid, p_account_id, false);
	if p_paid_on is null or p_paid_on not between date '2000-01-01' and private.today() + 366 then
		perform private.cash_invalid('occurred_on');
	end if;
	v_next := private.loan_json(v_loan) -> 'next';
	if v_next is null or jsonb_typeof(v_next) = 'null' then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	insert into public.transactions (owner_id, kind, account_id, to_loan_id, amount_minor, title, occurred_on, idempotency_key)
	values (v_uid, 'transfer', p_account_id, v_loan.id, (v_next ->> 'payment_minor')::bigint,
		v_loan.loan_type || ' ' || (v_next ->> 'seq') || '/' || v_loan.term_months, p_paid_on, p_idempotency_key)
	returning * into v_tx;
	insert into public.transaction_events (transaction_id, owner_id, type) values (v_tx.id, v_uid, 'created');
	return jsonb_build_object('transaction', private.transaction_json(v_tx), 'replayed', false);
end;
$$;

-- Transactions name the loan they pay; such records are only deleted ----------------------------------------

create or replace function private.transaction_json(p_tx public.transactions) returns jsonb
language sql
stable
set search_path = ''
as $$
	select jsonb_build_object(
		'id', p_tx.id,
		'kind', p_tx.kind,
		'account_id', p_tx.account_id,
		'account_name', (select a.name from public.accounts a where a.id = p_tx.account_id),
		'to_account_id', p_tx.to_account_id,
		'to_account_name', (select a.name from public.accounts a where a.id = p_tx.to_account_id),
		'card_id', p_tx.card_id,
		'card_name', (select private.card_label(c) from public.cards c where c.id = p_tx.card_id),
		'to_card_id', p_tx.to_card_id,
		'to_card_name', (select private.card_label(c) from public.cards c where c.id = p_tx.to_card_id),
		'installments', p_tx.installments,
		'to_loan_id', p_tx.to_loan_id,
		'to_loan_name', (select l.bank_name || ' · ' || l.loan_type from public.loans l where l.id = p_tx.to_loan_id),
		'amount_minor', p_tx.amount_minor,
		'category', p_tx.category,
		'title', p_tx.title,
		'note', p_tx.note,
		'occurred_on', p_tx.occurred_on,
		'deleted_at', p_tx.deleted_at,
		'row_version', p_tx.row_version,
		'created_at', p_tx.created_at,
		'updated_at', p_tx.updated_at
	);
$$;

create or replace function public.update_transaction(p_id uuid, p_input jsonb, p_row_version int) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_old public.transactions;
	v_input public.transactions;
	v_tx public.transactions;
	v_changes jsonb;
begin
	select * into v_old from public.transactions where id = p_id and owner_id = v_uid for update;
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	-- An adjustment is a correction to a balance and a loan installment follows its plan: both are only deleted.
	if v_old.deleted_at is not null or v_old.kind = 'adjustment' or v_old.to_loan_id is not null then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if v_old.row_version <> p_row_version then
		raise exception using message = 'conflict', errcode = 'P0001';
	end if;

	v_input := private.parse_transaction_input(v_uid, p_input, v_old);
	v_input.id := v_old.id;
	select coalesce(jsonb_object_agg(o.key, jsonb_build_array(o.value, n.value)), '{}'::jsonb) into v_changes
	from jsonb_each(private.transaction_fields(v_old)) o
	join jsonb_each(private.transaction_fields(v_input)) n using (key)
	where o.value is distinct from n.value;
	if v_changes = '{}'::jsonb then
		return jsonb_build_object('transaction', private.transaction_json(v_old));
	end if;

	update public.transactions
	set kind = v_input.kind, account_id = v_input.account_id, to_account_id = v_input.to_account_id,
		card_id = v_input.card_id, to_card_id = v_input.to_card_id, installments = v_input.installments,
		amount_minor = v_input.amount_minor, category = v_input.category, title = v_input.title, note = v_input.note,
		occurred_on = v_input.occurred_on, row_version = row_version + 1, updated_at = now()
	where id = p_id
	returning * into v_tx;
	insert into public.transaction_events (transaction_id, owner_id, type, changes) values (v_tx.id, v_uid, 'updated', v_changes);
	return jsonb_build_object('transaction', private.transaction_json(v_tx));
end;
$$;

-- Account deletion and export cover loans (ADR-039, ADR-056) ------------------------------------------------

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

	-- Own accounts and records are nobody else's; their history and repeating rules go with them.
	delete from public.accounts where owner_id = p_uid;
	delete from public.budgets where owner_id = p_uid;
	delete from public.cards where owner_id = p_uid;
	delete from public.loans where owner_id = p_uid;

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
		'accounts', (
			select coalesce(jsonb_agg(private.account_json(a) order by a.created_at), '[]'::jsonb)
			from public.accounts a where a.owner_id = v_uid
		),
		'transactions', (
			select coalesce(jsonb_agg(private.transaction_json(t) order by t.occurred_on, t.created_at), '[]'::jsonb)
			from public.transactions t where t.owner_id = v_uid
		),
		'cards', (
			select coalesce(jsonb_agg(private.card_json(c) order by c.created_at), '[]'::jsonb)
			from public.cards c where c.owner_id = v_uid
		),
		'loans', (
			select coalesce(jsonb_agg(private.loan_json(l) order by l.created_at), '[]'::jsonb)
			from public.loans l where l.owner_id = v_uid
		),
		'recurring_rules', (
			select coalesce(jsonb_agg(private.recurring_json(r) order by r.created_at), '[]'::jsonb)
			from public.recurring_rules r where r.owner_id = v_uid
		),
		'budgets', (
			select coalesce(jsonb_agg(jsonb_build_object('category', b.category, 'limit_minor', b.limit_minor)
				order by b.category), '[]'::jsonb)
			from public.budgets b where b.owner_id = v_uid
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

revoke all on function public.create_loan(jsonb, uuid) from public, anon;
revoke all on function public.update_loan(uuid, jsonb, int) from public, anon;
revoke all on function public.archive_loan(uuid, int) from public, anon;
revoke all on function public.list_loans() from public, anon;
revoke all on function public.get_loan(uuid) from public, anon;
revoke all on function public.record_loan_payment(uuid, uuid, date, uuid) from public, anon;
grant execute on function public.create_loan(jsonb, uuid) to authenticated;
grant execute on function public.update_loan(uuid, jsonb, int) to authenticated;
grant execute on function public.archive_loan(uuid, int) to authenticated;
grant execute on function public.list_loans() to authenticated;
grant execute on function public.get_loan(uuid) to authenticated;
grant execute on function public.record_loan_payment(uuid, uuid, date, uuid) to authenticated;
