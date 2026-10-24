-- ADR-053: own accounts (design 29, 33), derived balances, "Toplam Nakit" and "Bakiye düzelt".
begin;
select plan(52);

select set_config('paramnet.today', '2026-10-11', true);
insert into auth.users (id, phone, aud, role) values
	('11111111-1111-4111-8111-111111111111', '905550000001', 'authenticated', 'authenticated'),
	('22222222-2222-4222-8222-222222222222', '905550000002', 'authenticated', 'authenticated');
insert into public.profiles (id, display_name, phone_e164) values
	('11111111-1111-4111-8111-111111111111', 'Ayşe', '+905550000001'),
	('22222222-2222-4222-8222-222222222222', 'Bora', '+905550000002');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
	select set_config('role', 'authenticated', true),
		set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.acc(p_kind text, p_name text, p_opening bigint, p_in_total boolean, p_key uuid) returns jsonb
language sql as $$
	select public.create_account(jsonb_build_object('kind', p_kind, 'name', p_name, 'bank_name', null,
		'opening_balance_minor', p_opening, 'include_in_total', p_in_total), p_key);
$$;
grant execute on function pg_temp.acc(text, text, bigint, boolean, uuid) to authenticated;

select has_table('public', 'accounts', 'accounts tablosu');
select ok(not has_table_privilege('authenticated', 'public.accounts', 'select'), 'hesaplar istemciye kapalı');
select ok(not has_table_privilege('authenticated', 'public.accounts', 'insert'), 'istemci hesap yazamaz');
select ok(not has_function_privilege('anon', 'public.create_account(jsonb, uuid)', 'execute'), 'anon hesap açamaz');
select ok(not has_function_privilege('anon', 'public.list_accounts()', 'execute'), 'anon hesap listeleyemez');
select ok(not has_function_privilege('anon', 'public.get_cash_summary(date)', 'execute'), 'anon özet alamaz');
select ok(not has_function_privilege('anon', 'public.adjust_account_balance(uuid, bigint, uuid)', 'execute'), 'anon düzeltemez');

-- Creating ------------------------------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
create temp table c1 as select public.create_account(
	'{"kind": "bank", "name": "Maaş Hesabı", "bank_name": "İş Bankası", "opening_balance_minor": 1000000, "include_in_total": true}',
	'a0000000-0000-4000-8000-000000000001'
) as r;
grant select on c1 to authenticated;
select is((select r ->> 'replayed' from c1), 'false', 'yeni hesap');
select is(
	(select array_agg(k order by k) from jsonb_object_keys((select r -> 'account' from c1)) k),
	array['archived_at', 'balance_minor', 'bank_name', 'created_at', 'id', 'include_in_total', 'kind', 'name',
		'opening_balance_minor', 'row_version'],
	'hesap alanları'
);
select is((select (r -> 'account' ->> 'balance_minor')::bigint from c1), 1000000::bigint, 'açılış bakiyesi bakiyedir');
select is((select (r -> 'account' ->> 'row_version')::int from c1), 1, 'ilk sürüm');
select is(
	(select public.create_account('{"kind": "bank", "name": "Maaş Hesabı", "bank_name": "İş Bankası", "opening_balance_minor": 1000000, "include_in_total": true}',
		'a0000000-0000-4000-8000-000000000001') ->> 'replayed'),
	'true', 'aynı anahtar: tekrar oynatılır'
);
select is(jsonb_array_length(public.list_accounts() -> 'accounts'), 1, 'tekrarda yeni kayıt yok');

