begin;
select plan(32);

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
create temp table t (name text primary key, value text);
grant all on t to authenticated;

-- Ayşe (alacaklı) – Bora: 300.000 kuruş, 3 taksit; aktif; Ayşe 150.000 aldı.
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
insert into t select 'ag', public.create_agreement($j${
	"kind": "loan", "creator_role": "creditor", "title": "Borç", "description": null, "started_on": null,
	"counterparty": {"contact": {"display_name": "Bora", "phone_e164": null, "kind": "person"}},
	"terms": {"principal_minor": 300000, "down_payment_minor": 0, "notes": null, "plan": [
		{"seq": 1, "due_date": "2026-11-10", "amount_minor": 100000},
		{"seq": 2, "due_date": "2026-12-10", "amount_minor": 100000},
		{"seq": 3, "due_date": "2027-01-10", "amount_minor": 100000}]}
}$j$::jsonb, gen_random_uuid()) ->> 'agreement_id';
select public.share_agreement((select value::uuid from t where name = 'ag'), '+905550000002', 1);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select public.decide_agreement((select value::uuid from t where name = 'ag'), 1,
	(public.get_pending_decision((select value::uuid from t where name = 'ag')) ->> 'terms_hash'), 'accept', null);
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.record_payment((select value::uuid from t where name = 'ag'),
	'{"amount_minor": 150000, "paid_on": "2026-10-11", "method": "cash", "note": null}', 3, gen_random_uuid());
reset role;
delete from public.notification_outbox;

create function pg_temp.ag() returns public.agreements language sql as $$
	select * from public.agreements where id = (select value::uuid from t where name = 'ag');
$$;
-- Kalan 150.000: 3. taksidi ertele ve ikiye böl (3 yerine 4 taksit).
create function pg_temp.new_terms() returns jsonb language sql as $$
	select '{"principal_minor": 300000, "down_payment_minor": 0, "notes": null, "plan": [
		{"seq": 1, "due_date": "2026-11-10", "amount_minor": 100000},
		{"seq": 2, "due_date": "2026-12-10", "amount_minor": 100000},
		{"seq": 3, "due_date": "2027-02-10", "amount_minor": 50000},
		{"seq": 4, "due_date": "2027-03-10", "amount_minor": 50000}]}'::jsonb;
$$;

select ok(not has_function_privilege('anon', 'public.propose_amendment(uuid, jsonb, text, int)', 'execute'), 'anon öneremez');

-- Öneri -----------------------------------------------------------------------------------------------
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select throws_ok(
	$$ select public.propose_amendment((select value::uuid from t where name = 'ag'), pg_temp.new_terms(), null, 4) $$,
	'P0001', 'not_found', 'yabancı öneremez'
);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok(
	$$ select public.propose_amendment((select value::uuid from t where name = 'ag'), pg_temp.new_terms(), null, 3) $$,
	'P0001', 'conflict', 'eski row_version'
);
select throws_ok(
	$$ select public.propose_amendment((select value::uuid from t where name = 'ag'),
		'{"principal_minor": 100000, "down_payment_minor": 0, "notes": null, "plan": [{"seq": 1, "due_date": "2026-11-10", "amount_minor": 100000}]}', null, 4) $$,
	'P0001', 'validation_error', 'toplam ödenenin altına inemez'
);
select is(
	public.propose_amendment((select value::uuid from t where name = 'ag'), pg_temp.new_terms(), 'Şubat''ta maaş geç yatacak', 4),
	'{"status": "amendment_pending", "version": 2}'::jsonb,
	'borçlu erteleme önerir'
);
reset role;
select results_eq(
	$$ select status::text, active_version, pending_version from pg_temp.ag() $$,
	$$ values ('amendment_pending', 1, 2) $$,
	'eski şartlar geçerli (amendment_pending)'
);
select results_eq(
	$$ select status::text, proposed_by, reason from public.agreement_versions where version = 2 $$,
	$$ values ('proposed', '22222222-2222-4222-8222-222222222222'::uuid, 'Şubat''ta maaş geç yatacak') $$,
	'öneri ve gerekçe'
);
select is((select template from public.notification_outbox), 'amendmentProposed', 'diğer tarafa bildirim');
select is((select type from public.agreement_events order by id desc limit 1), 'amendment_proposed', 'olay');

