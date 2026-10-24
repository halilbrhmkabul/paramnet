-- F4-05: credit cards tracked by hand (design 07, 08, 09, 32, 11; ADR-055).
-- No card number, CVV or password; no interest. A card purchase is an expense once; paying the card is a
-- transfer from an account (not an expense). Statements are derived, never stored.

create type public.card_color as enum ('navy', 'graphite', 'midnight', 'bordeaux');

create table public.cards (
	id uuid primary key default gen_random_uuid(),
	owner_id uuid not null references public.profiles (id) on delete cascade,
	bank_name text not null check (char_length(bank_name) between 1 and 40),
	card_name text check (char_length(card_name) between 1 and 40),
	last4 text not null check (last4 ~ '^[0-9]{4}$'),
	color public.card_color not null default 'navy',
	limit_minor bigint not null check (limit_minor > 0 and limit_minor <= 10000000000000),
	opening_debt_minor bigint not null default 0 check (opening_debt_minor >= 0 and opening_debt_minor <= 10000000000000),
	statement_day int not null check (statement_day between 1 and 28),
	due_offset_days int not null default 10 check (due_offset_days between 1 and 28),
	min_payment_rate int not null default 20 check (min_payment_rate between 1 and 100),
	archived_at timestamptz,
	idempotency_key uuid unique,
	row_version int not null default 1,
	created_at timestamptz not null default clock_timestamp(),
	updated_at timestamptz not null default now()
);
create index cards_owner_id_idx on public.cards (owner_id, created_at);
alter table public.cards enable row level security;

-- Card purchases and refunds sit on a card instead of an account; a card payment is a transfer to a card.
alter table public.transactions
	alter column account_id drop not null,
	add column card_id uuid references public.cards (id) on delete cascade,
	add column to_card_id uuid references public.cards (id) on delete cascade,
	add column installments int not null default 1 check (installments between 1 and 36);
create index transactions_card_id_idx on public.transactions (card_id) where card_id is not null;
create index transactions_to_card_id_idx on public.transactions (to_card_id) where to_card_id is not null;

alter table public.transactions drop constraint transactions_check1;
-- A card record has no account: "distinct from" would see two nulls as the same account.
alter table public.transactions drop constraint transactions_check2;
alter table public.transactions add constraint transactions_transfer_accounts_check
	check (to_account_id is null or to_account_id <> account_id);
alter table public.transactions add constraint transactions_target_check check (
	case kind
		when 'transfer' then account_id is not null and card_id is null
			and ((to_account_id is not null) <> (to_card_id is not null))
		when 'adjustment' then account_id is not null and card_id is null and to_account_id is null and to_card_id is null
		else ((account_id is not null) <> (card_id is not null)) and to_account_id is null and to_card_id is null
	end
);
alter table public.transactions add constraint transactions_card_installments_check
	check (installments = 1 or (kind = 'expense' and card_id is not null));

-- Statement arithmetic, the same as packages/shared/src/cards.ts (test-vectors/cards.json) ------------------

create function private.card_cuts(p_today date, p_statement_day int) returns jsonb
language sql
immutable
set search_path = ''
as $$
	with c as (
		select case
			when extract(day from p_today)::int >= p_statement_day
				then make_date(extract(year from p_today)::int, extract(month from p_today)::int, p_statement_day)
			else (make_date(extract(year from p_today)::int, extract(month from p_today)::int, p_statement_day) - interval '1 month')::date
		end as last
	)
	select jsonb_build_object('last', last, 'next', (last + interval '1 month')::date) from c;
$$;

-- Equal parts; the kuruş left over goes on the first part.
create function private.installment_parts(p_amount bigint, p_count int) returns bigint[]
language sql
immutable
set search_path = ''
as $$
	select array_agg(case when k = 0 then p_amount - (p_amount / p_count) * (p_count - 1) else p_amount / p_count end order by k)
	from generate_series(0, p_count - 1) k;
$$;

create function private.card_parts(p_txs jsonb) returns table (date date, amount bigint)
language sql
immutable
set search_path = ''
as $$
	select (t.occurred_on + make_interval(months => (p.k - 1)::int))::date, p.amount
	from jsonb_to_recordset(coalesce(p_txs, '[]'::jsonb))
			as t(id text, kind text, amount_minor bigint, occurred_on date, installments int),
		unnest(private.installment_parts(t.amount_minor, t.installments)) with ordinality p(amount, k)
	where t.kind = 'expense';
