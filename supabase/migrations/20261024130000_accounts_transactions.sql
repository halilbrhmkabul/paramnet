-- F4-03a: own accounts and cash records (design 21, 22, 29, 33, 36, 37; ADR-053).
-- Manual records only: nothing here holds or moves money, and none of it touches an agreement.
-- Balances are never stored; they are the opening balance plus every live record. Transfers and
-- adjustments ("Bakiye düzelt") move balances but are neither income nor expense.
-- Errors: SQLSTATE P0001 with the code as message (ADR-021).

create type public.account_kind as enum ('bank', 'cash', 'savings', 'other');
create type public.transaction_kind as enum ('expense', 'income', 'transfer', 'adjustment');

-- Same lists as packages/shared/src/accounts.ts (test-vectors/accounts.json).
create function private.is_category_for(p_kind public.transaction_kind, p_category text) returns boolean
language sql
immutable
set search_path = ''
as $$
	select coalesce(case p_kind
		when 'expense' then p_category = any (array['food', 'groceries', 'transport', 'bills', 'rent', 'health', 'clothing', 'other'])
		when 'income' then p_category = any (array['salary', 'freelance', 'rental_income', 'refund', 'other'])
		else false
	end, false);
$$;

-- Tables ---------------------------------------------------------------------------------------------------

-- No IBAN or account number, by design ("IBAN veya hesap numarası istemeyiz").
-- created_at is the clock, not the transaction start: lists keep the order accounts were added in.
create table public.accounts (
	id uuid primary key default gen_random_uuid(),
	owner_id uuid not null references public.profiles (id) on delete cascade,
	kind public.account_kind not null,
	name text not null check (char_length(name) between 1 and 40),
	bank_name text check (char_length(bank_name) between 1 and 40),
	opening_balance_minor bigint not null default 0 check (abs(opening_balance_minor) <= 10000000000000),
	include_in_total boolean not null default true,
	archived_at timestamptz,
	idempotency_key uuid unique,
	row_version int not null default 1,
	created_at timestamptz not null default clock_timestamp(),
	updated_at timestamptz not null default now()
);
create index accounts_owner_id_idx on public.accounts (owner_id, created_at);
alter table public.accounts enable row level security;

create table public.transactions (
	id uuid primary key default gen_random_uuid(),
	owner_id uuid not null references public.profiles (id) on delete cascade,
	kind public.transaction_kind not null,
	account_id uuid not null references public.accounts (id) on delete cascade,
	to_account_id uuid references public.accounts (id) on delete cascade,
	-- Signed only for adjustments (the difference to the balance the user typed).
	amount_minor bigint not null check (amount_minor <> 0 and abs(amount_minor) <= 10000000000000),
	category text,
	title text check (char_length(title) between 1 and 80),
	note text check (char_length(note) between 1 and 500),
	occurred_on date not null,
	idempotency_key uuid not null unique,
	-- Soft delete: "Sil" can be undone (design 37), and history stays consistent.
	deleted_at timestamptz,
	row_version int not null default 1,
	created_at timestamptz not null default clock_timestamp(),
	updated_at timestamptz not null default now(),
	check (kind = 'adjustment' or amount_minor > 0),
	check ((kind = 'transfer') = (to_account_id is not null)),
	check (to_account_id is distinct from account_id),
	check ((kind in ('expense', 'income')) = (category is not null)),
	check (category is null or private.is_category_for(kind, category))
);
create index transactions_owner_day_idx on public.transactions (owner_id, occurred_on desc, created_at desc);
create index transactions_account_id_idx on public.transactions (account_id);
create index transactions_to_account_id_idx on public.transactions (to_account_id) where to_account_id is not null;
alter table public.transactions enable row level security;

-- "Son düzenleme · kategori Diğer → Market" (design 37). Append only, like agreement_events.
create table public.transaction_events (
	id bigint generated always as identity primary key,
	transaction_id uuid not null references public.transactions (id) on delete cascade,
	owner_id uuid not null references public.profiles (id) on delete cascade,
	type text not null check (type in ('created', 'updated', 'deleted', 'restored')),
	changes jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default clock_timestamp()
);
create index transaction_events_transaction_id_idx on public.transaction_events (transaction_id, id);
create index transaction_events_owner_id_idx on public.transaction_events (owner_id);
alter table public.transaction_events enable row level security;

