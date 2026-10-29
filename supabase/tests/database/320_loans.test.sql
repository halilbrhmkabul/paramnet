-- ADR-056: the user's own bank loans (design 28, 34): the plan, installments paid from an account.
begin;
select plan(28);

select set_config('paramnet.today', '2026-10-24', true);
insert into auth.users (id, phone, aud, role) values
	('11111111-1111-4111-8111-111111111111', '905550000001', 'authenticated', 'authenticated'),
	('22222222-2222-4222-8222-222222222222', '905550000002', 'authenticated', 'authenticated');
insert into public.profiles (id, display_name, phone_e164) values
	('11111111-1111-4111-8111-111111111111', 'Ayşe', '+905550000001'),
	('22222222-2222-4222-8222-222222222222', 'Bora', '+905550000002');
insert into public.accounts (id, owner_id, kind, name, opening_balance_minor) values
	('a1a1a1a1-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'bank', 'Maaş Hesabı', 5000000);

create function pg_temp.act_as(uid uuid) returns void language sql as $$
	select set_config('role', 'authenticated', true),
		set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select has_table('public', 'loans', 'loans tablosu');
select ok(not has_table_privilege('authenticated', 'public.loans', 'select'), 'krediler istemciye kapalı');
select ok(not has_function_privilege('anon', 'public.create_loan(jsonb, uuid)', 'execute'), 'anon kredi ekleyemez');
select ok(not has_function_privilege('anon', 'public.record_loan_payment(uuid, uuid, date, uuid)', 'execute'), 'anon taksit kaydedemez');

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
create temp table l1 as select public.create_loan(
	'{"bank_name": "İş Bankası", "loan_type": "İhtiyaç kredisi", "principal_minor": 1000000, "monthly_rate_bps": 200, "term_months": 3, "first_due_on": "2026-11-15", "installment_minor": 350000, "payment_account_id": "a1a1a1a1-0000-4000-8000-000000000001"}',
	'f0000000-0000-4000-8000-000000000001'
) as r;
grant select on l1 to authenticated;
create temp table loan_id as select (r -> 'loan' ->> 'id')::uuid as id from l1;
grant select on loan_id to authenticated;
select is(jsonb_array_length((select r -> 'loan' -> 'schedule' from l1)), 3, 'ödeme planı');
select is((select (r -> 'loan' -> 'schedule' -> 2 ->> 'payment_minor')::bigint from l1), 340068::bigint, 'son taksit farkı kapatır');
select is((select (r -> 'loan' ->> 'total_interest_minor')::bigint from l1), 40068::bigint, 'toplam faiz');
select is((select (r -> 'loan' ->> 'remaining_principal_minor')::bigint from l1), 1000000::bigint, 'kalan anapara');
select is((select r -> 'loan' -> 'next' ->> 'seq' from l1), '1', 'sıradaki taksit');
select is((select r -> 'loan' ->> 'payment_account_name' from l1), 'Maaş Hesabı', 'ödeme hesabı');
select is(
	(public.create_loan('{"bank_name": "İş Bankası", "loan_type": "İhtiyaç kredisi", "principal_minor": 1000000, "monthly_rate_bps": 200, "term_months": 3, "first_due_on": "2026-11-15", "installment_minor": 350000, "payment_account_id": null}',
		'f0000000-0000-4000-8000-000000000001') ->> 'replayed'),
	'true', 'aynı anahtar: tekrar oynatılır'
);
select throws_ok(
	$$ select public.create_loan('{"bank_name": "X", "loan_type": "Y", "principal_minor": 1, "monthly_rate_bps": 2001, "term_months": 3, "first_due_on": "2026-11-15", "installment_minor": 1, "payment_account_id": null}', gen_random_uuid()) $$,
	'P0001', 'validation_error', 'oran sınırı'
);
select throws_ok(
	$$ select public.create_loan('{"bank_name": "X", "loan_type": "Y", "principal_minor": 1, "monthly_rate_bps": 100, "term_months": 121, "first_due_on": "2026-11-15", "installment_minor": 1, "payment_account_id": null}', gen_random_uuid()) $$,
	'P0001', 'validation_error', 'vade sınırı'
);

-- Paying installments --------------------------------------------------------------------------------------
create temp table p1 as select public.record_loan_payment((select id from loan_id), 'a1a1a1a1-0000-4000-8000-000000000001', '2026-11-15', 'f1000000-0000-4000-8000-000000000001') as r;
grant select on p1 to authenticated;
select is((select r -> 'transaction' ->> 'kind' from p1), 'transfer', 'taksit bir transferdir');
select is((select (r -> 'transaction' ->> 'amount_minor')::bigint from p1), 350000::bigint, 'sıradaki taksit tutarı');
select is((select r -> 'transaction' ->> 'to_loan_name' from p1), 'İş Bankası · İhtiyaç kredisi', 'kredinin adı');
select is(
	(public.record_loan_payment((select id from loan_id), 'a1a1a1a1-0000-4000-8000-000000000001', '2026-11-15', 'f1000000-0000-4000-8000-000000000001') ->> 'replayed'),
	'true', 'aynı anahtar: tek taksit'
);
create temp table g1 as select public.get_loan((select id from loan_id)) as r;
select is((select (r -> 'loan' ->> 'paid')::int from g1), 1, 'bir taksit ödendi');
select is((select (r -> 'loan' ->> 'remaining_principal_minor')::bigint from g1), 670000::bigint, 'kalan anapara düştü');
select is(jsonb_array_length((select r -> 'payments' from g1)), 1, 'ödemeler listesi');
select is((public.list_accounts() -> 'accounts' -> 0 ->> 'balance_minor')::bigint, 4650000::bigint, 'taksit hesaptan düşer');
select is((public.get_cash_summary('2026-11-01') ->> 'expense_minor')::bigint, 0::bigint, 'taksit gider sayılmaz');
select throws_ok(
	format($$ select public.update_transaction(%L, '{"kind": "transfer", "account_id": "a1a1a1a1-0000-4000-8000-000000000001", "to_account_id": null, "amount_minor": 1, "category": null, "title": null, "note": null, "occurred_on": "2026-11-15"}', 1) $$,
		(select r -> 'transaction' ->> 'id' from p1)),
	'P0001', 'invalid_transition', 'taksit kaydı düzenlenmez, silinir'
);
select lives_ok($$ select public.record_loan_payment((select id from loan_id), 'a1a1a1a1-0000-4000-8000-000000000001', '2026-12-15', gen_random_uuid()) $$, 'ikinci taksit');
select lives_ok($$ select public.record_loan_payment((select id from loan_id), 'a1a1a1a1-0000-4000-8000-000000000001', '2027-01-15', gen_random_uuid()) $$, 'son taksit');
select throws_ok(
	$$ select public.record_loan_payment((select id from loan_id), 'a1a1a1a1-0000-4000-8000-000000000001', '2027-01-15', gen_random_uuid()) $$,
	'P0001', 'invalid_transition', 'kapanan krediye taksit yok'
);
select is((public.list_loans() ->> 'remaining_principal_minor')::bigint, 0::bigint, 'kredi kapandı');

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok(format($$ select public.get_loan(%L) $$, (select id from loan_id)), 'P0001', 'not_found', 'başkasının kredisi okunmaz');

select * from finish();
rollback;