select throws_ok($$ select pg_temp.acc('crypto', 'X', 0, true, gen_random_uuid()) $$, 'P0001', 'validation_error', 'bilinmeyen tür');
select throws_ok($$ select pg_temp.acc('cash', '', 0, true, gen_random_uuid()) $$, 'P0001', 'validation_error', 'boş ad');
select throws_ok($$ select pg_temp.acc('cash', ' Kasa', 0, true, gen_random_uuid()) $$, 'P0001', 'validation_error', 'kırpılmamış ad');
select throws_ok($$ select pg_temp.acc('cash', repeat('x', 41), 0, true, gen_random_uuid()) $$, 'P0001', 'validation_error', 'ad en fazla 40');
select throws_ok($$ select pg_temp.acc('cash', 'Kasa', 10000000000001, true, gen_random_uuid()) $$, 'P0001', 'validation_error', 'tutar sınırı');
select throws_ok(
	$$ select public.create_account('{"kind": "bank", "name": "X", "bank_name": null, "opening_balance_minor": 0, "include_in_total": true, "iban": "TR00"}', gen_random_uuid()) $$,
	'P0001', 'validation_error', 'IBAN ya da bilinmeyen alan alınmaz'
);
select throws_ok(
	$$ select public.create_account('{"kind": "bank", "name": "X", "bank_name": null, "opening_balance_minor": 1.5, "include_in_total": true}', gen_random_uuid()) $$,
	'P0001', 'validation_error', 'kuruş tam sayıdır'
);
select throws_ok($$ select pg_temp.acc('cash', 'Kasa', 0, true, null) $$, 'P0001', 'validation_error', 'anahtar zorunlu');

select lives_ok($$ select pg_temp.acc('cash', 'Nakit Cüzdan', -20000, true, 'a0000000-0000-4000-8000-000000000002') $$, 'eksi açılış bakiyesi olabilir');
select lives_ok($$ select pg_temp.acc('savings', 'Birikim', 650000, false, 'a0000000-0000-4000-8000-000000000003') $$, 'toplama dahil olmayan hesap');

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok(
	$$ select pg_temp.acc('cash', 'Kasa', 0, true, 'a0000000-0000-4000-8000-000000000001') $$,
	'P0001', 'conflict', 'başkasının anahtarı tekrar oynatılmaz'
);
select is(jsonb_array_length(public.list_accounts() -> 'accounts'), 0, 'Bora Ayşe''nin hesaplarını görmez');
select is((public.get_cash_summary('2026-10-01') ->> 'total_cash_minor')::bigint, 0::bigint, 'hesabı olmayanın toplamı 0');
create temp table bora_try as select (select r -> 'account' ->> 'id' from c1)::uuid as id;
select throws_ok(
	format($$ select public.update_account(%L, '{"kind": "cash", "name": "Benim", "bank_name": null, "opening_balance_minor": 0, "include_in_total": true}', 1) $$,
		(select id from bora_try)),
	'P0001', 'not_found', 'başkasının hesabı düzenlenemez'
);
select throws_ok(format($$ select public.archive_account(%L, 1) $$, (select id from bora_try)), 'P0001', 'not_found', 'başkasının hesabı arşivlenemez');

-- Listing and Toplam Nakit ----------------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
create temp table l1 as select public.list_accounts() as r;
select is(jsonb_array_length((select r -> 'accounts' from l1)), 3, 'üç hesap');
select is((select r -> 'accounts' -> 0 ->> 'name' from l1), 'Maaş Hesabı', 'açılış sırasıyla');
select is((select (r ->> 'total_cash_minor')::bigint from l1), 980000::bigint, 'toplam: dahil olanlar (eksi bakiye düşer)');
select is((select (r ->> 'included_count')::int from l1), 2, 'toplama giren hesap sayısı');

-- Editing --------------------------------------------------------------------------------------------------
select is(
	(public.update_account((select (r -> 'account' ->> 'id')::uuid from c1),
		'{"kind": "bank", "name": "Maaş", "bank_name": null, "opening_balance_minor": 1200000, "include_in_total": true}', 1)
		-> 'account' ->> 'balance_minor')::bigint,
	1200000::bigint, 'açılış bakiyesi düzenlenebilir'
);
select throws_ok(
	format($$ select public.update_account(%L, '{"kind": "bank", "name": "Maaş", "bank_name": null, "opening_balance_minor": 0, "include_in_total": true}', 1) $$,
		(select (r -> 'account' ->> 'id')::uuid from c1)),
	'P0001', 'conflict', 'eski row_version'
);