$$;

-- Sum of the given kinds dated in (p_after, p_until]; null bounds are open.
create function private.card_sum(p_txs jsonb, p_kinds text[], p_after date, p_until date) returns bigint
language sql
immutable
set search_path = ''
as $$
	select coalesce(sum(t.amount_minor), 0)::bigint
	from jsonb_to_recordset(coalesce(p_txs, '[]'::jsonb)) as t(kind text, amount_minor bigint, occurred_on date)
	where t.kind = any (p_kinds)
		and (p_after is null or t.occurred_on > p_after)
		and (p_until is null or t.occurred_on <= p_until);
$$;

-- What a statement closing on p_cut holds: everything billed by then minus payments and refunds by then.
create function private.card_closing(p_opening bigint, p_txs jsonb, p_cut date) returns bigint
language sql
immutable
set search_path = ''
as $$
	select greatest(0, p_opening
		+ (select coalesce(sum(p.amount), 0) from private.card_parts(p_txs) p where p.date <= p_cut)
		- private.card_sum(p_txs, array['income', 'transfer'], null, p_cut))::bigint;
$$;

-- p_card: limit_minor, opening_debt_minor, statement_day, due_offset_days, min_payment_rate, since.
-- p_txs: [{id, kind (expense | income | transfer), amount_minor, occurred_on, installments}], oldest first.
create function private.card_state_from(p_card jsonb, p_txs jsonb, p_today date) returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
	v_opening bigint := (p_card ->> 'opening_debt_minor')::bigint;
	v_cuts jsonb := private.card_cuts(p_today, (p_card ->> 'statement_day')::int);
	v_last date := (v_cuts ->> 'last')::date;
	v_next date := (v_cuts ->> 'next')::date;
	v_due date := v_last + (p_card ->> 'due_offset_days')::int;
	v_statement bigint := private.card_closing(v_opening, p_txs, v_last);
	v_paid_since bigint := private.card_sum(p_txs, array['transfer'], v_last, p_today);
	v_minimum bigint;
	v_credits bigint := private.card_sum(p_txs, array['income', 'transfer'], null, null);
	v_used bigint := greatest(0, v_opening + private.card_sum(p_txs, array['expense'], null, null) - v_credits);
	v_history jsonb := '[]'::jsonb;
	v_cut date;
	v_later date := v_last;
	v_amount bigint;
	v_paid bigint;
begin
	v_minimum := least(v_statement, ceil(v_statement * (p_card ->> 'min_payment_rate')::int / 100.0)::bigint);
	for k in 1..3 loop
		v_cut := (v_last - make_interval(months => k))::date;
		v_amount := private.card_closing(v_opening, p_txs, v_cut);
		v_paid := private.card_sum(p_txs, array['transfer'], v_cut, v_later);
		v_later := v_cut;
		if v_amount > 0 and v_cut >= (p_card ->> 'since')::date then
			v_history := v_history || jsonb_build_object('cut', v_cut, 'amount_minor', v_amount, 'paid_minor', v_paid,
				'status', case when v_paid >= v_amount then 'paid' when v_paid > 0 then 'partial' else 'unpaid' end);
		end if;
	end loop;

	return jsonb_build_object(
		'last_cut', v_last,
		'next_cut', v_next,
		'due_date', v_due,
		'statement_minor', v_statement,
		'paid_since_minor', v_paid_since,
		'statement_remaining_minor', greatest(0, v_statement - v_paid_since),
		'minimum_minor', v_minimum,
		'minimum_remaining_minor', greatest(0, v_minimum - v_paid_since),
		'period_spent_minor', (select coalesce(sum(p.amount), 0) from private.card_parts(p_txs) p where p.date > v_last and p.date <= v_next),
		'total_debt_minor', greatest(0, v_opening
			+ (select coalesce(sum(p.amount), 0) from private.card_parts(p_txs) p where p.date <= v_next) - v_credits),
		'used_minor', v_used,
		'available_minor', (p_card ->> 'limit_minor')::bigint - v_used,
		'overdue', p_today > v_due and v_statement - v_paid_since > 0,
		'history', v_history,
		'installments', (
			select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'part_minor', t.amount_minor / t.installments,
				'count', t.installments, 'billed', b.billed) order by t.n), '[]'::jsonb)
			from rows from (jsonb_to_recordset(coalesce(p_txs, '[]'::jsonb))
					as (id text, kind text, amount_minor bigint, occurred_on date, installments int)) with ordinality
					as t(id, kind, amount_minor, occurred_on, installments, n),
				lateral (select count(*)::int as billed from generate_series(0, t.installments - 1) k
					where (t.occurred_on + make_interval(months => k))::date <= v_last) b
			where t.kind = 'expense' and t.installments > 1 and b.billed < t.installments
		)
	);
