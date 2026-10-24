-- ADR-053: expense, income and transfer records (design 21, 22, 36, 37), soft delete with undo, edit history.
begin;
select plan(56);

select set_config('paramnet.today', '2026-10-11', true);
insert into auth.users (id, phone, aud, role) values
	('11111111-1111-4111-8111-111111111111', '905550000001', 'authenticated', 'authenticated'),
	('22222222-2222-4222-8222-222222222222', '905550000002', 'authenticated', 'authenticated');
insert into public.profiles (id, display_name, phone_e164) values
	('11111111-1111-4111-8111-111111111111', 'Ayşe', '+905550000001'),
	('22222222-2222-4222-8222-222222222222', 'Bora', '+905550000002');
-- Same accounts as test-vectors/accounts.json "açılış bakiyesi, gelir, gider, transfer ve düzeltme".
insert into public.accounts (id, owner_id, kind, name, opening_balance_minor, include_in_total) values
	('a1a1a1a1-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'bank', 'Maaş Hesabı', 1000000, true),
	('a1a1a1a1-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'cash', 'Nakit Cüzdan', 0, true),
	('a1a1a1a1-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'savings', 'Birikim', 50000, false),
	('b2b2b2b2-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'cash', 'Bora Kasa', 0, true);

create function pg_temp.act_as(uid uuid) returns void language sql as $$
	select set_config('role', 'authenticated', true),
		set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.tx(p_kind text, p_from text, p_to text, p_amount bigint, p_category text, p_on text, p_key uuid) returns jsonb
language sql as $$
	select public.create_transaction(jsonb_build_object('kind', p_kind, 'account_id', p_from, 'to_account_id', p_to,
		'amount_minor', p_amount, 'category', p_category, 'title', null, 'note', null, 'occurred_on', p_on), p_key);
$$;
grant execute on function pg_temp.tx(text, text, text, bigint, text, text, uuid) to authenticated;

select has_table('public', 'transactions', 'transactions tablosu');
select has_table('public', 'transaction_events', 'transaction_events tablosu');
select ok(not has_table_privilege('authenticated', 'public.transactions', 'select'), 'işlemler istemciye kapalı');
select ok(not has_table_privilege('authenticated', 'public.transactions', 'update'), 'istemci işlem değiştiremez');
select ok(not has_function_privilege('anon', 'public.create_transaction(jsonb, uuid)', 'execute'), 'anon işlem yazamaz');
select ok(not has_function_privilege('anon', 'public.list_transactions(date, uuid)', 'execute'), 'anon işlem listeleyemez');
select ok(not has_function_privilege('anon', 'public.get_transaction(uuid)', 'execute'), 'anon işlem okuyamaz');

-- Creating ---------------------------------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
create temp table t_income as select pg_temp.tx('income', 'a1a1a1a1-0000-4000-8000-000000000001', null, 3850000, 'salary', '2026-10-01', 'c0000000-0000-4000-8000-000000000001') as r;
grant select on t_income to authenticated;
select is((select r ->> 'replayed' from t_income), 'false', 'gelir yazıldı');
select is(
	(select array_agg(k order by k) from jsonb_object_keys((select r -> 'transaction' from t_income)) k),
	array['account_id', 'account_name', 'amount_minor', 'card_id', 'card_name', 'category', 'created_at', 'deleted_at',
		'id', 'installments', 'kind', 'note', 'occurred_on', 'row_version', 'title', 'to_account_id', 'to_account_name',
		'to_card_id', 'to_card_name', 'to_loan_id', 'to_loan_name', 'updated_at'],
	'işlem alanları'
);
select is((select r -> 'transaction' ->> 'account_name' from t_income), 'Maaş Hesabı', 'hesap adı döner');
select is(
	(pg_temp.tx('income', 'a1a1a1a1-0000-4000-8000-000000000001', null, 3850000, 'salary', '2026-10-01', 'c0000000-0000-4000-8000-000000000001') ->> 'replayed'),
	'true', 'aynı anahtar: tekrar oynatılır'
);
select is(jsonb_array_length(public.list_transactions('2026-10-01', null) -> 'items'), 1, 'tekrarda yeni kayıt yok');

create temp table t_exp as select pg_temp.tx('expense', 'a1a1a1a1-0000-4000-8000-000000000001', null, 84230, 'bills', '2026-10-08', gen_random_uuid()) as r;
grant select on t_exp to authenticated;
create temp table t_tr as select pg_temp.tx('transfer', 'a1a1a1a1-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000002', 200000, null, '2026-10-05', gen_random_uuid()) as r;
grant select on t_tr to authenticated;
select is((select r -> 'transaction' ->> 'to_account_name' from t_tr), 'Nakit Cüzdan', 'transferin hedef hesabı');
create temp table t_adj as select public.adjust_account_balance('a1a1a1a1-0000-4000-8000-000000000002', 198500, gen_random_uuid()) as r;
grant select on t_adj to authenticated;
select is((select (r -> 'transaction' ->> 'amount_minor')::bigint from t_adj), -1500::bigint, 'düzeltme: eksi fark');
select lives_ok($$ select pg_temp.tx('expense', 'a1a1a1a1-0000-4000-8000-000000000003', null, 10000, 'other', '2026-09-30', gen_random_uuid()) $$, 'eylül gideri');
create temp table t_del as select pg_temp.tx('expense', 'a1a1a1a1-0000-4000-8000-000000000001', null, 999999, 'groceries', '2026-10-10', gen_random_uuid()) as r;
grant select on t_del to authenticated;

select throws_ok($$ select pg_temp.tx('expense', 'a1a1a1a1-0000-4000-8000-000000000001', null, 0, 'food', '2026-10-01', gen_random_uuid()) $$, 'P0001', 'validation_error', 'sıfır tutar');
select throws_ok($$ select pg_temp.tx('expense', 'a1a1a1a1-0000-4000-8000-000000000001', null, 100, 'salary', '2026-10-01', gen_random_uuid()) $$, 'P0001', 'validation_error', 'gidere gelir kategorisi');
select throws_ok($$ select pg_temp.tx('income', 'a1a1a1a1-0000-4000-8000-000000000001', null, 100, null, '2026-10-01', gen_random_uuid()) $$, 'P0001', 'validation_error', 'kategori zorunlu');
select throws_ok($$ select pg_temp.tx('transfer', 'a1a1a1a1-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001', 100, null, '2026-10-01', gen_random_uuid()) $$, 'P0001', 'validation_error', 'aynı hesaba transfer');
select throws_ok($$ select pg_temp.tx('transfer', 'a1a1a1a1-0000-4000-8000-000000000001', null, 100, null, '2026-10-01', gen_random_uuid()) $$, 'P0001', 'validation_error', 'transferin hedefi zorunlu');
select throws_ok($$ select pg_temp.tx('expense', 'a1a1a1a1-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000002', 100, 'food', '2026-10-01', gen_random_uuid()) $$, 'P0001', 'validation_error', 'giderin hedefi olmaz');
select throws_ok($$ select pg_temp.tx('adjustment', 'a1a1a1a1-0000-4000-8000-000000000001', null, 100, null, '2026-10-01', gen_random_uuid()) $$, 'P0001', 'validation_error', 'düzeltme bu yoldan yazılmaz');
select throws_ok($$ select pg_temp.tx('expense', 'a1a1a1a1-0000-4000-8000-000000000001', null, 100, 'food', '2026-02-30', gen_random_uuid()) $$, 'P0001', 'validation_error', 'geçersiz tarih');
select throws_ok($$ select pg_temp.tx('expense', 'b2b2b2b2-0000-4000-8000-000000000001', null, 100, 'food', '2026-10-01', gen_random_uuid()) $$, 'P0001', 'not_found', 'başkasının hesabına yazılamaz');
select throws_ok($$ select pg_temp.tx('transfer', 'a1a1a1a1-0000-4000-8000-000000000001', 'b2b2b2b2-0000-4000-8000-000000000001', 100, null, '2026-10-01', gen_random_uuid()) $$, 'P0001', 'not_found', 'başkasının hesabına transfer edilemez');
select throws_ok(
	$$ select public.create_transaction('{"kind": "expense", "account_id": "a1a1a1a1-0000-4000-8000-000000000001", "to_account_id": null, "amount_minor": 100, "category": "food", "title": null, "note": null, "occurred_on": "2026-10-01", "iban": null}', gen_random_uuid()) $$,
	'P0001', 'validation_error', 'bilinmeyen alan alınmaz'
);

-- Soft delete and undo --------------------------------------------------------------------------------------------
create temp table d1 as select public.delete_transaction((select (r -> 'transaction' ->> 'id')::uuid from t_del), 1) as r;
select ok((select r -> 'transaction' ->> 'deleted_at' from d1) is not null, 'silindi olarak işaretlendi');
select throws_ok(
	format($$ select public.delete_transaction(%L, 2) $$, (select r -> 'transaction' ->> 'id' from t_del)),
	'P0001', 'invalid_transition', 'silinen yeniden silinmez'
);

-- Balances match the shared vector ----------------------------------------------------------------------------------
create temp table l1 as select public.list_accounts() as r;
select results_eq(
	$$ select a ->> 'id', (a ->> 'balance_minor')::bigint from l1, jsonb_array_elements(r -> 'accounts') a order by a ->> 'id' $$,
	$$ values ('a1a1a1a1-0000-4000-8000-000000000001', 4565770::bigint), ('a1a1a1a1-0000-4000-8000-000000000002', 198500::bigint),
		('a1a1a1a1-0000-4000-8000-000000000003', 40000::bigint) $$,
	'bakiyeler paylaşılan vektörle aynı'
);
select is((select (r ->> 'total_cash_minor')::bigint from l1), 4764270::bigint, 'Toplam Nakit vektörle aynı');
create temp table s1 as select public.get_cash_summary('2026-10-01') as r;
select is((select (r ->> 'income_minor')::bigint from s1), 3850000::bigint, 'ekim geliri (transfer ve düzeltme sayılmaz)');
select is((select (r ->> 'expense_minor')::bigint from s1), 84230::bigint, 'ekim gideri (silinen ve eylül sayılmaz)');
select is((select (r ->> 'account_count')::int from s1), 2, 'özet: toplama giren hesap sayısı');
select ok((select r ->> 'updated_at' from s1) is not null, 'özet: son güncelleme zamanı');
select throws_ok($$ select public.get_cash_summary('2026-10-05') $$, 'P0001', 'validation_error', 'ay ayın ilk günüdür');

-- Restore ----------------------------------------------------------------------------------------------------------
select is(
	(public.restore_transaction((select (r -> 'transaction' ->> 'id')::uuid from t_del), 2) -> 'transaction' ->> 'deleted_at'),
	null, 'geri alındı'
);
select is((public.get_cash_summary('2026-10-01') ->> 'expense_minor')::bigint, 1084229::bigint, 'geri alınan yeniden sayılır');
select throws_ok(
	format($$ select public.restore_transaction(%L, 3) $$, (select r -> 'transaction' ->> 'id' from t_del)),
	'P0001', 'invalid_transition', 'silinmemiş geri alınmaz'
);

-- Listing -----------------------------------------------------------------------------------------------------------
create temp table m1 as select public.list_transactions('2026-10-01', null) as r;
select is(jsonb_array_length((select r -> 'items' from m1)), 5, 'ekim: beş kayıt (düzeltme dahil)');
select is((select r -> 'items' -> 0 ->> 'occurred_on' from m1), '2026-10-11', 'yeniden eskiye; düzeltme bugünün tarihini alır');
select is((select (r ->> 'income_minor')::bigint from m1), 3850000::bigint, 'listede ayın geliri');
select is(
	jsonb_array_length(public.list_transactions('2026-10-01', 'a1a1a1a1-0000-4000-8000-000000000002') -> 'items'),
	2, 'hesap filtresi: gelen transfer ve düzeltme'
);
select is(jsonb_array_length(public.list_transactions('2026-09-01', null) -> 'items'), 1, 'eylül');

-- Editing and its history -----------------------------------------------------------------------------------------
create temp table u1 as select public.update_transaction(
	(select (r -> 'transaction' ->> 'id')::uuid from t_exp),
	'{"kind": "expense", "account_id": "a1a1a1a1-0000-4000-8000-000000000001", "to_account_id": null, "amount_minor": 84230, "category": "rent", "title": "Elektrik", "note": "Ekim", "occurred_on": "2026-10-08"}',
	1
) as r;
select is((select r -> 'transaction' ->> 'category' from u1), 'rent', 'kategori değişti');
select is((select (r -> 'transaction' ->> 'row_version')::int from u1), 2, 'sürüm arttı');
select throws_ok(
	format($$ select public.update_transaction(%L, '{"kind": "expense", "account_id": "a1a1a1a1-0000-4000-8000-000000000001", "to_account_id": null, "amount_minor": 1, "category": "rent", "title": null, "note": null, "occurred_on": "2026-10-08"}', 1) $$,
		(select r -> 'transaction' ->> 'id' from t_exp)),
	'P0001', 'conflict', 'eski row_version'
);
create temp table g1 as select public.get_transaction((select (r -> 'transaction' ->> 'id')::uuid from t_exp)) as r;
select is(
	(select jsonb_agg(e ->> 'type' order by ord) from g1, jsonb_array_elements(r -> 'events') with ordinality x(e, ord)),
	'["created", "updated"]'::jsonb, 'olay geçmişi'
);
select is(
	(select r -> 'events' -> 1 -> 'changes' from g1),
	'{"category": ["bills", "rent"], "note": [null, "Ekim"], "title": [null, "Elektrik"]}'::jsonb,
	'değişen alanlar eski ve yeni değerle'
);
select throws_ok(
	format($$ select public.update_transaction(%L, '{"kind": "expense", "account_id": "a1a1a1a1-0000-4000-8000-000000000001", "to_account_id": null, "amount_minor": 1, "category": "rent", "title": null, "note": null, "occurred_on": "2026-10-08"}', 1) $$,
		(select r -> 'transaction' ->> 'id' from t_adj)),
	'P0001', 'invalid_transition', 'düzeltme düzenlenmez, yalnızca silinir'
);

-- Archived accounts and other people ---------------------------------------------------------------------------------
reset role;
update public.accounts set archived_at = now() where id = 'a1a1a1a1-0000-4000-8000-000000000003';
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select throws_ok($$ select pg_temp.tx('expense', 'a1a1a1a1-0000-4000-8000-000000000003', null, 100, 'food', '2026-10-01', gen_random_uuid()) $$, 'P0001', 'validation_error', 'arşivlenmiş hesaba yeni kayıt girilmez');
select is(jsonb_array_length(public.list_transactions('2026-09-01', null) -> 'items'), 1, 'arşivlenen hesabın geçmişi kalır');

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok(format($$ select public.get_transaction(%L) $$, (select r -> 'transaction' ->> 'id' from t_exp)), 'P0001', 'not_found', 'başkasının işlemi okunmaz');
select throws_ok(format($$ select public.delete_transaction(%L, 2) $$, (select r -> 'transaction' ->> 'id' from t_exp)), 'P0001', 'not_found', 'başkasının işlemi silinmez');
select is(jsonb_array_length(public.list_transactions('2026-10-01', null) -> 'items'), 0, 'Bora Ayşe''nin işlemlerini görmez');

-- History is append only ----------------------------------------------------------------------------------------------
reset role;
select throws_ok($$ update public.transaction_events set type = 'created' $$, 'P0001', null, 'olay geçmişi değiştirilemez');
select throws_ok($$ delete from public.transaction_events $$, 'P0001', null, 'olay geçmişi silinemez');

select * from finish();
rollback;
