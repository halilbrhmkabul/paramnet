begin;
select plan(34);

-- Ayşe (A) iki anlaşma oluşturur: kişisel (B'yi kişi olarak kaydetmiş) ve B ile paylaşılmış aktif.
-- Bora (B) yalnızca aktif olanı görür; Cem (C) hiçbirini görmez.
insert into auth.users (id, phone, aud, role) values
	('11111111-1111-4111-8111-111111111111', '905550000001', 'authenticated', 'authenticated'),
	('22222222-2222-4222-8222-222222222222', '905550000002', 'authenticated', 'authenticated'),
	('33333333-3333-4333-8333-333333333333', '905550000003', 'authenticated', 'authenticated');
insert into public.profiles (id, display_name, phone_e164) values
	('11111111-1111-4111-8111-111111111111', 'Ayşe', '+905550000001'),
	('22222222-2222-4222-8222-222222222222', 'Bora', '+905550000002'),
	('33333333-3333-4333-8333-333333333333', 'Cem', '+905550000003');
insert into public.contacts (id, owner_id, display_name, phone_e164) values
	('c0000000-0000-4000-8000-00000000000a', '11111111-1111-4111-8111-111111111111', 'Bora', '+905550000002'),
	('c0000000-0000-4000-8000-00000000000b', '22222222-2222-4222-8222-222222222222', 'Ayşe abla', '+905550000001');
insert into public.agreements (id, creator_id, creator_role, counterparty_contact_id, counterparty_profile_id, kind, title, principal_minor, outstanding_minor, status)
values
	('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'creditor',
		'c0000000-0000-4000-8000-00000000000a', null, 'loan', 'Kişisel', 1000, 1000, 'personal'),
	('a0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'creditor',
		'c0000000-0000-4000-8000-00000000000a', '22222222-2222-4222-8222-222222222222', 'loan', 'Paylaşılan', 2000, 2000, 'active');
insert into public.agreement_versions (agreement_id, version, terms, terms_hash, proposed_by, status)
select id, 1, '{}'::jsonb, repeat('a', 64), '11111111-1111-4111-8111-111111111111', 'accepted'
from public.agreements;
insert into public.installments (id, agreement_id, version, seq, amount_minor) values
	('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 1, 1, 1000),
	('10000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 1, 1, 2000);
insert into public.payments (id, agreement_id, amount_minor, paid_on, method, kind, status, reported_by, idempotency_key) values
	('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 100, '2026-10-11', 'cash', 'payment',
		'confirmed', '11111111-1111-4111-8111-111111111111', gen_random_uuid()),
	('90000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 200, '2026-10-11', 'cash', 'payment',
		'confirmed', '11111111-1111-4111-8111-111111111111', gen_random_uuid());
insert into public.payment_allocations (payment_id, installment_id, amount_minor) values
	('90000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 100),
	('90000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 200);
insert into public.agreement_events (agreement_id, actor_id, channel, type)
select id, '11111111-1111-4111-8111-111111111111', 'app', 'created' from public.agreements;
insert into public.consents (user_id, document, version) values ('11111111-1111-4111-8111-111111111111', 'kvkk', '1');
insert into public.notification_outbox (user_id, template) values ('11111111-1111-4111-8111-111111111111', 'dueToday');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
	select set_config('role', 'authenticated', true),
		set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Ayşe
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select results_eq('select title from public.agreements order by title', $$ values ('Kişisel'), ('Paylaşılan') $$, 'A iki anlaşmasını görür');
select is((select count(*)::int from public.agreement_versions), 2, 'A iki versiyonu görür');
select is((select count(*)::int from public.installments), 2, 'A iki taksiti görür');
select is((select count(*)::int from public.payments), 2, 'A iki ödemeyi görür');
select is((select count(*)::int from public.payment_allocations), 2, 'A iki dağıtımı görür');
select is((select count(*)::int from public.agreement_events), 2, 'A iki olayı görür');
select results_eq('select display_name from public.contacts', $$ values ('Bora') $$, 'A yalnızca kendi kişilerini görür');
select results_eq('select display_name from public.profiles', $$ values ('Ayşe') $$, 'A yalnızca kendi profilini görür');
select is((select count(*)::int from public.consents), 1, 'A kendi onayını görür');

-- Bora: paylaşılan anlaşmanın karşı tarafı
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select results_eq('select title from public.agreements', $$ values ('Paylaşılan') $$, 'B kişisel anlaşmayı görmez, paylaşılanı görür');
select is((select count(*)::int from public.agreement_versions), 1, 'B bir versiyon görür');
select is((select count(*)::int from public.installments), 1, 'B bir taksit görür');
select is((select count(*)::int from public.payments), 1, 'B bir ödeme görür');
select is((select count(*)::int from public.payment_allocations), 1, 'B bir dağıtım görür');
select is((select count(*)::int from public.agreement_events), 1, 'B bir olay görür');
select results_eq('select display_name from public.contacts', $$ values ('Ayşe abla') $$, 'B, A''nın onu nasıl kaydettiğini görmez');
select is((select count(*)::int from public.consents), 0, 'B başkasının onayını görmez');

-- Cem: hiçbir şeye taraf değil
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select is_empty('select 1 from public.agreements', 'C anlaşma görmez');
select is_empty('select 1 from public.installments', 'C taksit görmez');
select is_empty('select 1 from public.payments', 'C ödeme görmez');
select is_empty('select 1 from public.agreement_events', 'C olay görmez');

-- İstemci yazamaz: tablolarda yalnızca select yetkisi var (yazma RPC'lerden).
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select throws_ok(
	$$ insert into public.contacts (owner_id, display_name) values ('11111111-1111-4111-8111-111111111111', 'X') $$,
	'42501', null, 'kişi eklenemez'
);
select throws_ok(
	$$ update public.agreements set outstanding_minor = 0 $$,
	'42501', null, 'anlaşma güncellenemez'
);
select throws_ok($$ delete from public.payments $$, '42501', null, 'ödeme silinemez');
select throws_ok(
	$$ insert into public.agreement_events (agreement_id, channel, type) values ('a0000000-0000-4000-8000-000000000001', 'app', 'x') $$,
	'42501', null, 'olay eklenemez'
);
select throws_ok($$ update public.profiles set display_name = 'Z' $$, '42501', null, 'profil doğrudan güncellenemez');
select throws_ok($$ select * from public.notification_outbox $$, '42501', null, 'outbox okunamaz');
select throws_ok($$ select * from public.reminders $$, '42501', null, 'hatırlatmalar okunamaz');
select throws_ok($$ select * from public.push_tokens $$, '42501', null, 'push token okunamaz');

-- Anonim rolün hiçbir tabloya erişimi yok.
select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select * from public.agreements $$, '42501', null, 'anon anlaşma okuyamaz');
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon profil okuyamaz');
select throws_ok($$ select * from public.contacts $$, '42501', null, 'anon kişi okuyamaz');

reset role;

-- Gelecekte eklenen tablolar da varsayılan olarak istemciye kapalı başlar.
create table public.rls_default_probe (id int);
select is(
	has_table_privilege('authenticated', 'public.rls_default_probe', 'select'),
	false,
	'yeni tablolar varsayılan olarak authenticated''a kapalı'
);
select is(
	has_table_privilege('anon', 'public.rls_default_probe', 'select'),
	false,
	'yeni tablolar varsayılan olarak anon''a kapalı'
);

select * from finish();
rollback;
