-- ADR-054: category budgets (design 39) and the monthly report (design 27).
begin;
select plan(24);

select set_config('paramnet.today', '2026-10-24', true);
insert into auth.users (id, phone, aud, role) values
	('11111111-1111-4111-8111-111111111111', '905550000001', 'authenticated', 'authenticated'),
	('22222222-2222-4222-8222-222222222222', '905550000002', 'authenticated', 'authenticated');
insert into public.profiles (id, display_name, phone_e164) values
	('11111111-1111-4111-8111-111111111111', 'Ayşe', '+905550000001'),
	('22222222-2222-4222-8222-222222222222', 'Bora', '+905550000002');
insert into public.accounts (id, owner_id, kind, name, opening_balance_minor) values
	('a1a1a1a1-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'bank', 'Maaş Hesabı', 0),
	('a1a1a1a1-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'cash', 'Kasa', 0);
insert into public.transactions (owner_id, kind, account_id, to_account_id, amount_minor, category, occurred_on, idempotency_key, deleted_at) values
	('11111111-1111-4111-8111-111111111111', 'income', 'a1a1a1a1-0000-4000-8000-000000000001', null, 4650000, 'salary', '2026-10-01', gen_random_uuid(), null),
	('11111111-1111-4111-8111-111111111111', 'expense', 'a1a1a1a1-0000-4000-8000-000000000001', null, 1500000, 'rent', '2026-10-03', gen_random_uuid(), null),
	('11111111-1111-4111-8111-111111111111', 'expense', 'a1a1a1a1-0000-4000-8000-000000000002', null, 128460, 'groceries', '2026-10-11', gen_random_uuid(), null),
	('11111111-1111-4111-8111-111111111111', 'expense', 'a1a1a1a1-0000-4000-8000-000000000001', null, 200000, 'clothing', '2026-10-04', gen_random_uuid(), null),
	('11111111-1111-4111-8111-111111111111', 'expense', 'a1a1a1a1-0000-4000-8000-000000000001', null, 99999, 'groceries', '2026-10-12', gen_random_uuid(), now()),
	('11111111-1111-4111-8111-111111111111', 'transfer', 'a1a1a1a1-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000002', 200000, null, '2026-10-05', gen_random_uuid(), null),
	('11111111-1111-4111-8111-111111111111', 'expense', 'a1a1a1a1-0000-4000-8000-000000000001', null, 784000, 'groceries', '2026-09-10', gen_random_uuid(), null),
	('11111111-1111-4111-8111-111111111111', 'income', 'a1a1a1a1-0000-4000-8000-000000000001', null, 4650000, 'salary', '2026-09-01', gen_random_uuid(), null);

create function pg_temp.act_as(uid uuid) returns void language sql as $$
	select set_config('role', 'authenticated', true),
		set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select has_table('public', 'budgets', 'budgets tablosu');
select ok(not has_table_privilege('authenticated', 'public.budgets', 'select'), 'bütçeler istemciye kapalı');
select ok(not has_function_privilege('anon', 'public.set_budget(text, bigint)', 'execute'), 'anon bütçe yazamaz');
select ok(not has_function_privilege('anon', 'public.get_monthly_report(date)', 'execute'), 'anon rapor alamaz');

-- Budgets ------------------------------------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select lives_ok($$ select public.set_budget('groceries', 800000) $$, 'market bütçesi');
select lives_ok($$ select public.set_budget('clothing', 150000) $$, 'giyim bütçesi');
select lives_ok($$ select public.set_budget('groceries', 900000) $$, 'aynı kategori güncellenir');
select throws_ok($$ select public.set_budget('salary', 100) $$, 'P0001', 'validation_error', 'gelir kategorisine bütçe yok');
select throws_ok($$ select public.set_budget('food', -1) $$, 'P0001', 'validation_error', 'eksi sınır');
create temp table b1 as select public.list_budgets('2026-10-01') as r;
select is(
	(select array_agg(k order by k) from jsonb_object_keys((select r -> 'items' -> 0 from b1)) k),
	array['category', 'count', 'limit_minor', 'spent_minor'],
	'bütçe satırı alanları'
);
select results_eq(
	$$ select i ->> 'category', (i ->> 'limit_minor')::bigint, (i ->> 'spent_minor')::bigint, (i ->> 'count')::int
		from b1, jsonb_array_elements(r -> 'items') i order by 1 $$,
	$$ values ('clothing', 150000::bigint, 200000::bigint, 1), ('groceries', 900000::bigint, 128460::bigint, 1) $$,
	'harcanan: silinen ve başka ay sayılmaz'
);
select is((select (r ->> 'total_limit_minor')::bigint from b1), 1050000::bigint, 'toplam bütçe');
select is((select (r ->> 'total_spent_minor')::bigint from b1), 328460::bigint, 'bütçeli kategorilerde harcanan');
select is((select (r ->> 'month_expense_minor')::bigint from b1), 1828460::bigint, 'ayın tüm gideri');
select lives_ok($$ select public.set_budget('clothing', null) $$, 'sınır boş: bütçe kalkar');
select is(jsonb_array_length(public.list_budgets('2026-10-01') -> 'items'), 1, 'bir bütçe kaldı');

-- Monthly report -------------------------------------------------------------------------------------------------
create temp table m1 as select public.get_monthly_report('2026-10-01') as r;
select is((select (r ->> 'income_minor')::bigint from m1), 4650000::bigint, 'ay geliri');
select is((select (r ->> 'expense_minor')::bigint from m1), 1828460::bigint, 'ay gideri (transfer sayılmaz)');
select is(
	(select r -> 'by_category' from m1),
	'[{"category": "rent", "amount_minor": 1500000}, {"category": "clothing", "amount_minor": 200000}, {"category": "groceries", "amount_minor": 128460}]'::jsonb,
	'kategori dağılımı, büyükten küçüğe'
);
select is(jsonb_array_length((select r -> 'series' from m1)), 6, 'altı ay');
select is(
	(select r -> 'series' -> 4 from m1),
	'{"month": "2026-09-01", "income_minor": 4650000, "expense_minor": 784000}'::jsonb,
	'önceki ay'
);
select is((select r -> 'series' -> 0 ->> 'month' from m1), '2026-05-01', 'en eski ay başta');
select throws_ok($$ select public.get_monthly_report('2026-10-05') $$, 'P0001', 'validation_error', 'ay ayın ilk günü');

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is((public.get_monthly_report('2026-10-01') ->> 'expense_minor')::bigint, 0::bigint, 'Bora Ayşe''nin raporunu görmez');

select * from finish();
rollback;
