-- F4-04: repeating income and expense (design 38), category budgets (39) and the monthly report (27); ADR-054.
-- Still manual records only: a repeating rule never moves money, it only writes the user's own record.

create type public.recurrence_frequency as enum ('weekly', 'monthly', 'yearly');

-- Same rule as packages/shared/src/recurrence.ts (test-vectors/recurrence.json). The n-th date counts from
-- the start; date + interval 'n months' clamps to the month's last day (31 Jan → 28 Feb → 31 Mar).
create function private.recurrence_date(p_start date, p_frequency public.recurrence_frequency, p_n int) returns date
language sql
immutable
set search_path = ''
as $$
	select case p_frequency
		when 'weekly' then p_start + 7 * p_n
		when 'monthly' then (p_start + make_interval(months => p_n))::date
		else (p_start + make_interval(years => p_n))::date
	end;
$$;

-- Every date in [p_from, p_to], at most 400.
create function private.recurrence_dates(p_start date, p_frequency public.recurrence_frequency, p_from date, p_to date)
returns date[]
language plpgsql
immutable
set search_path = ''
as $$
declare
	v_n int := 0;
	v_date date;
	v_dates date[] := '{}';
begin
	if p_from > p_start then
		v_n := greatest(0, case p_frequency
			when 'weekly' then (p_from - p_start) / 7
			when 'monthly' then ((extract(year from p_from) - extract(year from p_start)) * 12
				+ extract(month from p_from) - extract(month from p_start))::int
			else (extract(year from p_from) - extract(year from p_start))::int
		end - 1);
		while private.recurrence_date(p_start, p_frequency, v_n) < p_from loop
			v_n := v_n + 1;
		end loop;
	end if;
	loop
		v_date := private.recurrence_date(p_start, p_frequency, v_n);
		exit when v_date > p_to or cardinality(v_dates) >= 400;
		v_dates := v_dates || v_date;
		v_n := v_n + 1;
	end loop;
	return v_dates;
end;
$$;

-- The next p_count dates on or after p_from.
create function private.next_occurrences(p_start date, p_frequency public.recurrence_frequency, p_from date, p_count int)
returns date[]
language sql
immutable
set search_path = ''
as $$
	-- One period more than asked always holds p_count dates (month-end clamps never skip a month).
	select (private.recurrence_dates(p_start, p_frequency, p_from, case p_frequency
		when 'weekly' then p_from + 7 * (p_count + 1)
		when 'monthly' then (p_from + make_interval(months => p_count + 1))::date
		else (p_from + make_interval(years => p_count + 1))::date
	end))[1:least(p_count, 400)];
$$;

-- Tables -----------------------------------------------------------------------------------------------------

create table public.recurring_rules (
	id uuid primary key default gen_random_uuid(),
	owner_id uuid not null references public.profiles (id) on delete cascade,
	kind public.transaction_kind not null check (kind in ('expense', 'income')),
	name text not null check (char_length(name) between 1 and 80),
	amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 10000000000000),
	category text not null check (private.is_category_for(kind, category)),
	account_id uuid not null references public.accounts (id) on delete cascade,
	frequency public.recurrence_frequency not null,
	start_on date not null,
	confirm_each boolean not null default true,
	-- Dates before this day are not owed: at most a month back from when the rule was made, or the day it resumed.
	tracking_from date not null,
	paused_at timestamptz,
	idempotency_key uuid unique,
	row_version int not null default 1,
	created_at timestamptz not null default clock_timestamp(),
	updated_at timestamptz not null default now()
);
create index recurring_rules_owner_id_idx on public.recurring_rules (owner_id, created_at);
create index recurring_rules_account_id_idx on public.recurring_rules (account_id);
alter table public.recurring_rules enable row level security;

-- One row per handled date: recorded (with its record) or skipped.
create table public.recurring_occurrences (
	rule_id uuid not null references public.recurring_rules (id) on delete cascade,
	occurrence_on date not null,
	status text not null check (status in ('posted', 'skipped')),
	transaction_id uuid references public.transactions (id) on delete set null,
	idempotency_key uuid unique,
	created_at timestamptz not null default now(),
	primary key (rule_id, occurrence_on)
);
create index recurring_occurrences_transaction_id_idx on public.recurring_occurrences (transaction_id);
alter table public.recurring_occurrences enable row level security;

create table public.budgets (
	owner_id uuid not null references public.profiles (id) on delete cascade,
	category text not null check (private.is_category_for('expense', category)),
	limit_minor bigint not null check (limit_minor > 0 and limit_minor <= 10000000000000),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (owner_id, category)
);
alter table public.budgets enable row level security;

