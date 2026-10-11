begin;
select plan(37);

-- Ayşe (A) Bora'ya (B) borç verdi ve paylaştı; Cem (C) yabancı.
insert into auth.users (id, phone, aud, role) values
	('11111111-1111-4111-8111-111111111111', '905550000001', 'authenticated', 'authenticated'),
	('22222222-2222-4222-8222-222222222222', '905550000002', 'authenticated', 'authenticated'),
	('33333333-3333-4333-8333-333333333333', '905550000003', 'authenticated', 'authenticated');
insert into public.profiles (id, display_name, phone_e164) values
	('11111111-1111-4111-8111-111111111111', 'Ayşe', '+905550000001'),
	('22222222-2222-4222-8222-222222222222', 'Bora', '+905550000002'),
	('33333333-3333-4333-8333-333333333333', 'Cem', '+905550000003');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
	select set_config('role', 'authenticated', true),
		set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.terms(principal bigint, down bigint, plan jsonb) returns jsonb language sql as $$
	select jsonb_build_object('principal_minor', principal, 'down_payment_minor', down, 'notes', null, 'plan', plan);
$$;

create temp table t (name text primary key, id uuid, hash text);
grant all on t to authenticated;

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
insert into t (name, id) select 'ag', (public.create_agreement(jsonb_build_object(
	'kind', 'loan', 'creator_role', 'creditor', 'title', 'Borç', 'description', null, 'started_on', null,
	'counterparty', '{"contact": {"display_name": "Bora", "phone_e164": "+905550000002", "kind": "person"}}'::jsonb,
	'terms', pg_temp.terms(300000, 0, '[{"seq": 1, "due_date": "2026-11-10", "amount_minor": 150000}, {"seq": 2, "due_date": "2026-12-10", "amount_minor": 150000}]')
), gen_random_uuid()) ->> 'agreement_id')::uuid;
-- A payment recorded in personal mode before sharing stays with the agreement.
select public.record_payment((select id from t where name = 'ag'),
	'{"amount_minor": 50000, "paid_on": "2026-10-11", "method": "cash", "note": null}', 1, gen_random_uuid());
select public.share_agreement((select id from t where name = 'ag'), '+905550000002', 2);
reset role;
update t set hash = (select terms_hash from public.agreement_versions where agreement_id = t.id and version = 1) where name = 'ag';

create function pg_temp.decide(decision text, version int, hash text, counter jsonb default null) returns jsonb language sql as $$
	select public.decide_agreement((select id from t where name = 'ag'), version, hash, decision, counter);
$$;

-- Yetki -------------------------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.decide_agreement(uuid, int, text, text, jsonb)', 'execute'), 'anon karar veremez');
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select throws_ok($$ select pg_temp.decide('accept', 1, (select hash from t where name = 'ag')) $$, 'P0001', 'not_found', 'davet numarası olmayan karar veremez');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select throws_ok($$ select pg_temp.decide('accept', 1, (select hash from t where name = 'ag')) $$, 'P0001', 'forbidden', 'oluşturan kendi davetini onaylayamaz');

-- Bora: içerik kontrolü (BR-06) ------------------------------------------------------------------------
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok($$ select pg_temp.decide('accept', 1, repeat('0', 64)) $$, 'P0001', 'conflict', 'farklı içerik hash''i onaylanamaz');
select throws_ok($$ select pg_temp.decide('accept', 2, (select hash from t where name = 'ag')) $$, 'P0001', 'conflict', 'olmayan/eski versiyon onaylanamaz');
select throws_ok($$ select pg_temp.decide('maybe', 1, (select hash from t where name = 'ag')) $$, 'P0001', 'validation_error', 'bilinmeyen karar');

