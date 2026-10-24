-- ADR-054: repeating income and expense (design 38): planned dates, confirm or skip, automatic posting.
begin;
select plan(38);

select set_config('paramnet.today', '2026-10-24', true);
insert into auth.users (id, phone, aud, role) values
	('11111111-1111-4111-8111-111111111111', '905550000001', 'authenticated', 'authenticated'),
	('22222222-2222-4222-8222-222222222222', '905550000002', 'authenticated', 'authenticated');
insert into public.profiles (id, display_name, phone_e164) values
	('11111111-1111-4111-8111-111111111111', 'Ayşe', '+905550000001'),
	('22222222-2222-4222-8222-222222222222', 'Bora', '+905550000002');
insert into public.accounts (id, owner_id, kind, name, opening_balance_minor) values
	('a1a1a1a1-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'bank', 'Maaş Hesabı', 0),
	('b2b2b2b2-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'cash', 'Bora Kasa', 0);

create function pg_temp.act_as(uid uuid) returns void language sql as $$
	select set_config('role', 'authenticated', true),
		set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.rule(p_name text, p_freq text, p_start text, p_confirm boolean, p_key uuid) returns jsonb
language sql as $$
	select public.create_recurring(jsonb_build_object('kind', 'expense', 'name', p_name, 'amount_minor', 120000,
		'category', 'health', 'account_id', 'a1a1a1a1-0000-4000-8000-000000000001', 'frequency', p_freq,
		'start_on', p_start, 'confirm_each', p_confirm), p_key);
$$;
grant execute on function pg_temp.rule(text, text, text, boolean, uuid) to authenticated;

select has_table('public', 'recurring_rules', 'recurring_rules tablosu');
select ok(not has_table_privilege('authenticated', 'public.recurring_rules', 'select'), 'kurallar istemciye kapalı');
select ok(not has_function_privilege('anon', 'public.create_recurring(jsonb, uuid)', 'execute'), 'anon kural yazamaz');
select ok(not has_function_privilege('anon', 'public.list_recurring()', 'execute'), 'anon kural okuyamaz');
select ok(not has_function_privilege('authenticated', 'private.post_due_recurring(date)', 'execute'), 'otomatik kayıt yalnızca sunucuda');

-- Creating -----------------------------------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
create temp table r1 as select pg_temp.rule('Spor salonu', 'monthly', '2026-10-20', true, 'c0000000-0000-4000-8000-000000000001') as r;
grant select on r1 to authenticated;
select is(
	(select array_agg(k order by k) from jsonb_object_keys((select r -> 'rule' from r1)) k),
	array['account_id', 'account_name', 'amount_minor', 'category', 'confirm_each', 'created_at', 'frequency', 'id',
		'kind', 'name', 'next_dates', 'paused_at', 'pending_dates', 'row_version', 'start_on'],
	'kural alanları'
);
select is((select r -> 'rule' -> 'next_dates' from r1), '["2026-11-20", "2026-12-20", "2027-01-20"]'::jsonb, 'sonraki üç tarih (bugünden sonra)');
select is((select r -> 'rule' -> 'pending_dates' from r1), '["2026-10-20"]'::jsonb, 'onay bekleyen tarih');
select is(
	(pg_temp.rule('Spor salonu', 'monthly', '2026-10-20', true, 'c0000000-0000-4000-8000-000000000001') -> 'rule' ->> 'id'),
	(select r -> 'rule' ->> 'id' from r1), 'aynı anahtar: aynı kural'
);
select throws_ok($$ select pg_temp.rule('', 'monthly', '2026-10-20', true, gen_random_uuid()) $$, 'P0001', 'validation_error', 'ad zorunlu');
select throws_ok($$ select pg_temp.rule('X', 'daily', '2026-10-20', true, gen_random_uuid()) $$, 'P0001', 'validation_error', 'bilinmeyen sıklık');
select throws_ok(
	$$ select public.create_recurring('{"kind": "expense", "name": "X", "amount_minor": 1, "category": "salary", "account_id": "a1a1a1a1-0000-4000-8000-000000000001", "frequency": "monthly", "start_on": "2026-10-20", "confirm_each": true}', gen_random_uuid()) $$,
	'P0001', 'validation_error', 'gidere gelir kategorisi'
);
select throws_ok(
	$$ select public.create_recurring('{"kind": "expense", "name": "X", "amount_minor": 1, "category": "food", "account_id": "b2b2b2b2-0000-4000-8000-000000000001", "frequency": "monthly", "start_on": "2026-10-20", "confirm_each": true}', gen_random_uuid()) $$,
	'P0001', 'not_found', 'başkasının hesabına kural yazılamaz'
);

-- At most a month back from the day the rule was made ------------------------------------------------------------
create temp table r2 as select pg_temp.rule('Kira', 'monthly', '2026-01-03', true, gen_random_uuid()) as r;
grant select on r2 to authenticated;
select is((select r -> 'rule' -> 'pending_dates' from r2), '["2026-10-03"]'::jsonb, 'daha eski aylar borç sayılmaz');

-- Confirm and skip --------------------------------------------------------------------------------------------------
create temp table c1 as select public.confirm_recurring((select (r -> 'rule' ->> 'id')::uuid from r1), '2026-10-20', 'd0000000-0000-4000-8000-000000000001') as r;
select is((select r -> 'transaction' ->> 'kind' from c1), 'expense', 'onay gerçekleşen gider yazar');
select is((select r -> 'transaction' ->> 'title' from c1), 'Spor salonu', 'başlık kuralın adı');
select is((select r -> 'transaction' ->> 'occurred_on' from c1), '2026-10-20', 'tarih planlı tarih');
select is((select (r -> 'transaction' ->> 'amount_minor')::bigint from c1), 120000::bigint, 'tutar');
select is(
	(public.confirm_recurring((select (r -> 'rule' ->> 'id')::uuid from r1), '2026-10-20', 'd0000000-0000-4000-8000-000000000001') -> 'transaction' ->> 'id'),
	(select r -> 'transaction' ->> 'id' from c1), 'aynı anahtar: aynı kayıt'
);
select throws_ok(
	format($$ select public.confirm_recurring(%L, '2026-10-20', gen_random_uuid()) $$, (select r -> 'rule' ->> 'id' from r1)),
	'P0001', 'invalid_transition', 'aynı tarih ikinci kez onaylanmaz'
);
select throws_ok(
	format($$ select public.confirm_recurring(%L, '2026-11-20', gen_random_uuid()) $$, (select r -> 'rule' ->> 'id' from r1)),
	'P0001', 'invalid_transition', 'gelmemiş tarih onaylanmaz'
);
select throws_ok(
	format($$ select public.confirm_recurring(%L, '2026-10-21', gen_random_uuid()) $$, (select r -> 'rule' ->> 'id' from r1)),
	'P0001', 'invalid_transition', 'kuralın tarihi olmayan gün'
);
select is(jsonb_array_length(public.list_recurring() -> 'rules' -> 0 -> 'pending_dates'), 0, 'onaylanan bekleyenlerden çıkar');

create temp table r3 as select pg_temp.rule('Haftalık', 'weekly', '2026-10-10', true, gen_random_uuid()) as r;
grant select on r3 to authenticated;
select is((select r -> 'rule' -> 'pending_dates' from r3), '["2026-10-10", "2026-10-17", "2026-10-24"]'::jsonb, 'haftalık: başlangıçtan bugüne');
select lives_ok(format($$ select public.skip_recurring(%L, '2026-10-24') $$, (select r -> 'rule' ->> 'id' from r3)), 'atla');
select is(
	(select r -> 'pending_dates' from (select jsonb_array_elements(public.list_recurring() -> 'rules') r) x where r ->> 'name' = 'Haftalık'),
	'["2026-10-10", "2026-10-17"]'::jsonb, 'atlanan bekleyenlerden çıkar'
);

-- Automatic posting ------------------------------------------------------------------------------------------------
create temp table r4 as select pg_temp.rule('Otomatik', 'monthly', '2026-10-24', false, gen_random_uuid()) as r;
grant select on r4 to authenticated;
select is((select r -> 'rule' -> 'pending_dates' from r4), '[]'::jsonb, 'onaysız kural bekleyen göstermez');
reset role;
select is(private.post_due_recurring('2026-10-24'), 1, 'günü gelen onaysız tarih kaydedilir');
select is(private.post_due_recurring('2026-10-24'), 0, 'ikinci çalışmada tekrar yazılmaz');
select is(
	(select count(*)::int from public.transactions where title = 'Otomatik' and occurred_on = '2026-10-24'),
	1, 'otomatik kayıt tek'
);
select is(
	(select count(*)::int from public.transactions where title = 'Spor salonu'),
	1, 'onaylı kurallar otomatik yazılmaz'
);

-- Pause, edit, delete ----------------------------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select ok(
	(public.set_recurring_paused((select (r -> 'rule' ->> 'id')::uuid from r4), true, 1) -> 'rule' ->> 'paused_at') is not null,
	'durduruldu'
);
reset role;
select is(private.post_due_recurring('2026-11-24'), 0, 'durdurulan kural kaydedilmez');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(
	(public.update_recurring((select (r -> 'rule' ->> 'id')::uuid from r1),
		'{"kind": "expense", "name": "Spor", "amount_minor": 150000, "category": "health", "account_id": "a1a1a1a1-0000-4000-8000-000000000001", "frequency": "monthly", "start_on": "2026-10-20", "confirm_each": true}',
		1) -> 'rule' ->> 'amount_minor')::bigint,
	150000::bigint, 'düzenleme'
);
select throws_ok(
	format($$ select public.delete_recurring(%L, 1) $$, (select r -> 'rule' ->> 'id' from r1)),
	'P0001', 'conflict', 'eski row_version'
);
select lives_ok(format($$ select public.delete_recurring(%L, 2) $$, (select r -> 'rule' ->> 'id' from r1)), 'silindi');
select is(
	(select count(*)::int from jsonb_array_elements(public.list_transactions('2026-10-01', null) -> 'items') i where i ->> 'title' = 'Spor salonu'),
	1, 'silinen kuralın kayıtları kalır'
);

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is(jsonb_array_length(public.list_recurring() -> 'rules'), 0, 'Bora Ayşe''nin kurallarını görmez');

select * from finish();
rollback;