-- Recurring rules --------------------------------------------------------------------------------------------

create function private.parse_recurring_input(p_uid uuid, p_input jsonb) returns public.recurring_rules
language plpgsql
stable
set search_path = ''
as $$
declare
	v_rule public.recurring_rules;
	v_date text;
begin
	if jsonb_typeof(p_input) is distinct from 'object'
		or (select array_agg(k order by k) from jsonb_object_keys(p_input) as k)
			is distinct from array['account_id', 'amount_minor', 'category', 'confirm_each', 'frequency', 'kind', 'name', 'start_on'] then
		perform private.cash_invalid('input_keys');
	end if;
	if jsonb_typeof(p_input -> 'kind') is distinct from 'string' or (p_input ->> 'kind') not in ('expense', 'income') then
		perform private.cash_invalid('kind');
	end if;
	v_rule.kind := (p_input ->> 'kind')::public.transaction_kind;
	v_rule.name := private.check_text(p_input -> 'name', 80, true);
	v_rule.amount_minor := private.cash_amount(p_input -> 'amount_minor', true);
	if jsonb_typeof(p_input -> 'category') is distinct from 'string'
		or not private.is_category_for(v_rule.kind, p_input ->> 'category') then
		perform private.cash_invalid('category');
	end if;
	v_rule.category := p_input ->> 'category';
	v_rule.account_id := private.json_uuid(p_input -> 'account_id', 'account_id');
	if v_rule.account_id is null then
		perform private.cash_invalid('account_id');
	end if;
	perform private.own_account_for_write(p_uid, v_rule.account_id, false);
	if jsonb_typeof(p_input -> 'frequency') is distinct from 'string'
		or not ((p_input ->> 'frequency') = any (enum_range(null::public.recurrence_frequency)::text[])) then
		perform private.cash_invalid('frequency');
	end if;
	v_rule.frequency := (p_input ->> 'frequency')::public.recurrence_frequency;
	if jsonb_typeof(p_input -> 'confirm_each') is distinct from 'boolean' then
		perform private.cash_invalid('confirm_each');
	end if;
	v_rule.confirm_each := (p_input ->> 'confirm_each')::boolean;
	if jsonb_typeof(p_input -> 'start_on') is distinct from 'string' then
		perform private.cash_invalid('start_on');
	end if;
	v_date := p_input ->> 'start_on';
	begin
		v_rule.start_on := v_date::date;
	exception when others then
		perform private.cash_invalid('start_on');
	end;
	if to_char(v_rule.start_on, 'YYYY-MM-DD') <> v_date
		or v_rule.start_on not between date '2000-01-01' and private.today() + 366 then
		perform private.cash_invalid('start_on');
	end if;
	return v_rule;
end;
$$;

-- Dates that are due and not handled yet (for confirm_each rules: "planlı", waiting for the user).
create function private.recurring_due_dates(p_rule public.recurring_rules, p_today date) returns date[]
language sql
stable
set search_path = ''
as $$
	select coalesce(array_agg(d order by d), '{}')
	from unnest(private.recurrence_dates(p_rule.start_on, p_rule.frequency,
		greatest(p_rule.start_on, p_rule.tracking_from), p_today)) d
	where p_rule.paused_at is null
		and not exists (select 1 from public.recurring_occurrences o where o.rule_id = p_rule.id and o.occurrence_on = d);
$$;

create function private.recurring_json(p_rule public.recurring_rules) returns jsonb
language sql
stable
set search_path = ''
as $$
	select jsonb_build_object(
		'id', p_rule.id,
		'kind', p_rule.kind,
		'name', p_rule.name,
		'amount_minor', p_rule.amount_minor,
		'category', p_rule.category,
		'account_id', p_rule.account_id,
		'account_name', (select a.name from public.accounts a where a.id = p_rule.account_id),
		'frequency', p_rule.frequency,
		'start_on', p_rule.start_on,
		'confirm_each', p_rule.confirm_each,
		'paused_at', p_rule.paused_at,
		'next_dates', to_jsonb(private.next_occurrences(p_rule.start_on, p_rule.frequency, private.today() + 1, 3)),
		'pending_dates', case when p_rule.confirm_each
			then to_jsonb(private.recurring_due_dates(p_rule, private.today())) else '[]'::jsonb end,
		'row_version', p_rule.row_version,
		'created_at', p_rule.created_at
	);
$$;