-- Tek açık talep (BR-07), ödeme hâlâ yapılabilir --------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select throws_ok(
	$$ select public.propose_amendment((select value::uuid from t where name = 'ag'), pg_temp.new_terms(), null, 5) $$,
	'P0001', 'invalid_transition', 'aynı anda ikinci talep yok (BR-07)'
);
select lives_ok(
	$$ select public.record_payment((select value::uuid from t where name = 'ag'),
		'{"amount_minor": 10000, "paid_on": "2026-10-11", "method": "cash", "note": null}', 5, gen_random_uuid()) $$,
	'amendment_pending iken ödeme kaydedilir (eski şartlar)'
);
select is(
	(select jsonb_agg(jsonb_build_array(r ->> 'kind', r ->> 'from_name')) from jsonb_array_elements(public.list_requests()) as r),
	'[["amendment", "Bora"]]'::jsonb,
	'diğer tarafın Talepler''inde'
);
create temp table pd as select public.get_pending_decision((select value::uuid from t where name = 'ag')) as d;
select is((select d ->> 'actor' from pd), 'amendment', 'karar türü');
select is((select d ->> 'reason' from pd), 'Şubat''ta maaş geç yatacak', 'gerekçe görünür');
select is((select jsonb_array_length(d -> 'current' -> 'plan') from pd), 3, 'mevcut plan');
select is((select jsonb_array_length(d -> 'proposed' -> 'plan') from pd), 4, 'önerilen plan');

select is((public.get_agreement_detail((select value::uuid from t where name = 'ag')) ->> 'pending_by_me')::boolean, false, 'Ayşe için öneri onun değil');
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is((public.get_agreement_detail((select value::uuid from t where name = 'ag')) ->> 'pending_by_me')::boolean, true, 'Bora önerdi');
select throws_ok(
	$$ select public.decide_amendment((select value::uuid from t where name = 'ag'), 2, (select d ->> 'terms_hash' from pd), 'accept') $$,
	'P0001', 'forbidden', 'öneren kendi önerisine karar veremez'
);
select throws_ok($$ select public.get_pending_decision((select value::uuid from t where name = 'ag')) $$, 'P0001', 'not_found', 'öneren için karar ekranı yok');

-- Kabul: yeni taksitler, ödemeler yeniden dağıtılır --------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select throws_ok(
	$$ select public.decide_amendment((select value::uuid from t where name = 'ag'), 2, repeat('0', 64), 'accept') $$,
	'P0001', 'conflict', 'hash eşleşmeli (BR-06)'
);
select is(
	public.decide_amendment((select value::uuid from t where name = 'ag'), 2, (select d ->> 'terms_hash' from pd), 'accept'),
	'{"status": "active", "version": 2}'::jsonb,
	'kabul'
);
reset role;
select results_eq(
	$$ select status::text, active_version, pending_version, outstanding_minor from pg_temp.ag() $$,
	$$ values ('active', 2, null::int, 140000::bigint) $$,
	'aktif, kalan korunur'
);
select results_eq(
	$$ select seq, due_date::text, amount_minor, paid_minor from public.installments where version = 2 order by seq $$,
	$$ values (1, '2026-11-10', 100000::bigint, 100000::bigint), (2, '2026-12-10', 100000, 60000), (3, '2027-02-10', 50000, 0), (4, '2027-03-10', 50000, 0) $$,
	'yeni taksitler, onaylı ödemeler dağıtıldı'
);
select is((select count(*)::int from public.payment_allocations pa join public.installments i on i.id = pa.installment_id where i.version = 1), 3, 'eski dağıtımlar geçmişte');
select is(
	(select template from public.notification_outbox where user_id = '22222222-2222-4222-8222-222222222222' order by id desc limit 1),
	'amendmentAccepted',
	'önerene sonuç'
);

-- Red ve geri çekme ----------------------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(
	public.propose_amendment((select value::uuid from t where name = 'ag'), jsonb_set(pg_temp.new_terms(), '{plan,3,due_date}', '"2027-04-10"'), null, (select row_version from pg_temp.ag())),
	'{"status": "amendment_pending", "version": 3}'::jsonb,
	'alacaklı da önerebilir'
);
select is(public.withdraw_amendment((select value::uuid from t where name = 'ag')), '{"status": "active"}'::jsonb, 'öneren geri çeker');
reset role;
select is((select status::text from public.agreement_versions where version = 3), 'superseded', 'geri çekilen öneri kapanır');
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select lives_ok(
	$$ select public.propose_amendment((select value::uuid from t where name = 'ag'), jsonb_set(pg_temp.new_terms(), '{plan,3,due_date}', '"2027-05-10"'), null, (select row_version from pg_temp.ag())) $$,
	'yeni öneri'
);
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(
	public.decide_amendment((select value::uuid from t where name = 'ag'), 4,
		(public.get_pending_decision((select value::uuid from t where name = 'ag')) ->> 'terms_hash'), 'reject'),
	'{"status": "active", "version": 2}'::jsonb,
	'red: eski versiyon geçerli'
);
reset role;
select results_eq(
	$$ select version, status::text from public.agreement_versions order by version $$,
	$$ values (1, 'superseded'), (2, 'accepted'), (3, 'superseded'), (4, 'rejected') $$,
	'versiyon geçmişi'
);

select * from finish();
rollback;