-- Bora düzeltme önerir: 2 yerine 3 taksit.
select is(
	pg_temp.decide('counter', 1, (select hash from t where name = 'ag'), pg_temp.terms(300000, 0,
		'[{"seq": 1, "due_date": "2026-11-10", "amount_minor": 100000}, {"seq": 2, "due_date": "2026-12-10", "amount_minor": 100000}, {"seq": 3, "due_date": "2027-01-10", "amount_minor": 100000}]')),
	'{"status": "countered", "version": 2}'::jsonb,
	'düzeltme önerisi'
);
reset role;
select results_eq(
	$$ select status::text, active_version, pending_version, counterparty_profile_id from public.agreements where id = (select id from t where name = 'ag') $$,
	$$ values ('countered', 1, 2, '22222222-2222-4222-8222-222222222222'::uuid) $$,
	'countered; öneren profile bağlandı, aktif versiyon değişmedi'
);
select results_eq(
	$$ select version, status::text, proposed_by from public.agreement_versions where agreement_id = (select id from t where name = 'ag') order by version $$,
	$$ values (1, 'accepted', '11111111-1111-4111-8111-111111111111'::uuid), (2, 'proposed', '22222222-2222-4222-8222-222222222222'::uuid) $$,
	'yeni versiyon taslağı öneren adına'
);
select is((select status::text from public.invites), 'consumed', 'davet tüketildi');
select is((select count(*)::int from public.installments where agreement_id = (select id from t where name = 'ag') and version = 2), 0, 'öneri kabul edilmeden taksit üretilmez');
update t set hash = (select terms_hash from public.agreement_versions where agreement_id = t.id and version = 2) where name = 'ag';

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select results_eq('select title from public.agreements', $$ values ('Borç') $$, 'Bora artık anlaşmayı görür');
select throws_ok($$ select pg_temp.decide('accept', 2, (select hash from t where name = 'ag')) $$, 'P0001', 'invalid_transition', 'kendi önerisini onaylayamaz (sıra oluşturanda)');
select throws_ok(
	$$ select public.decide_counter((select id from t where name = 'ag'), 2, (select hash from t where name = 'ag'), 'accept', null) $$,
	'P0001', 'forbidden', 'karşı öneriye yalnızca oluşturan yanıt verir'
);

-- Ayşe karşı öneriyi kabul eder: v2 yürürlükte, ödemeler yeni taksitlere dağıtılır.
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select throws_ok(
	$$ select public.decide_counter((select id from t where name = 'ag'), 2, repeat('0', 64), 'accept', null) $$,
	'P0001', 'conflict', 'oluşturan da içerik hash''iyle onaylar'
);
select is(
	public.decide_counter((select id from t where name = 'ag'), 2, (select hash from t where name = 'ag'), 'accept', null),
	'{"status": "active", "version": 2}'::jsonb,
	'karşı öneri kabul'
);
reset role;
select results_eq(
	$$ select status::text, active_version, pending_version, outstanding_minor from public.agreements where id = (select id from t where name = 'ag') $$,
	$$ values ('active', 2, null::int, 250000::bigint) $$,
	'aktif; kalan korunur'
);
select results_eq(
	$$ select seq, amount_minor, paid_minor from public.installments where agreement_id = (select id from t where name = 'ag') and version = 2 order by seq $$,
	$$ values (1, 100000::bigint, 50000::bigint), (2, 100000, 0), (3, 100000, 0) $$,
	'yeni taksitler, önceki ödeme dağıtıldı'
);
select results_eq(
	$$ select version, status::text from public.agreement_versions where agreement_id = (select id from t where name = 'ag') order by version $$,
	$$ values (1, 'superseded'), (2, 'accepted') $$,
	'eski versiyon superseded'
);
select is(
	(select array_agg(type order by id) from public.agreement_events where agreement_id = (select id from t where name = 'ag')),
	array['created', 'payment_recorded', 'shared', 'countered', 'accepted'],
	'olaylar'
);