-- Bakiye düzelt ---------------------------------------------------------------------------------------------
create temp table adj as select public.adjust_account_balance(
	(select (r -> 'account' ->> 'id')::uuid from c1), 1250000, 'b0000000-0000-4000-8000-000000000001'
) as r;
select is((select r -> 'transaction' ->> 'kind' from adj), 'adjustment', 'düzeltme kaydı');
select is((select (r -> 'transaction' ->> 'amount_minor')::bigint from adj), 50000::bigint, 'fark yazılır');
select is((select (r -> 'account' ->> 'balance_minor')::bigint from adj), 1250000::bigint, 'yeni bakiye hedefe eşit');
select is(
	(public.adjust_account_balance((select (r -> 'account' ->> 'id')::uuid from c1), 1250000, 'b0000000-0000-4000-8000-000000000001')
		-> 'transaction' ->> 'id'),
	(select r -> 'transaction' ->> 'id' from adj), 'aynı anahtar: aynı düzeltme'
);
select throws_ok(
	format($$ select public.adjust_account_balance(%L, 1250000, gen_random_uuid()) $$, (select (r -> 'account' ->> 'id')::uuid from c1)),
	'P0001', 'validation_error', 'fark yoksa kayıt yok'
);
select is((public.get_cash_summary('2026-10-01') ->> 'income_minor')::bigint, 0::bigint, 'düzeltme gelir sayılmaz');

-- Archiving --------------------------------------------------------------------------------------------------
create temp table cash_id as select (r -> 'accounts' -> 1 ->> 'id')::uuid as id, (r -> 'accounts' -> 1 ->> 'row_version')::int as v from l1;
select ok(
	(public.archive_account((select id from cash_id), (select v from cash_id)) -> 'account' ->> 'archived_at') is not null,
	'arşivlendi'
);
select throws_ok(
	format($$ select public.archive_account(%L, %s) $$, (select id from cash_id), (select v + 1 from cash_id)),
	'P0001', 'invalid_transition', 'arşivlenmiş hesap yeniden arşivlenmez'
);
select is(jsonb_array_length(public.list_accounts() -> 'accounts'), 2, 'arşivlenen listede yok');
select is((public.list_accounts() ->> 'total_cash_minor')::bigint, 1250000::bigint, 'arşivlenen toplama girmez');
select throws_ok(
	format($$ select public.adjust_account_balance(%L, 0, gen_random_uuid()) $$, (select id from cash_id)),
	'P0001', 'validation_error', 'arşivlenmiş hesaba kayıt girilmez'
);

-- At most 50 accounts -----------------------------------------------------------------------------------------
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select lives_ok($$ select pg_temp.acc('other', 'Hesap ' || i, 0, true, gen_random_uuid()) from generate_series(1, 50) i $$, '50 hesap');
select throws_ok($$ select pg_temp.acc('other', 'Bir fazla', 0, true, gen_random_uuid()) $$, 'P0001', 'validation_error', '51. hesap açılmaz');

-- Export and erasure --------------------------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(jsonb_array_length(public.export_my_data() -> 'accounts'), 3, 'dışa aktarma arşivlenenle birlikte tüm hesapları içerir');
select is(jsonb_array_length(public.export_my_data() -> 'transactions'), 1, 'dışa aktarma işlemleri içerir');

reset role;
select lives_ok($$ select public.delete_account_data('11111111-1111-4111-8111-111111111111') $$, 'hesap silme çalışır');
select is((select count(*)::int from public.accounts where owner_id = '11111111-1111-4111-8111-111111111111'), 0, 'hesap silmede hesaplar silinir');
select is((select count(*)::int from public.transactions where owner_id = '11111111-1111-4111-8111-111111111111'), 0, 'hesap silmede işlemler silinir');

select * from finish();
rollback;