create trigger transaction_events_no_update before update on public.transaction_events
	for each row execute function public.reject_change();
create trigger transaction_events_no_delete before delete on public.transaction_events
	for each row execute function public.reject_change();

-- Helpers --------------------------------------------------------------------------------------------------

create function private.cash_invalid(p_detail text) returns void
language plpgsql
set search_path = ''
as $$
begin
	raise exception using message = 'validation_error', errcode = 'P0001', detail = p_detail;
end;
$$;

-- Integer kuruş within ±100 billion TL; p_positive for amounts, otherwise any sign (opening, target balance).
create function private.cash_amount(p_value jsonb, p_positive boolean) returns bigint
language plpgsql
immutable
set search_path = ''
as $$
declare
	v_number numeric;
begin
	if p_value is null or jsonb_typeof(p_value) <> 'number' then
		perform private.cash_invalid('amount');
	end if;
	v_number := (p_value #>> '{}')::numeric;
	if v_number <> trunc(v_number) or abs(v_number) > 10000000000000 or (p_positive and v_number <= 0) then
		perform private.cash_invalid('amount');
	end if;
	return v_number::bigint;
end;
$$;

create function private.json_uuid(p_value jsonb, p_detail text) returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
	if p_value is null or jsonb_typeof(p_value) = 'null' then
		return null;
	end if;
	if jsonb_typeof(p_value) <> 'string'
		or (p_value #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
		perform private.cash_invalid(p_detail);
	end if;
	return (p_value #>> '{}')::uuid;
end;
$$;

create function private.account_balance(p_account public.accounts) returns bigint
language sql
stable
set search_path = ''
as $$
	select (p_account.opening_balance_minor + coalesce((
		select sum(case
			when t.kind = 'transfer' and t.to_account_id = p_account.id then t.amount_minor
			when t.kind in ('expense', 'transfer') then -t.amount_minor
			else t.amount_minor
		end)
		from public.transactions t
		where t.deleted_at is null and (t.account_id = p_account.id or t.to_account_id = p_account.id)
	), 0))::bigint;
$$;

create function private.account_json(p_account public.accounts) returns jsonb
language sql
stable
set search_path = ''
as $$
	select jsonb_build_object(
		'id', p_account.id,
		'kind', p_account.kind,
		'name', p_account.name,
		'bank_name', p_account.bank_name,
		'opening_balance_minor', p_account.opening_balance_minor,
		'balance_minor', private.account_balance(p_account),
		'include_in_total', p_account.include_in_total,
		'archived_at', p_account.archived_at,
		'row_version', p_account.row_version,
		'created_at', p_account.created_at
	);
$$;

create function private.transaction_json(p_tx public.transactions) returns jsonb
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

-- The fields an edit can change, as compared for the history.
create function private.transaction_fields(p_tx public.transactions) returns jsonb
language sql
immutable
set search_path = ''
as $$
	select jsonb_build_object(
		'kind', p_tx.kind, 'account_id', p_tx.account_id, 'to_account_id', p_tx.to_account_id,
		'amount_minor', p_tx.amount_minor, 'category', p_tx.category, 'title', p_tx.title,
		'note', p_tx.note, 'occurred_on', p_tx.occurred_on
	);
$$;

create function private.parse_account_input(p_input jsonb) returns public.accounts
language plpgsql
stable
set search_path = ''
as $$
declare
	v_account public.accounts;
begin
	if jsonb_typeof(p_input) is distinct from 'object'
		or (select array_agg(k order by k) from jsonb_object_keys(p_input) as k)
			is distinct from array['bank_name', 'include_in_total', 'kind', 'name', 'opening_balance_minor'] then
		perform private.cash_invalid('input_keys');
	end if;
	if jsonb_typeof(p_input -> 'kind') is distinct from 'string'
		or not ((p_input ->> 'kind') = any (enum_range(null::public.account_kind)::text[])) then
		perform private.cash_invalid('kind');
	end if;
	if jsonb_typeof(p_input -> 'include_in_total') is distinct from 'boolean' then
		perform private.cash_invalid('include_in_total');
	end if;
	v_account.kind := (p_input ->> 'kind')::public.account_kind;
	v_account.name := private.check_text(p_input -> 'name', 40, true);
	v_account.bank_name := private.check_text(p_input -> 'bank_name', 40, false);
	v_account.opening_balance_minor := private.cash_amount(p_input -> 'opening_balance_minor', false);
	v_account.include_in_total := (p_input ->> 'include_in_total')::boolean;
	return v_account;
end;
$$;

-- An account the caller owns; archived ones take no new records (p_allow_archived for an unchanged account on edit).
create function private.own_account_for_write(p_uid uuid, p_id uuid, p_allow_archived boolean) returns public.accounts
language plpgsql
stable
set search_path = ''
as $$
declare
	v_account public.accounts;
begin
	select * into v_account from public.accounts where id = p_id and owner_id = p_uid;
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001', detail = 'account';
	end if;
	if v_account.archived_at is not null and not p_allow_archived then
		perform private.cash_invalid('account_archived');
	end if;
	return v_account;
end;
$$;

-- Expense, income or transfer from the form (design 22). p_old is the record being edited, if any.
create function private.parse_transaction_input(p_uid uuid, p_input jsonb, p_old public.transactions) returns public.transactions
language plpgsql
stable
set search_path = ''
as $$
declare
	v_tx public.transactions;
	v_category jsonb := p_input -> 'category';
	v_date text;
begin
	if jsonb_typeof(p_input) is distinct from 'object'
		or (select array_agg(k order by k) from jsonb_object_keys(p_input) as k)
			is distinct from array['account_id', 'amount_minor', 'category', 'kind', 'note', 'occurred_on', 'title', 'to_account_id'] then
		perform private.cash_invalid('input_keys');
	end if;
	if jsonb_typeof(p_input -> 'kind') is distinct from 'string'
		or (p_input ->> 'kind') not in ('expense', 'income', 'transfer') then
		perform private.cash_invalid('kind');
	end if;
	v_tx.kind := (p_input ->> 'kind')::public.transaction_kind;
	v_tx.account_id := private.json_uuid(p_input -> 'account_id', 'account_id');
	v_tx.to_account_id := private.json_uuid(p_input -> 'to_account_id', 'to_account_id');
	if v_tx.account_id is null then
		perform private.cash_invalid('account_id');
	end if;
	v_tx.amount_minor := private.cash_amount(p_input -> 'amount_minor', true);

	if jsonb_typeof(v_category) = 'string' then
		v_tx.category := v_category #>> '{}';
	elsif jsonb_typeof(v_category) is distinct from 'null' then
		perform private.cash_invalid('category');
	end if;
	if v_tx.kind = 'transfer' then
		if v_tx.to_account_id is null or v_tx.category is not null then
			perform private.cash_invalid('to_account_id');
		end if;
		if v_tx.to_account_id = v_tx.account_id then
			perform private.cash_invalid('same_account');
		end if;
	else
		if not private.is_category_for(v_tx.kind, v_tx.category) then
			perform private.cash_invalid('category');
		end if;
		if v_tx.to_account_id is not null then
			perform private.cash_invalid('to_account_id');
		end if;
	end if;

	v_tx.title := private.check_text(p_input -> 'title', 80, false);
	v_tx.note := private.check_text(p_input -> 'note', 500, false);

	if jsonb_typeof(p_input -> 'occurred_on') is distinct from 'string' then
		perform private.cash_invalid('occurred_on');
	end if;
	v_date := p_input ->> 'occurred_on';
	begin
		v_tx.occurred_on := v_date::date;
	exception when others then
		perform private.cash_invalid('occurred_on');
	end;
	-- Up to a year ahead: a record is what happened, not a plan (planned items come with F4-04).
	if to_char(v_tx.occurred_on, 'YYYY-MM-DD') <> v_date
		or v_tx.occurred_on not between date '2000-01-01' and private.today() + 366 then
		perform private.cash_invalid('occurred_on');
	end if;

	perform private.own_account_for_write(p_uid, v_tx.account_id,
		p_old.id is not null and v_tx.account_id in (p_old.account_id, p_old.to_account_id));
	if v_tx.to_account_id is not null then
		perform private.own_account_for_write(p_uid, v_tx.to_account_id,
			p_old.id is not null and v_tx.to_account_id in (p_old.account_id, p_old.to_account_id));
	end if;
	return v_tx;
end;
$$;

create function private.require_month(p_month date) returns date
language plpgsql
immutable
set search_path = ''
as $$
begin
	if p_month is null or p_month <> date_trunc('month', p_month)::date then
		perform private.cash_invalid('month');
	end if;
	return p_month;
end;
$$;

-- Accounts -------------------------------------------------------------------------------------------------

create function public.create_account(p_input jsonb, p_idempotency_key uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_input public.accounts;
	v_account public.accounts;
begin
	if p_idempotency_key is null then
		perform private.cash_invalid('idempotency_key');
	end if;
	select * into v_account from public.accounts where idempotency_key = p_idempotency_key;
	if found then
		if v_account.owner_id <> v_uid then
			raise exception using message = 'conflict', errcode = 'P0001';
		end if;
		return jsonb_build_object('account', private.account_json(v_account), 'replayed', true);
	end if;

	v_input := private.parse_account_input(p_input);
	-- Serialises concurrent creates so the limit holds.
	perform 1 from public.profiles where id = v_uid and deleted_at is null for update;
	if not found then
		raise exception using message = 'forbidden', errcode = 'P0001', detail = 'profile_required';
	end if;
	if (select count(*) from public.accounts where owner_id = v_uid and archived_at is null) >= 50 then
		perform private.cash_invalid('too_many_accounts');
	end if;

	insert into public.accounts (owner_id, kind, name, bank_name, opening_balance_minor, include_in_total, idempotency_key)
	values (v_uid, v_input.kind, v_input.name, v_input.bank_name, v_input.opening_balance_minor, v_input.include_in_total,
		p_idempotency_key)
	returning * into v_account;
	return jsonb_build_object('account', private.account_json(v_account), 'replayed', false);
end;
$$;

create function public.update_account(p_id uuid, p_input jsonb, p_row_version int) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_input public.accounts := private.parse_account_input(p_input);
	v_account public.accounts;
begin
	select * into v_account from public.accounts where id = p_id and owner_id = v_uid for update;
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if v_account.archived_at is not null then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if v_account.row_version <> p_row_version then
		raise exception using message = 'conflict', errcode = 'P0001';
	end if;
	update public.accounts
	set kind = v_input.kind, name = v_input.name, bank_name = v_input.bank_name,
		opening_balance_minor = v_input.opening_balance_minor, include_in_total = v_input.include_in_total,
		row_version = row_version + 1, updated_at = now()
	where id = p_id
	returning * into v_account;
	return jsonb_build_object('account', private.account_json(v_account));
end;
$$;

-- Archived accounts leave the list and Toplam Nakit; their records stay in the history.
create function public.archive_account(p_id uuid, p_row_version int) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_account public.accounts;
begin
	select * into v_account from public.accounts where id = p_id and owner_id = v_uid for update;
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if v_account.archived_at is not null then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if v_account.row_version <> p_row_version then
		raise exception using message = 'conflict', errcode = 'P0001';
	end if;
	update public.accounts
	set archived_at = now(), row_version = row_version + 1, updated_at = now()
	where id = p_id
	returning * into v_account;
	return jsonb_build_object('account', private.account_json(v_account));
end;
$$;

create function public.list_accounts() returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_items jsonb;
begin
	select coalesce(jsonb_agg(private.account_json(a) order by a.created_at, a.id), '[]'::jsonb) into v_items
	from public.accounts a
	where a.owner_id = v_uid and a.archived_at is null;
	return jsonb_build_object(
		'accounts', v_items,
		'total_cash_minor', (
			select coalesce(sum((x ->> 'balance_minor')::bigint), 0)
			from jsonb_array_elements(v_items) x where (x ->> 'include_in_total')::boolean
		),
		'included_count', (
			select count(*) from jsonb_array_elements(v_items) x where (x ->> 'include_in_total')::boolean
		)
	);
end;
$$;

-- "Bakiye düzelt": the user types the real balance; the difference is recorded, dated today.
create function public.adjust_account_balance(p_id uuid, p_target_balance_minor bigint, p_idempotency_key uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_account public.accounts;
	v_tx public.transactions;
	v_delta bigint;
begin
	if p_idempotency_key is null then
		perform private.cash_invalid('idempotency_key');
	end if;
	select * into v_tx from public.transactions where idempotency_key = p_idempotency_key;
	if found then
		if v_tx.owner_id <> v_uid then
			raise exception using message = 'conflict', errcode = 'P0001';
		end if;
		select * into v_account from public.accounts where id = v_tx.account_id;
		return jsonb_build_object('transaction', private.transaction_json(v_tx), 'account', private.account_json(v_account),
			'replayed', true);
	end if;

	select * into v_account from public.accounts where id = p_id and owner_id = v_uid for update;
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if v_account.archived_at is not null then
		perform private.cash_invalid('account_archived');
	end if;
	if p_target_balance_minor is null or abs(p_target_balance_minor) > 10000000000000 then
		perform private.cash_invalid('amount');
	end if;
	v_delta := p_target_balance_minor - private.account_balance(v_account);
	if v_delta = 0 then
		perform private.cash_invalid('no_change');
	end if;
	if abs(v_delta) > 10000000000000 then
		perform private.cash_invalid('amount');
	end if;

	insert into public.transactions (owner_id, kind, account_id, amount_minor, occurred_on, idempotency_key)
	values (v_uid, 'adjustment', v_account.id, v_delta, private.today(), p_idempotency_key)
	returning * into v_tx;
	insert into public.transaction_events (transaction_id, owner_id, type) values (v_tx.id, v_uid, 'created');
	return jsonb_build_object('transaction', private.transaction_json(v_tx), 'account', private.account_json(v_account),
		'replayed', false);
end;
$$;

-- Transactions ---------------------------------------------------------------------------------------------

create function public.create_transaction(p_input jsonb, p_idempotency_key uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_input public.transactions;
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

	v_input := private.parse_transaction_input(v_uid, p_input, null);
	insert into public.transactions (owner_id, kind, account_id, to_account_id, amount_minor, category, title, note,
		occurred_on, idempotency_key)
	values (v_uid, v_input.kind, v_input.account_id, v_input.to_account_id, v_input.amount_minor, v_input.category,
		v_input.title, v_input.note, v_input.occurred_on, p_idempotency_key)
	returning * into v_tx;
	insert into public.transaction_events (transaction_id, owner_id, type) values (v_tx.id, v_uid, 'created');
	return jsonb_build_object('transaction', private.transaction_json(v_tx), 'replayed', false);
end;
$$;

create function public.update_transaction(p_id uuid, p_input jsonb, p_row_version int) returns jsonb
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
	-- An adjustment is a correction to a balance, not a record to reshape: it can only be deleted.
	if v_old.deleted_at is not null or v_old.kind = 'adjustment' then
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
		amount_minor = v_input.amount_minor, category = v_input.category, title = v_input.title, note = v_input.note,
		occurred_on = v_input.occurred_on, row_version = row_version + 1, updated_at = now()
	where id = p_id
	returning * into v_tx;
	insert into public.transaction_events (transaction_id, owner_id, type, changes) values (v_tx.id, v_uid, 'updated', v_changes);
	return jsonb_build_object('transaction', private.transaction_json(v_tx));
end;
$$;

create function private.set_transaction_deleted(p_id uuid, p_row_version int, p_delete boolean) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_tx public.transactions;
begin
	select * into v_tx from public.transactions where id = p_id and owner_id = v_uid for update;
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if (v_tx.deleted_at is null) <> p_delete then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if v_tx.row_version <> p_row_version then
		raise exception using message = 'conflict', errcode = 'P0001';
	end if;
	update public.transactions
	set deleted_at = case when p_delete then now() end, row_version = row_version + 1, updated_at = now()
	where id = p_id
	returning * into v_tx;
	insert into public.transaction_events (transaction_id, owner_id, type)
	values (v_tx.id, v_uid, case when p_delete then 'deleted' else 'restored' end);
	return jsonb_build_object('transaction', private.transaction_json(v_tx));
end;
$$;

-- The app offers "Geri al" for 10 seconds (design 37); the server keeps the record until the account is erased.
create function public.delete_transaction(p_id uuid, p_row_version int) returns jsonb
language sql
security definer
set search_path = ''
as $$
	select private.set_transaction_deleted(p_id, p_row_version, true);
$$;

create function public.restore_transaction(p_id uuid, p_row_version int) returns jsonb
language sql
security definer
set search_path = ''
as $$
	select private.set_transaction_deleted(p_id, p_row_version, false);
$$;

create function public.get_transaction(p_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_tx public.transactions;
begin
	select * into v_tx from public.transactions where id = p_id and owner_id = v_uid;
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	return jsonb_build_object(
		'transaction', private.transaction_json(v_tx),
		'events', (
			select coalesce(jsonb_agg(jsonb_build_object('type', e.type, 'changes', e.changes, 'created_at', e.created_at)
				order by e.id), '[]'::jsonb)
			from public.transaction_events e where e.transaction_id = v_tx.id
		)
	);
end;
$$;

-- One month (design 36 "İşlem geçmişi · Ekim"), newest first; p_account_id narrows to one account (design 29).
create function public.list_transactions(p_month date, p_account_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_month date := private.require_month(p_month);
begin
	return (
		with month_tx as (
			select t.* from public.transactions t
			where t.owner_id = v_uid and t.deleted_at is null
				and t.occurred_on >= v_month and t.occurred_on < (v_month + interval '1 month')::date
				and (p_account_id is null or p_account_id in (t.account_id, t.to_account_id))
			order by t.occurred_on desc, t.created_at desc, t.id desc
			limit 1000
		)
		select jsonb_build_object(
			'items', coalesce(jsonb_agg(private.transaction_json(m) order by m.occurred_on desc, m.created_at desc, m.id desc), '[]'::jsonb),
			'income_minor', coalesce(sum(m.amount_minor) filter (where m.kind = 'income'), 0),
			'expense_minor', coalesce(sum(m.amount_minor) filter (where m.kind = 'expense'), 0)
		)
		from month_tx m
	);
end;
$$;

-- Home card (design 03): Toplam Nakit, how many accounts it covers, the month's income and expense.
create function public.get_cash_summary(p_month date) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_month date := private.require_month(p_month);
	v_accounts jsonb := public.list_accounts();
begin
	return jsonb_build_object(
		'total_cash_minor', v_accounts -> 'total_cash_minor',
		'account_count', v_accounts -> 'included_count',
		'income_minor', (
			select coalesce(sum(amount_minor), 0) from public.transactions
			where owner_id = v_uid and deleted_at is null and kind = 'income'
				and occurred_on >= v_month and occurred_on < (v_month + interval '1 month')::date
		),
		'expense_minor', (
			select coalesce(sum(amount_minor), 0) from public.transactions
			where owner_id = v_uid and deleted_at is null and kind = 'expense'
				and occurred_on >= v_month and occurred_on < (v_month + interval '1 month')::date
		),
		'updated_at', greatest(
			(select max(updated_at) from public.accounts where owner_id = v_uid),
			(select max(updated_at) from public.transactions where owner_id = v_uid)
		)
	);
end;
$$;

-- Account deletion and export cover accounts and records (ADR-039, ADR-053) ---------------------------------

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

	-- Own accounts and records are nobody else's; their history goes with them.
	delete from public.accounts where owner_id = p_uid;

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

revoke all on function public.create_account(jsonb, uuid) from public, anon;
revoke all on function public.update_account(uuid, jsonb, int) from public, anon;
revoke all on function public.archive_account(uuid, int) from public, anon;
revoke all on function public.list_accounts() from public, anon;
revoke all on function public.adjust_account_balance(uuid, bigint, uuid) from public, anon;
revoke all on function public.create_transaction(jsonb, uuid) from public, anon;
revoke all on function public.update_transaction(uuid, jsonb, int) from public, anon;
revoke all on function public.delete_transaction(uuid, int) from public, anon;
revoke all on function public.restore_transaction(uuid, int) from public, anon;
revoke all on function public.get_transaction(uuid) from public, anon;
revoke all on function public.list_transactions(date, uuid) from public, anon;
revoke all on function public.get_cash_summary(date) from public, anon;
grant execute on function public.create_account(jsonb, uuid) to authenticated;
grant execute on function public.update_account(uuid, jsonb, int) to authenticated;
grant execute on function public.archive_account(uuid, int) to authenticated;
grant execute on function public.list_accounts() to authenticated;
grant execute on function public.adjust_account_balance(uuid, bigint, uuid) to authenticated;
grant execute on function public.create_transaction(jsonb, uuid) to authenticated;
grant execute on function public.update_transaction(uuid, jsonb, int) to authenticated;
grant execute on function public.delete_transaction(uuid, int) to authenticated;
grant execute on function public.restore_transaction(uuid, int) to authenticated;
grant execute on function public.get_transaction(uuid) to authenticated;
grant execute on function public.list_transactions(date, uuid) to authenticated;
grant execute on function public.get_cash_summary(date) to authenticated;