-- Doğrudan kabul akışı ve red ------------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
insert into t (name, id) select 'second', (public.create_agreement(jsonb_build_object(
	'kind', 'loan', 'creator_role', 'debtor', 'title', 'İkinci', 'description', null, 'started_on', null,
	'counterparty', jsonb_build_object('contact_id', (select counterparty_contact_id from public.agreements where id = (select id from t where name = 'ag'))),
	'terms', pg_temp.terms(100000, 0, '[{"seq": 1, "due_date": null, "amount_minor": 100000}]')
), gen_random_uuid()) ->> 'agreement_id')::uuid;
select public.share_agreement((select id from t where name = 'second'), '+905550000002', 1);
reset role;
update t set hash = (select terms_hash from public.agreement_versions where agreement_id = t.id and version = 1) where name = 'second';

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is(
	public.decide_agreement((select id from t where name = 'second'), 1, (select hash from t where name = 'second'), 'accept', null),
	'{"status": "active", "version": 1}'::jsonb,
	'doğrudan kabul'
);
reset role;
select results_eq(
	$$ select status::text, counterparty_profile_id, pending_version from public.agreements where id = (select id from t where name = 'second') $$,
	$$ values ('active', '22222222-2222-4222-8222-222222222222'::uuid, null::int) $$,
	'aktif ve bağlı'
);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok(
	$$ select public.decide_agreement((select id from t where name = 'second'), 1, (select hash from t where name = 'second'), 'accept', null) $$,
	'P0001', 'invalid_transition', 'ikinci karar yok (davet tüketildi)'
);
select is(
	(select (public.get_agreement_detail((select id from t where name = 'second')) ->> 'my_role')),
	'creditor',
	'Bora kendi bakış açısından alacaklı'
);

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
insert into t (name, id) select 'third', (public.create_agreement(jsonb_build_object(
	'kind', 'loan', 'creator_role', 'creditor', 'title', 'Üçüncü', 'description', null, 'started_on', null,
	'counterparty', jsonb_build_object('contact_id', (select counterparty_contact_id from public.agreements where id = (select id from t where name = 'ag'))),
	'terms', pg_temp.terms(100000, 0, '[{"seq": 1, "due_date": null, "amount_minor": 100000}]')
), gen_random_uuid()) ->> 'agreement_id')::uuid;
select public.share_agreement((select id from t where name = 'third'), '+905550000002', 1);
reset role;
update t set hash = (select terms_hash from public.agreement_versions where agreement_id = t.id and version = 1) where name = 'third';
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is(
	public.decide_agreement((select id from t where name = 'third'), 1, (select hash from t where name = 'third'), 'reject', null),
	'{"status": "rejected", "version": 1}'::jsonb,
	'red'
);
select is_empty($$ select 1 from public.agreements where id = (select id from t where name = 'third') $$, 'reddeden bağlanmaz, anlaşmayı görmez');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select results_eq(
	$$ select status::text, counterparty_profile_id from public.agreements where id = (select id from t where name = 'third') $$,
	$$ values ('rejected', null::uuid) $$,
	'rejected'
);
select throws_ok(
	$$ select public.record_payment((select id from t where name = 'third'), '{"amount_minor": 1, "paid_on": "2026-10-11", "method": "cash", "note": null}', 3, gen_random_uuid()) $$,
	'P0001', 'invalid_transition', 'reddedilmiş anlaşmaya ödeme yok'
);
select is(public.make_personal((select id from t where name = 'third')), '{"status": "personal"}'::jsonb, 'kişisel moda dön');
select is((select status::text from public.agreements where id = (select id from t where name = 'third')), 'personal', 'personal');
select throws_ok($$ select public.make_personal((select id from t where name = 'third')) $$, 'P0001', 'invalid_transition', 'yalnızca rejected iken');

-- Oluşturan karşı öneriye karşı öneri verir → tekrar pending, sıra karşı tarafta.
insert into t (name, id) select 'fourth', (public.create_agreement(jsonb_build_object(
	'kind', 'loan', 'creator_role', 'creditor', 'title', 'Dördüncü', 'description', null, 'started_on', null,
	'counterparty', jsonb_build_object('contact_id', (select counterparty_contact_id from public.agreements where id = (select id from t where name = 'ag'))),
	'terms', pg_temp.terms(100000, 0, '[{"seq": 1, "due_date": "2026-11-10", "amount_minor": 100000}]')
), gen_random_uuid()) ->> 'agreement_id')::uuid;
select public.share_agreement((select id from t where name = 'fourth'), '+905550000002', 1);
reset role;
update t set hash = (select terms_hash from public.agreement_versions where agreement_id = t.id and version = 1) where name = 'fourth';
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select lives_ok(
	$$ select public.decide_agreement((select id from t where name = 'fourth'), 1, (select hash from t where name = 'fourth'), 'counter',
		pg_temp.terms(100000, 0, '[{"seq": 1, "due_date": "2026-12-10", "amount_minor": 100000}]')) $$,
	'Bora erteleme önerir'
);
reset role;
update t set hash = (select terms_hash from public.agreement_versions where agreement_id = t.id and version = 2) where name = 'fourth';
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(
	public.decide_counter((select id from t where name = 'fourth'), 2, (select hash from t where name = 'fourth'), 'counter',
		pg_temp.terms(100000, 0, '[{"seq": 1, "due_date": "2026-11-25", "amount_minor": 100000}]')),
	'{"status": "pending", "version": 3}'::jsonb,
	'Ayşe arayı bulur'
);
reset role;
select results_eq(
	$$ select version, status::text from public.agreement_versions where agreement_id = (select id from t where name = 'fourth') order by version $$,
	$$ values (1, 'accepted'), (2, 'rejected'), (3, 'proposed') $$,
	'reddedilen öneri rejected, yeni öneri proposed'
);
update t set hash = (select terms_hash from public.agreement_versions where agreement_id = t.id and version = 3) where name = 'fourth';
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is(
	public.decide_agreement((select id from t where name = 'fourth'), 3, (select hash from t where name = 'fourth'), 'accept', null),
	'{"status": "active", "version": 3}'::jsonb,
	'Bora bağlı profil olarak (davetsiz) kabul eder'
);
reset role;
select results_eq(
	$$ select due_date::text from public.installments where agreement_id = (select id from t where name = 'fourth') and version = 3 $$,
	$$ values ('2026-11-25') $$,
	'kabul edilen versiyonun taksitleri'
);
select is(
	(select active_version from public.agreements where id = (select id from t where name = 'fourth')),
	3,
	'aktif versiyon 3'
);

select * from finish();
rollback;