create function private.own_rule_for_update(p_uid uuid, p_id uuid, p_row_version int) returns public.recurring_rules
language plpgsql
set search_path = ''
as $$
declare
	v_rule public.recurring_rules;
begin
	select * into v_rule from public.recurring_rules where id = p_id and owner_id = p_uid for update;
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if p_row_version is not null and v_rule.row_version <> p_row_version then
		raise exception using message = 'conflict', errcode = 'P0001';
	end if;
	return v_rule;
end;
$$;

create function public.create_recurring(p_input jsonb, p_idempotency_key uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_input public.recurring_rules;
	v_rule public.recurring_rules;
begin
	if p_idempotency_key is null then
		perform private.cash_invalid('idempotency_key');
	end if;
	select * into v_rule from public.recurring_rules where idempotency_key = p_idempotency_key;
	if found then
		if v_rule.owner_id <> v_uid then
			raise exception using message = 'conflict', errcode = 'P0001';
		end if;
		return jsonb_build_object('rule', private.recurring_json(v_rule), 'replayed', true);
	end if;
	v_input := private.parse_recurring_input(v_uid, p_input);
	if (select count(*) from public.recurring_rules where owner_id = v_uid) >= 100 then
		perform private.cash_invalid('too_many_rules');
	end if;
	insert into public.recurring_rules (owner_id, kind, name, amount_minor, category, account_id, frequency, start_on,
		confirm_each, tracking_from, idempotency_key)
	values (v_uid, v_input.kind, v_input.name, v_input.amount_minor, v_input.category, v_input.account_id,
		v_input.frequency, v_input.start_on, v_input.confirm_each,
		greatest(private.today() - 31, least(private.today(), v_input.start_on)), p_idempotency_key)
	returning * into v_rule;
	return jsonb_build_object('rule', private.recurring_json(v_rule), 'replayed', false);
end;
$$;

create function public.update_recurring(p_id uuid, p_input jsonb, p_row_version int) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_input public.recurring_rules := private.parse_recurring_input(v_uid, p_input);
	v_rule public.recurring_rules := private.own_rule_for_update(v_uid, p_id, p_row_version);
begin
	update public.recurring_rules
	set kind = v_input.kind, name = v_input.name, amount_minor = v_input.amount_minor, category = v_input.category,
		account_id = v_input.account_id, frequency = v_input.frequency, start_on = v_input.start_on,
		confirm_each = v_input.confirm_each, row_version = row_version + 1, updated_at = now()
	where id = v_rule.id
	returning * into v_rule;
	return jsonb_build_object('rule', private.recurring_json(v_rule));
end;
$$;

-- Resuming starts a new tracking day: dates missed while paused are not owed.
create function public.set_recurring_paused(p_id uuid, p_paused boolean, p_row_version int) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_rule public.recurring_rules := private.own_rule_for_update(v_uid, p_id, p_row_version);
begin
	if (v_rule.paused_at is not null) = coalesce(p_paused, false) then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	update public.recurring_rules
	set paused_at = case when p_paused then now() end,
		tracking_from = case when p_paused then tracking_from else private.today() end,
		row_version = row_version + 1, updated_at = now()
	where id = v_rule.id
	returning * into v_rule;
	return jsonb_build_object('rule', private.recurring_json(v_rule));
end;
$$;

-- Records already written stay; only the rule and its handled dates go.
create function public.delete_recurring(p_id uuid, p_row_version int) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_rule public.recurring_rules := private.own_rule_for_update(v_uid, p_id, p_row_version);
begin
	delete from public.recurring_rules where id = v_rule.id;
	return jsonb_build_object('deleted', v_rule.id);
end;
$$;

create function public.list_recurring() returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select jsonb_build_object('rules', coalesce(jsonb_agg(private.recurring_json(r) order by r.created_at, r.id), '[]'::jsonb))
	from public.recurring_rules r
	where r.owner_id = private.require_uid();
$$;

-- Writes the record for one date of a rule; shared by "Onayla" and the daily job.
create function private.post_recurring(p_rule public.recurring_rules, p_on date, p_key uuid) returns public.transactions
language plpgsql
set search_path = ''
as $$
declare
	v_tx public.transactions;
begin
	insert into public.transactions (owner_id, kind, account_id, amount_minor, category, title, occurred_on, idempotency_key)
	values (p_rule.owner_id, p_rule.kind, p_rule.account_id, p_rule.amount_minor, p_rule.category, p_rule.name, p_on,
		coalesce(p_key, gen_random_uuid()))
	returning * into v_tx;
	insert into public.transaction_events (transaction_id, owner_id, type) values (v_tx.id, p_rule.owner_id, 'created');
	insert into public.recurring_occurrences (rule_id, occurrence_on, status, transaction_id, idempotency_key)
	values (p_rule.id, p_on, 'posted', v_tx.id, p_key);
	return v_tx;
end;
$$;

create function private.handle_due_date(p_uid uuid, p_rule_id uuid, p_on date) returns public.recurring_rules
language plpgsql
set search_path = ''
as $$
declare
	v_rule public.recurring_rules := private.own_rule_for_update(p_uid, p_rule_id, null);
begin
	if p_on is null or not (p_on = any (private.recurring_due_dates(v_rule, private.today()))) then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	return v_rule;
end;
$$;

create function public.confirm_recurring(p_rule_id uuid, p_occurrence_on date, p_idempotency_key uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_occurrence public.recurring_occurrences;
	v_rule public.recurring_rules;
	v_tx public.transactions;
begin
	if p_idempotency_key is null then
		perform private.cash_invalid('idempotency_key');
	end if;
	select o.* into v_occurrence from public.recurring_occurrences o
	join public.recurring_rules r on r.id = o.rule_id
	where o.idempotency_key = p_idempotency_key and r.owner_id = v_uid;
	if found then
		select * into v_tx from public.transactions where id = v_occurrence.transaction_id;
		return jsonb_build_object('transaction', private.transaction_json(v_tx), 'replayed', true);
	end if;
	v_rule := private.handle_due_date(v_uid, p_rule_id, p_occurrence_on);
	perform private.own_account_for_write(v_uid, v_rule.account_id, false);
	v_tx := private.post_recurring(v_rule, p_occurrence_on, p_idempotency_key);
	return jsonb_build_object('transaction', private.transaction_json(v_tx), 'replayed', false);
end;
$$;

create function public.skip_recurring(p_rule_id uuid, p_occurrence_on date) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_rule public.recurring_rules := private.handle_due_date(v_uid, p_rule_id, p_occurrence_on);
begin
	insert into public.recurring_occurrences (rule_id, occurrence_on, status) values (v_rule.id, p_occurrence_on, 'skipped');
	return jsonb_build_object('rule', private.recurring_json(v_rule));
end;
$$;

-- Daily: rules without "her seferinde onay iste" are recorded on their day. Archived accounts are left alone.
create function private.post_due_recurring(p_today date default null) returns int
language plpgsql
set search_path = ''
as $$
declare
	v_today date := coalesce(p_today, private.today());
	v_rule public.recurring_rules;
	v_on date;
	v_count int := 0;
begin
	for v_rule in
		select r.* from public.recurring_rules r
		join public.accounts a on a.id = r.account_id
		where not r.confirm_each and r.paused_at is null and a.archived_at is null
		for update of r skip locked
	loop
		foreach v_on in array private.recurring_due_dates(v_rule, v_today) loop
			perform private.post_recurring(v_rule, v_on, null);
			v_count := v_count + 1;
		end loop;
	end loop;
	return v_count;
end;
$$;

select cron.schedule('post-due-recurring', '17 * * * *', $$select private.post_due_recurring()$$);

-- Budgets ----------------------------------------------------------------------------------------------------

-- A limit of null or 0 removes the category's budget.
create function public.set_budget(p_category text, p_limit_minor bigint) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
begin
	if not private.is_category_for('expense', p_category) then
		perform private.cash_invalid('category');
	end if;
	if coalesce(p_limit_minor, 0) = 0 then
		delete from public.budgets where owner_id = v_uid and category = p_category;
		return jsonb_build_object('category', p_category, 'limit_minor', null);
	end if;
	if p_limit_minor < 0 or p_limit_minor > 10000000000000 then
		perform private.cash_invalid('amount');
	end if;
	insert into public.budgets (owner_id, category, limit_minor) values (v_uid, p_category, p_limit_minor)
	on conflict (owner_id, category) do update set limit_minor = excluded.limit_minor, updated_at = now();
	return jsonb_build_object('category', p_category, 'limit_minor', p_limit_minor);
end;
$$;

create function public.list_budgets(p_month date) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_month date := private.require_month(p_month);
	v_items jsonb;
begin
	with spent as (
		select t.category, sum(t.amount_minor) as amount, count(*) as n
		from public.transactions t
		where t.owner_id = v_uid and t.deleted_at is null and t.kind = 'expense'
			and t.occurred_on >= v_month and t.occurred_on < (v_month + interval '1 month')::date
		group by t.category
	)
	select coalesce(jsonb_agg(jsonb_build_object(
		'category', b.category, 'limit_minor', b.limit_minor,
		'spent_minor', coalesce(s.amount, 0), 'count', coalesce(s.n, 0)
	) order by b.created_at, b.category), '[]'::jsonb) into v_items
	from public.budgets b left join spent s on s.category = b.category
	where b.owner_id = v_uid;
	return jsonb_build_object(
		'items', v_items,
		'total_limit_minor', (select coalesce(sum((i ->> 'limit_minor')::bigint), 0) from jsonb_array_elements(v_items) i),
		'total_spent_minor', (select coalesce(sum((i ->> 'spent_minor')::bigint), 0) from jsonb_array_elements(v_items) i),
		'month_expense_minor', (
			select coalesce(sum(amount_minor), 0) from public.transactions
			where owner_id = v_uid and deleted_at is null and kind = 'expense'
				and occurred_on >= v_month and occurred_on < (v_month + interval '1 month')::date
		)
	);
end;
$$;

-- Monthly report ------------------------------------------------------------------------------------------------

-- Design 27: income, expense, the spending by category and six months of income and expense.
create function public.get_monthly_report(p_month date) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_month date := private.require_month(p_month);
	v_end date := (v_month + interval '1 month')::date;
begin
	return jsonb_build_object(
		'month', v_month,
		'income_minor', (
			select coalesce(sum(amount_minor), 0) from public.transactions
			where owner_id = v_uid and deleted_at is null and kind = 'income' and occurred_on >= v_month and occurred_on < v_end
		),
		'expense_minor', (
			select coalesce(sum(amount_minor), 0) from public.transactions
			where owner_id = v_uid and deleted_at is null and kind = 'expense' and occurred_on >= v_month and occurred_on < v_end
		),
		'by_category', (
			select coalesce(jsonb_agg(jsonb_build_object('category', c.category, 'amount_minor', c.amount)
				order by c.amount desc, c.category), '[]'::jsonb)
			from (
				select category, sum(amount_minor) as amount from public.transactions
				where owner_id = v_uid and deleted_at is null and kind = 'expense' and occurred_on >= v_month and occurred_on < v_end
				group by category
			) c
		),
		'series', (
			select jsonb_agg(jsonb_build_object(
				'month', m.month,
				'income_minor', coalesce((select sum(amount_minor) from public.transactions t
					where t.owner_id = v_uid and t.deleted_at is null and t.kind = 'income'
						and t.occurred_on >= m.month and t.occurred_on < (m.month + interval '1 month')::date), 0),
				'expense_minor', coalesce((select sum(amount_minor) from public.transactions t
					where t.owner_id = v_uid and t.deleted_at is null and t.kind = 'expense'
						and t.occurred_on >= m.month and t.occurred_on < (m.month + interval '1 month')::date), 0)
			) order by m.month)
			from (select (v_month - make_interval(months => i))::date as month from generate_series(0, 5) i) m
		)
	);
end;
$$;

-- Account deletion and export cover rules and budgets (ADR-039, ADR-054) ----------------------------------------

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

revoke all on function public.create_recurring(jsonb, uuid) from public, anon;
revoke all on function public.update_recurring(uuid, jsonb, int) from public, anon;
revoke all on function public.set_recurring_paused(uuid, boolean, int) from public, anon;
revoke all on function public.delete_recurring(uuid, int) from public, anon;
revoke all on function public.list_recurring() from public, anon;
revoke all on function public.confirm_recurring(uuid, date, uuid) from public, anon;
revoke all on function public.skip_recurring(uuid, date) from public, anon;
revoke all on function public.set_budget(text, bigint) from public, anon;
revoke all on function public.list_budgets(date) from public, anon;
revoke all on function public.get_monthly_report(date) from public, anon;
grant execute on function public.create_recurring(jsonb, uuid) to authenticated;
grant execute on function public.update_recurring(uuid, jsonb, int) to authenticated;
grant execute on function public.set_recurring_paused(uuid, boolean, int) to authenticated;
grant execute on function public.delete_recurring(uuid, int) to authenticated;
grant execute on function public.list_recurring() to authenticated;
grant execute on function public.confirm_recurring(uuid, date, uuid) to authenticated;
grant execute on function public.skip_recurring(uuid, date) to authenticated;
grant execute on function public.set_budget(text, bigint) to authenticated;
grant execute on function public.list_budgets(date) to authenticated;
grant execute on function public.get_monthly_report(date) to authenticated;