end;
$$;

-- Cards ---------------------------------------------------------------------------------------------------

-- "Yapı Kredi World ••4281" (design 36, 37).
create function private.card_label(p_card public.cards) returns text
language sql
immutable
set search_path = ''
as $$
	select p_card.bank_name || coalesce(' ' || p_card.card_name, '') || ' ••' || p_card.last4;
$$;

create function private.card_state(p_card public.cards) returns jsonb
language sql
stable
set search_path = ''
as $$
	select private.card_state_from(
		jsonb_build_object('limit_minor', p_card.limit_minor, 'opening_debt_minor', p_card.opening_debt_minor,
			'statement_day', p_card.statement_day, 'due_offset_days', p_card.due_offset_days,
			'min_payment_rate', p_card.min_payment_rate, 'since', (p_card.created_at at time zone 'Europe/Istanbul')::date),
		(
			select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'kind', t.kind, 'amount_minor', t.amount_minor,
				'occurred_on', t.occurred_on, 'installments', t.installments) order by t.occurred_on, t.created_at), '[]'::jsonb)
			from public.transactions t
			where t.deleted_at is null and (t.card_id = p_card.id or t.to_card_id = p_card.id)
		),
		private.today()
	);
$$;

create function private.card_json(p_card public.cards) returns jsonb
language sql
stable
set search_path = ''
as $$
	select jsonb_build_object(
		'id', p_card.id,
		'bank_name', p_card.bank_name,
		'card_name', p_card.card_name,
		'last4', p_card.last4,
		'label', private.card_label(p_card),
		'color', p_card.color,
		'limit_minor', p_card.limit_minor,
		'opening_debt_minor', p_card.opening_debt_minor,
		'statement_day', p_card.statement_day,
		'due_offset_days', p_card.due_offset_days,
		'min_payment_rate', p_card.min_payment_rate,
		'archived_at', p_card.archived_at,
		'row_version', p_card.row_version,
		'created_at', p_card.created_at,
		'state', private.card_state(p_card)
	);
$$;

create function private.parse_card_input(p_input jsonb) returns public.cards
language plpgsql
stable
set search_path = ''
as $$
declare
	v_card public.cards;
	v_int int;
	v_max int;
	v_key text;
begin
	if jsonb_typeof(p_input) is distinct from 'object'
		or (select array_agg(k order by k) from jsonb_object_keys(p_input) as k)
			is distinct from array['bank_name', 'card_name', 'color', 'due_offset_days', 'last4', 'limit_minor',
				'min_payment_rate', 'opening_debt_minor', 'statement_day'] then
		perform private.cash_invalid('input_keys');
	end if;
	v_card.bank_name := private.check_text(p_input -> 'bank_name', 40, true);
	v_card.card_name := private.check_text(p_input -> 'card_name', 40, false);
	if jsonb_typeof(p_input -> 'last4') is distinct from 'string' or (p_input ->> 'last4') !~ '^[0-9]{4}$' then
		perform private.cash_invalid('last4');
	end if;
	v_card.last4 := p_input ->> 'last4';
	if jsonb_typeof(p_input -> 'color') is distinct from 'string'
		or not ((p_input ->> 'color') = any (enum_range(null::public.card_color)::text[])) then
		perform private.cash_invalid('color');
	end if;
	v_card.color := (p_input ->> 'color')::public.card_color;
	v_card.limit_minor := private.cash_amount(p_input -> 'limit_minor', true);
	v_card.opening_debt_minor := private.cash_amount(p_input -> 'opening_debt_minor', false);
	if v_card.opening_debt_minor < 0 then
		perform private.cash_invalid('opening_debt_minor');
	end if;
	foreach v_key in array array['statement_day', 'due_offset_days', 'min_payment_rate'] loop
		if jsonb_typeof(p_input -> v_key) is distinct from 'number'
			or (p_input ->> v_key)::numeric <> trunc((p_input ->> v_key)::numeric) then
			perform private.cash_invalid(v_key);
		end if;
		v_int := (p_input ->> v_key)::int;
		v_max := 28;
		if v_key = 'min_payment_rate' then
			v_max := 100;
		end if;
		if v_int < 1 or v_int > v_max then
			perform private.cash_invalid(v_key);
		end if;
	end loop;
	v_card.statement_day := (p_input ->> 'statement_day')::int;
	v_card.due_offset_days := (p_input ->> 'due_offset_days')::int;
	v_card.min_payment_rate := (p_input ->> 'min_payment_rate')::int;
	return v_card;
