-- ADR-055: credit cards (design 07, 08, 09, 32): card purchases, instalments, payments from an account.
begin;
select plan(37);

select set_config('paramnet.today', '2026-10-12', true);
insert into auth.users (id, phone, aud, role) values
	('11111111-1111-4111-8111-111111111111', '905550000001', 'authenticated', 'authenticated'),
	('22222222-2222-4222-8222-222222222222', '905550000002', 'authenticated', 'authenticated');
insert into public.profiles (id, display_name, phone_e164) values
	('11111111-1111-4111-8111-111111111111', 'Ayşe', '+905550000001'),
	('22222222-2222-4222-8222-222222222222', 'Bora', '+905550000002');
insert into public.accounts (id, owner_id, kind, name, opening_balance_minor) values
	('a1a1a1a1-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'bank', 'Maaş Hesabı', 2000000);

create function pg_temp.act_as(uid uuid) returns void language sql as $$
	select set_config('role', 'authenticated', true),
		set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.card_tx(p_kind text, p_card uuid, p_amount bigint, p_on text, p_installments int) returns jsonb
language sql as $$
	select public.create_transaction(jsonb_build_object('kind', p_kind, 'account_id', null, 'to_account_id', null,
		'card_id', p_card, 'to_card_id', null, 'installments', p_installments, 'amount_minor', p_amount,
		'category', case when p_kind = 'income' then 'refund' else 'groceries' end, 'title', 'Migros', 'note', null,
		'occurred_on', p_on), gen_random_uuid());
$$;
grant execute on function pg_temp.card_tx(text, uuid, bigint, text, int) to authenticated;

select has_table('public', 'cards', 'cards tablosu');
select ok(not has_table_privilege('authenticated', 'public.cards', 'select'), 'kartlar istemciye kapalı');
select ok(not has_function_privilege('anon', 'public.create_card(jsonb, uuid)', 'execute'), 'anon kart ekleyemez');
select ok(not has_function_privilege('anon', 'public.get_card(uuid)', 'execute'), 'anon kart okuyamaz');

-- Adding a card --------------------------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
create temp table c1 as select public.create_card(
	'{"bank_name": "Yapı Kredi", "card_name": "World", "last4": "4281", "color": "navy", "limit_minor": 6000000, "opening_debt_minor": 0, "statement_day": 9, "due_offset_days": 10, "min_payment_rate": 40}',
	'e0000000-0000-4000-8000-000000000001'
) as r;
grant select on c1 to authenticated;
create temp table card_id as select (r -> 'card' ->> 'id')::uuid as id from c1;
grant select on card_id to authenticated;
select is((select r -> 'card' ->> 'label' from c1), 'Yapı Kredi World ••4281', 'kart etiketi');
select is(
	(select array_agg(k order by k) from jsonb_object_keys((select r -> 'card' from c1)) k),
	array['archived_at', 'bank_name', 'card_name', 'color', 'created_at', 'due_offset_days', 'id', 'label', 'last4',
		'limit_minor', 'min_payment_rate', 'opening_debt_minor', 'row_version', 'state', 'statement_day'],
	'kart alanları'
);
select is((select r -> 'card' -> 'state' ->> 'last_cut' from c1), '2026-10-09', 'son kesim');
select is((select r -> 'card' -> 'state' ->> 'due_date' from c1), '2026-10-19', 'son ödeme');
select is(
	(public.create_card('{"bank_name": "Yapı Kredi", "card_name": "World", "last4": "4281", "color": "navy", "limit_minor": 6000000, "opening_debt_minor": 0, "statement_day": 9, "due_offset_days": 10, "min_payment_rate": 40}',
		'e0000000-0000-4000-8000-000000000001') ->> 'replayed'),
	'true', 'aynı anahtar: tekrar oynatılır'
);
select throws_ok(
	$$ select public.create_card('{"bank_name": "X", "card_name": null, "last4": "4111111111111111", "color": "navy", "limit_minor": 1, "opening_debt_minor": 0, "statement_day": 9, "due_offset_days": 10, "min_payment_rate": 20}', gen_random_uuid()) $$,
	'P0001', 'validation_error', 'tam kart numarası alınmaz'
);
select throws_ok(
	$$ select public.create_card('{"bank_name": "X", "card_name": null, "last4": "1234", "color": "navy", "limit_minor": 1, "opening_debt_minor": 0, "statement_day": 9, "due_offset_days": 10, "min_payment_rate": 20, "cvv": "123"}', gen_random_uuid()) $$,
	'P0001', 'validation_error', 'CVV ya da bilinmeyen alan alınmaz'
);
select throws_ok(
	$$ select public.create_card('{"bank_name": "X", "card_name": null, "last4": "1234", "color": "navy", "limit_minor": 1, "opening_debt_minor": 0, "statement_day": 31, "due_offset_days": 10, "min_payment_rate": 20}', gen_random_uuid()) $$,
	'P0001', 'validation_error', 'kesim günü en fazla 28'
);

-- Card purchases, instalments, refunds and a payment ----------------------------------------------------------
select lives_ok(format($$ select pg_temp.card_tx('expense', %L, 1092000, '2026-09-05', 1) $$, (select id from card_id)), 'kart harcaması');
create temp table inst as select pg_temp.card_tx('expense', (select id from card_id), 1665000, '2026-08-20', 9) as r;
grant select on inst to authenticated;
select is((select (r -> 'transaction' ->> 'installments')::int from inst), 9, 'taksitli harcama');
select is((select r -> 'transaction' ->> 'card_name' from inst), 'Yapı Kredi World ••4281', 'işlemde kart adı');
select lives_ok($$ select public.create_transaction(jsonb_build_object('kind', 'transfer', 'account_id', 'a1a1a1a1-0000-4000-8000-000000000001',
	'to_account_id', null, 'card_id', null, 'to_card_id', (select id from card_id), 'installments', 1, 'amount_minor', 500000,
	'category', null, 'title', null, 'note', null, 'occurred_on', '2026-09-15'), gen_random_uuid()) $$, 'karta ödeme');
select lives_ok(format($$ select pg_temp.card_tx('expense', %L, 340000, '2026-09-30', 1) $$, (select id from card_id)), 'eylül sonu');
select lives_ok(format($$ select pg_temp.card_tx('expense', %L, 128460, '2026-10-11', 1) $$, (select id from card_id)), 'dönem içi');
select lives_ok(format($$ select pg_temp.card_tx('income', %L, 20000, '2026-10-11', 1) $$, (select id from card_id)), 'iade');
select lives_ok($$ select public.create_transaction(jsonb_build_object('kind', 'transfer', 'account_id', 'a1a1a1a1-0000-4000-8000-000000000001',
	'to_account_id', null, 'card_id', null, 'to_card_id', (select id from card_id), 'installments', 1, 'amount_minor', 100000,
	'category', null, 'title', null, 'note', null, 'occurred_on', '2026-10-10'), gen_random_uuid()) $$, 'ikinci ödeme');

-- The same statement as the shared vector "ekstre, dönem içi harcama, taksit ve kısmi ödeme".
create temp table s1 as select public.get_card((select id from card_id)) as r;
select is((select (r -> 'card' -> 'state' ->> 'statement_minor')::bigint from s1), 1302000::bigint, 'ekstre');
select is((select (r -> 'card' -> 'state' ->> 'statement_remaining_minor')::bigint from s1), 1202000::bigint, 'kalan ekstre');
select is((select (r -> 'card' -> 'state' ->> 'minimum_minor')::bigint from s1), 520800::bigint, 'asgari');
select is((select (r -> 'card' -> 'state' ->> 'period_spent_minor')::bigint from s1), 313460::bigint, 'dönem içi');
select is((select (r -> 'card' -> 'state' ->> 'available_minor')::bigint from s1), 3394540::bigint, 'kullanılabilir limit');
select is(jsonb_array_length((select r -> 'period_items' from s1)), 2, 'dönem içi kayıtlar (harcama ve iade)');
select is(jsonb_array_length((select r -> 'installment_items' from s1)), 1, 'taksitli işlemler');
select is(jsonb_array_length((select r -> 'payments' from s1)), 2, 'ödemeler');

-- Money: card purchases are expenses once; card payments are not ---------------------------------------------
select is((public.get_cash_summary('2026-10-01') ->> 'expense_minor')::bigint, 128460::bigint, 'kart harcaması gider (bir kez)');
select is(
	(public.list_accounts() -> 'accounts' -> 0 ->> 'balance_minor')::bigint, 1400000::bigint,
	'ödemeler hesaptan düşer, harcamalar düşmez'
);
select is((public.list_cards() ->> 'total_debt_minor')::bigint, 1495460::bigint, 'toplam kart borcu');

select throws_ok(
	format($$ select public.create_transaction(jsonb_build_object('kind', 'expense', 'account_id', 'a1a1a1a1-0000-4000-8000-000000000001',
		'to_account_id', null, 'card_id', %L, 'to_card_id', null, 'installments', 1, 'amount_minor', 100, 'category', 'food',
		'title', null, 'note', null, 'occurred_on', '2026-10-11'), gen_random_uuid()) $$, (select id from card_id)),
	'P0001', 'validation_error', 'hem hesap hem kart olmaz'
);
select throws_ok(
	$$ select public.create_transaction(jsonb_build_object('kind', 'expense', 'account_id', 'a1a1a1a1-0000-4000-8000-000000000001',
		'to_account_id', null, 'card_id', null, 'to_card_id', null, 'installments', 3, 'amount_minor', 100, 'category', 'food',
		'title', null, 'note', null, 'occurred_on', '2026-10-11'), gen_random_uuid()) $$,
	'P0001', 'validation_error', 'taksit yalnızca kartta'
);

-- Archive and other people ---------------------------------------------------------------------------------------
select lives_ok(format($$ select public.archive_card(%L, 1) $$, (select id from card_id)), 'kart arşivlendi');
select throws_ok(format($$ select pg_temp.card_tx('expense', %L, 100, '2026-10-12', 1) $$, (select id from card_id)), 'P0001', 'validation_error', 'arşivlenmiş karta harcama girilmez');
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok(format($$ select public.get_card(%L) $$, (select id from card_id)), 'P0001', 'not_found', 'başkasının kartı okunmaz');
select is(jsonb_array_length(public.list_cards() -> 'cards'), 0, 'Bora Ayşe''nin kartlarını görmez');

select * from finish();
rollback;