end;
$$;

create function private.own_card_for_write(p_uid uuid, p_id uuid, p_allow_archived boolean) returns public.cards
language plpgsql
stable
set search_path = ''
as $$
declare
	v_card public.cards;
begin
	select * into v_card from public.cards where id = p_id and owner_id = p_uid;
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001', detail = 'card';
	end if;
	if v_card.archived_at is not null and not p_allow_archived then
		perform private.cash_invalid('card_archived');
	end if;
	return v_card;
end;
$$;

create function public.create_card(p_input jsonb, p_idempotency_key uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_input public.cards;
	v_card public.cards;
begin
	if p_idempotency_key is null then
		perform private.cash_invalid('idempotency_key');
	end if;
	select * into v_card from public.cards where idempotency_key = p_idempotency_key;
	if found then
		if v_card.owner_id <> v_uid then
			raise exception using message = 'conflict', errcode = 'P0001';
		end if;
		return jsonb_build_object('card', private.card_json(v_card), 'replayed', true);
	end if;
	v_input := private.parse_card_input(p_input);
	perform 1 from public.profiles where id = v_uid and deleted_at is null for update;
	if not found then
		raise exception using message = 'forbidden', errcode = 'P0001', detail = 'profile_required';
	end if;
	if (select count(*) from public.cards where owner_id = v_uid and archived_at is null) >= 20 then
		perform private.cash_invalid('too_many_cards');
	end if;
	insert into public.cards (owner_id, bank_name, card_name, last4, color, limit_minor, opening_debt_minor,
		statement_day, due_offset_days, min_payment_rate, idempotency_key)
	values (v_uid, v_input.bank_name, v_input.card_name, v_input.last4, v_input.color, v_input.limit_minor,
		v_input.opening_debt_minor, v_input.statement_day, v_input.due_offset_days, v_input.min_payment_rate,
		p_idempotency_key)
	returning * into v_card;
	return jsonb_build_object('card', private.card_json(v_card), 'replayed', false);
end;
$$;

create function public.update_card(p_id uuid, p_input jsonb, p_row_version int) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_input public.cards := private.parse_card_input(p_input);
	v_card public.cards;
begin
	select * into v_card from public.cards where id = p_id and owner_id = v_uid for update;
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if v_card.archived_at is not null then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if v_card.row_version <> p_row_version then
		raise exception using message = 'conflict', errcode = 'P0001';
	end if;
	update public.cards
	set bank_name = v_input.bank_name, card_name = v_input.card_name, last4 = v_input.last4, color = v_input.color,
		limit_minor = v_input.limit_minor, opening_debt_minor = v_input.opening_debt_minor,
		statement_day = v_input.statement_day, due_offset_days = v_input.due_offset_days,
		min_payment_rate = v_input.min_payment_rate, row_version = row_version + 1, updated_at = now()
	where id = p_id
	returning * into v_card;
	return jsonb_build_object('card', private.card_json(v_card));
end;
$$;

create function public.archive_card(p_id uuid, p_row_version int) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_card public.cards;
begin
	select * into v_card from public.cards where id = p_id and owner_id = v_uid for update;
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if v_card.archived_at is not null then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if v_card.row_version <> p_row_version then
		raise exception using message = 'conflict', errcode = 'P0001';
	end if;
	update public.cards set archived_at = now(), row_version = row_version + 1, updated_at = now()
	where id = p_id returning * into v_card;
	return jsonb_build_object('card', private.card_json(v_card));
end;
$$;

-- Design 07: the cards and their totals. Card limits never count towards Toplam Nakit.
create function public.list_cards() returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_items jsonb;
begin
	select coalesce(jsonb_agg(private.card_json(c) order by c.created_at, c.id), '[]'::jsonb) into v_items
	from public.cards c where c.owner_id = v_uid and c.archived_at is null;
	return jsonb_build_object(
		'cards', v_items,
		'total_debt_minor', (select coalesce(sum((i -> 'state' ->> 'total_debt_minor')::bigint), 0) from jsonb_array_elements(v_items) i),
		'available_minor', (select coalesce(sum((i -> 'state' ->> 'available_minor')::bigint), 0) from jsonb_array_elements(v_items) i),
		'limit_minor', (select coalesce(sum((i ->> 'limit_minor')::bigint), 0) from jsonb_array_elements(v_items) i)
	);
end;
$$;

-- Design 08: one card with its current period's purchases, its instalment purchases and its payments.
create function public.get_card(p_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_card public.cards;
	v_last date;
begin
	select * into v_card from public.cards where id = p_id and owner_id = v_uid;
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	v_last := (private.card_cuts(private.today(), v_card.statement_day) ->> 'last')::date;
	return jsonb_build_object(
		'card', private.card_json(v_card),
		'period_items', (
			select coalesce(jsonb_agg(private.transaction_json(t) order by t.occurred_on desc, t.created_at desc), '[]'::jsonb)
			from public.transactions t
			where t.deleted_at is null and t.card_id = v_card.id and t.occurred_on > v_last
		),
		'installment_items', (
			select coalesce(jsonb_agg(private.transaction_json(t) order by t.occurred_on), '[]'::jsonb)
			from public.transactions t
			where t.deleted_at is null and t.card_id = v_card.id and t.installments > 1
		),
		'payments', (
			select coalesce(jsonb_agg(private.transaction_json(t) order by t.occurred_on desc, t.created_at desc), '[]'::jsonb)
			from public.transactions t
			where t.deleted_at is null and t.to_card_id = v_card.id
		)
	);
end;
$$;

-- Transactions learn about cards ---------------------------------------------------------------------------

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

create or replace function private.transaction_fields(p_tx public.transactions) returns jsonb
language sql
immutable
set search_path = ''
as $$
	select jsonb_build_object(
		'kind', p_tx.kind, 'account_id', p_tx.account_id, 'to_account_id', p_tx.to_account_id,
		'amount_minor', p_tx.amount_minor, 'category', p_tx.category, 'title', p_tx.title,
		'note', p_tx.note, 'occurred_on', p_tx.occurred_on, 'card_id', p_tx.card_id, 'to_card_id', p_tx.to_card_id,
		'installments', p_tx.installments
	);
$$;

create or replace function private.parse_transaction_input(p_uid uuid, p_input jsonb, p_old public.transactions) returns public.transactions
language plpgsql
stable
set search_path = ''
as $$
declare
	v_tx public.transactions;
	v_category jsonb := p_input -> 'category';
	v_date text;
begin
	-- The card fields came with F4-05; a record without them is an account record (one payment).
	if jsonb_typeof(p_input) is distinct from 'object'
		or not (select coalesce(array_agg(k), '{}') from jsonb_object_keys(p_input) as k)
			<@ array['account_id', 'amount_minor', 'card_id', 'category', 'installments', 'kind', 'note', 'occurred_on',
				'title', 'to_account_id', 'to_card_id']
		or not array['account_id', 'amount_minor', 'category', 'kind', 'note', 'occurred_on', 'title', 'to_account_id']
			<@ (select array_agg(k) from jsonb_object_keys(p_input) as k) then
		perform private.cash_invalid('input_keys');
	end if;
	p_input := jsonb_build_object('card_id', null, 'to_card_id', null, 'installments', 1) || p_input;
	if jsonb_typeof(p_input -> 'kind') is distinct from 'string'
		or (p_input ->> 'kind') not in ('expense', 'income', 'transfer') then
		perform private.cash_invalid('kind');
	end if;
	v_tx.kind := (p_input ->> 'kind')::public.transaction_kind;
	v_tx.account_id := private.json_uuid(p_input -> 'account_id', 'account_id');
	v_tx.to_account_id := private.json_uuid(p_input -> 'to_account_id', 'to_account_id');
	v_tx.card_id := private.json_uuid(p_input -> 'card_id', 'card_id');
	v_tx.to_card_id := private.json_uuid(p_input -> 'to_card_id', 'to_card_id');
	-- Income and expense sit on an account or a card; a transfer leaves an account for an account or a card.
	if v_tx.kind = 'transfer' then
		if v_tx.account_id is null or v_tx.card_id is not null
			or (v_tx.to_account_id is null) = (v_tx.to_card_id is null) then
			perform private.cash_invalid('to_account_id');
		end if;
	elsif (v_tx.account_id is null) = (v_tx.card_id is null) or v_tx.to_card_id is not null then
		perform private.cash_invalid('account_id');
	end if;
	if jsonb_typeof(p_input -> 'installments') is distinct from 'number'
		or (p_input ->> 'installments')::numeric not in (select generate_series(1, 36)) then
		perform private.cash_invalid('installments');
	end if;
	v_tx.installments := (p_input ->> 'installments')::int;
	if v_tx.installments > 1 and (v_tx.kind <> 'expense' or v_tx.card_id is null) then
		perform private.cash_invalid('installments');
	end if;
	v_tx.amount_minor := private.cash_amount(p_input -> 'amount_minor', true);

	if jsonb_typeof(v_category) = 'string' then
		v_tx.category := v_category #>> '{}';
	elsif jsonb_typeof(v_category) is distinct from 'null' then
		perform private.cash_invalid('category');
	end if;
	if v_tx.kind = 'transfer' then
		if v_tx.category is not null then
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

	if v_tx.account_id is not null then
		perform private.own_account_for_write(p_uid, v_tx.account_id,
			p_old.id is not null and v_tx.account_id in (p_old.account_id, p_old.to_account_id));
	end if;
	if v_tx.card_id is not null then
		perform private.own_card_for_write(p_uid, v_tx.card_id, p_old.id is not null and v_tx.card_id = p_old.card_id);
	end if;
	if v_tx.to_card_id is not null then
		perform private.own_card_for_write(p_uid, v_tx.to_card_id, p_old.id is not null and v_tx.to_card_id = p_old.to_card_id);
	end if;
	if v_tx.to_account_id is not null then
		perform private.own_account_for_write(p_uid, v_tx.to_account_id,
			p_old.id is not null and v_tx.to_account_id in (p_old.account_id, p_old.to_account_id));
	end if;
	return v_tx;
end;
$$;

create or replace function public.create_transaction(p_input jsonb, p_idempotency_key uuid) returns jsonb
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
	insert into public.transactions (owner_id, kind, account_id, to_account_id, card_id, to_card_id, installments,
		amount_minor, category, title, note, occurred_on, idempotency_key)
	values (v_uid, v_input.kind, v_input.account_id, v_input.to_account_id, v_input.card_id, v_input.to_card_id,
		v_input.installments, v_input.amount_minor, v_input.category, v_input.title, v_input.note, v_input.occurred_on,
		p_idempotency_key)
	returning * into v_tx;
	insert into public.transaction_events (transaction_id, owner_id, type) values (v_tx.id, v_uid, 'created');
	return jsonb_build_object('transaction', private.transaction_json(v_tx), 'replayed', false);
end;
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
		card_id = v_input.card_id, to_card_id = v_input.to_card_id, installments = v_input.installments,
		amount_minor = v_input.amount_minor, category = v_input.category, title = v_input.title, note = v_input.note,
		occurred_on = v_input.occurred_on, row_version = row_version + 1, updated_at = now()
	where id = p_id
	returning * into v_tx;
	insert into public.transaction_events (transaction_id, owner_id, type, changes) values (v_tx.id, v_uid, 'updated', v_changes);
	return jsonb_build_object('transaction', private.transaction_json(v_tx));
end;
$$;

-- Account deletion and export cover cards (ADR-039, ADR-055) ------------------------------------------------

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

revoke all on function public.create_card(jsonb, uuid) from public, anon;
revoke all on function public.update_card(uuid, jsonb, int) from public, anon;
revoke all on function public.archive_card(uuid, int) from public, anon;
revoke all on function public.list_cards() from public, anon;
revoke all on function public.get_card(uuid) from public, anon;
grant execute on function public.create_card(jsonb, uuid) to authenticated;
grant execute on function public.update_card(uuid, jsonb, int) to authenticated;
grant execute on function public.archive_card(uuid, int) to authenticated;
grant execute on function public.list_cards() to authenticated;
grant execute on function public.get_card(uuid) to authenticated;
