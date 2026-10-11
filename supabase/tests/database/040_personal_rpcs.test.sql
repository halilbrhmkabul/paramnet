begin;
select plan(54);

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

-- Spec 5.2 mobilya örneği; karşı taraf yeni bir satıcı kişisi.
create function pg_temp.furniture() returns jsonb language sql as $$
	select $j${
		"kind": "installment_purchase",
		"creator_role": "debtor",
		"title": "Mobilya",
		"description": null,
		"started_on": null,
		"counterparty": { "contact": { "display_name": "Kaya Mobilya", "phone_e164": null, "kind": "merchant" } },
		"terms": {
			"principal_minor": 2800000,
			"down_payment_minor": 800000,
			"notes": null,
			"plan": [
				{ "seq": 1, "due_date": "2026-11-10", "amount_minor": 400000 },
				{ "seq": 2, "due_date": "2026-12-10", "amount_minor": 400000 },
				{ "seq": 3, "due_date": "2027-01-10", "amount_minor": 400000 },
				{ "seq": 4, "due_date": "2027-02-10", "amount_minor": 400000 },
				{ "seq": 5, "due_date": "2027-03-10", "amount_minor": 400000 }
			]
		}
	}$j$::jsonb;
$$;

-- Beklenen hash yönetici rolüyle hesaplanır; private fonksiyonlar istemciye kapalı.
create temp table expected_hash as select private.terms_hash(pg_temp.furniture() -> 'terms') as h;
grant select on expected_hash to authenticated;

-- RPC'ler yalnızca authenticated'a açık ------------------------------------------------------------
select ok(has_function_privilege('authenticated', 'public.create_agreement(jsonb, uuid)', 'execute'), 'create_agreement authenticated');
select ok(not has_function_privilege('anon', 'public.create_agreement(jsonb, uuid)', 'execute'), 'create_agreement anon değil');
select ok(not has_function_privilege('authenticated', 'private.allocate_payment(jsonb)', 'execute'), 'private yardımcılar istemciye kapalı');

-- create_agreement ---------------------------------------------------------------------------------
select set_config('role', 'authenticated', true), set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok(
	$$ select public.create_agreement(pg_temp.furniture(), gen_random_uuid()) $$,
	'28000', 'not_authenticated', 'oturumsuz oluşturamaz'
);

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
create temp table created as
	select public.create_agreement(pg_temp.furniture(), 'e1000000-0000-4000-8000-000000000001') as r;
select is((select r->>'replayed' from created), 'false', 'ilk çağrı yeni kayıt');

create temp table ag as
	select a.* from public.agreements a where a.id = (select (r->>'agreement_id')::uuid from created);
select is((select status::text from ag), 'personal', 'kişisel modda başlar');
select is((select outstanding_minor from ag), 2000000::bigint, 'kalan = toplam − peşinat');
select is((select row_version from ag), 1, 'row_version 1');
select is(
	(select terms_hash from public.agreement_versions where agreement_id = (select id from ag)),
	(select h from expected_hash),
	'terms_hash sunucuda kanonik JSON''dan hesaplanır'
);
select results_eq(
	$$ select due_date::text, amount_minor from public.installments where agreement_id = (select id from ag) order by seq $$,
	$$ values ('2026-11-10', 400000::bigint), ('2026-12-10', 400000), ('2027-01-10', 400000), ('2027-02-10', 400000), ('2027-03-10', 400000) $$,
	'taksitler plandan'
);
select results_eq(
	$$ select kind::text, status::text, amount_minor from public.payments where agreement_id = (select id from ag) $$,
	$$ values ('down_payment', 'confirmed', 800000::bigint) $$,
	'peşinat onaylı ödeme olarak'
);
select results_eq(
	$$ select type, actor_id, channel::text from public.agreement_events where agreement_id = (select id from ag) $$,
	$$ values ('created', '11111111-1111-4111-8111-111111111111'::uuid, 'app') $$,
	'olay kaydı yazıldı'
);
select results_eq(
	$$ select display_name, kind::text from public.contacts $$,
	$$ values ('Kaya Mobilya', 'merchant') $$,
	'yeni kişi oluşturuldu'
);

select is(
	public.create_agreement(pg_temp.furniture(), 'e1000000-0000-4000-8000-000000000001'),
	jsonb_build_object('agreement_id', (select id from ag), 'replayed', true),
	'aynı anahtarla tekrar yeni kayıt açmaz (BR-09)'
);
select is((select count(*)::int from public.agreements), 1, 'tek anlaşma');

select throws_ok(
	$$ select public.create_agreement(
		jsonb_set(pg_temp.furniture(), '{terms,plan,4,amount_minor}', '1'), gen_random_uuid()) $$,
	'P0001', 'validation_error', 'toplamı tutmayan plan reddedilir (BR-03)'
);
select throws_ok(
	$$ select public.create_agreement(
		jsonb_set(pg_temp.furniture(), '{terms,interest}', '5'), gen_random_uuid()) $$,
	'P0001', 'validation_error', 'bilinmeyen terms anahtarı reddedilir (BR-15)'
);
select throws_ok(
	$$ select public.create_agreement(
		jsonb_set(pg_temp.furniture(), '{title}', '" "'), gen_random_uuid()) $$,
	'P0001', 'validation_error', 'boş başlık reddedilir'
);
select throws_ok(
	$$ select public.create_agreement(
		jsonb_set(pg_temp.furniture(), '{counterparty}', '{"contact": {"display_name": "Ben", "phone_e164": "+905550000001", "kind": "person"}}'),
		gen_random_uuid()) $$,
	'P0001', 'validation_error', 'kendi numarasıyla kişi olmaz (BR-12)'
);

-- Bora, Ayşe'nin kişisini kullanamaz ve Ayşe'nin anahtarını tekrar kullanamaz.
create temp table ayse_contact as select id from public.contacts;
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok(
	format(
		$$ select public.create_agreement(jsonb_set(pg_temp.furniture(), '{counterparty}', %L), gen_random_uuid()) $$,
		jsonb_build_object('contact_id', (select id from ayse_contact))
	),
	'P0001', 'not_found', 'başkasının kişisi kullanılamaz'
);
select throws_ok(
	$$ select public.create_agreement(pg_temp.furniture(), 'e1000000-0000-4000-8000-000000000001') $$,
	'P0001', 'conflict', 'başkasının idempotency anahtarı'
);

-- record_payment -----------------------------------------------------------------------------------
create function pg_temp.pay(amount bigint, row_version int, key uuid) returns jsonb language sql as $$
	select public.record_payment(
		(select id from ag),
		jsonb_build_object('amount_minor', amount, 'paid_on', '2026-10-11', 'method', 'cash', 'note', null),
		row_version,
		key
	);
$$;

select throws_ok(
	$$ select pg_temp.pay(1000, 1, gen_random_uuid()) $$,
	'P0001', 'not_found', 'yabancı kişisel anlaşmaya ödeme yazamaz'
);

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(
	(pg_temp.pay(500000, 1, 'e2000000-0000-4000-8000-000000000001'))->>'replayed',
	'false',
	'ödeme kaydedildi'
);
select results_eq(
	$$ select seq, paid_minor from public.installments where agreement_id = (select id from ag) order by seq $$,
	$$ values (1, 400000::bigint), (2, 100000), (3, 0), (4, 0), (5, 0) $$,
	'FIFO dağıtım, fazlası sonrakine'
);
select results_eq(
	$$ select i.seq, pa.amount_minor from public.payment_allocations pa join public.installments i on i.id = pa.installment_id order by i.seq $$,
	$$ values (1, 400000::bigint), (2, 100000) $$,
	'dağıtım satırları'
);
select is((select outstanding_minor from public.agreements where id = (select id from ag)), 1500000::bigint, 'kalan düştü');
select is((select row_version from public.agreements where id = (select id from ag)), 2, 'row_version arttı');
select is(
	(select type from public.agreement_events where agreement_id = (select id from ag) order by id desc limit 1),
	'payment_recorded',
	'ödeme olayı'
);

select is(
	(pg_temp.pay(500000, 1, 'e2000000-0000-4000-8000-000000000001'))->>'replayed',
	'true',
	'aynı anahtar tekrar ödeme yazmaz'
);
select is((select count(*)::int from public.payments where kind = 'payment'), 1, 'tek ödeme');

select throws_ok($$ select pg_temp.pay(1000, 1, gen_random_uuid()) $$, 'P0001', 'conflict', 'eski row_version (eşzamanlı ikinci ödeme)');
select throws_ok(
	$$ select pg_temp.pay(1500001, 2, gen_random_uuid()) $$,
	'P0001', 'amount_exceeds_outstanding', 'kalan borçtan fazla ödeme'
);
select throws_ok($$ select pg_temp.pay(0, 2, gen_random_uuid()) $$, 'P0001', 'validation_error', 'sıfır tutar');
select throws_ok(
	$$ select public.record_payment((select id from ag),
		jsonb_build_object('amount_minor', 1000, 'paid_on', ((now() at time zone 'Europe/Istanbul')::date + 1)::text, 'method', 'cash', 'note', null),
		2, gen_random_uuid()) $$,
	'P0001', 'validation_error', 'gelecek tarihli ödeme (ADR-018)'
);
select throws_ok(
	$$ select public.record_payment((select id from ag),
		jsonb_build_object('amount_minor', 1000, 'paid_on', '2026-10-11', 'method', 'crypto', 'note', null),
		2, gen_random_uuid()) $$,
	'P0001', 'validation_error', 'bilinmeyen yöntem'
);

-- update_personal_agreement: kalan tutar 4 yerine 2 taksit; ödenenler yeni plana dağıtılır.
select is(
	public.update_personal_agreement(
		(select id from ag),
		$j${"principal_minor": 2800000, "down_payment_minor": 800000, "notes": "Yeniden planlandı",
			"plan": [{"seq": 1, "due_date": "2026-11-10", "amount_minor": 1000000}, {"seq": 2, "due_date": "2026-12-10", "amount_minor": 1000000}]}$j$::jsonb,
		2
	),
	jsonb_build_object('version', 2),
	'yeni versiyon'
);
select results_eq(
	$$ select seq, amount_minor, paid_minor from public.installments where agreement_id = (select id from ag) and version = 2 order by seq $$,
	$$ values (1, 1000000::bigint, 500000::bigint), (2, 1000000, 0) $$,
	'onaylı ödemeler yeni taksitlere dağıtıldı'
);
select results_eq(
	$$ select version, status::text from public.agreement_versions where agreement_id = (select id from ag) order by version $$,
	$$ values (1, 'superseded'), (2, 'accepted') $$,
	'eski versiyon superseded'
);
select is((select active_version from public.agreements where id = (select id from ag)), 2, 'aktif versiyon 2');
select is((select outstanding_minor from public.agreements where id = (select id from ag)), 1500000::bigint, 'kalan değişmedi');
select throws_ok(
	$$ select public.update_personal_agreement((select id from ag),
		$j${"principal_minor": 2800000, "down_payment_minor": 700000, "notes": null,
			"plan": [{"seq": 1, "due_date": "2026-11-10", "amount_minor": 2100000}]}$j$::jsonb, 3) $$,
	'P0001', 'validation_error', 'peşinat düzenlemeyle değişmez'
);
select throws_ok(
	$$ select public.update_personal_agreement((select id from ag),
		$j${"principal_minor": 1200000, "down_payment_minor": 800000, "notes": null,
			"plan": [{"seq": 1, "due_date": "2026-11-10", "amount_minor": 400000}]}$j$::jsonb, 3) $$,
	'P0001', 'validation_error', 'yeni toplam ödenenin altına inemez'
);

-- Kalanın tamamı ödenince otomatik kapanır.
select is(
	(pg_temp.pay(1500000, 3, 'e2000000-0000-4000-8000-000000000002'))->>'settled',
	'true',
	'son ödeme kapatır'
);
select results_eq(
	$$ select status::text, outstanding_minor, settled_at is not null from public.agreements where id = (select id from ag) $$,
	$$ values ('settled', 0::bigint, true) $$,
	'settled, kalan 0'
);
select is(
	(select array_agg(type order by id) from public.agreement_events where agreement_id = (select id from ag)),
	array['created', 'payment_recorded', 'updated', 'payment_recorded', 'settled'],
	'olaylar sırayla'
);
select throws_ok($$ select pg_temp.pay(1, 4, gen_random_uuid()) $$, 'P0001', 'invalid_transition', 'kapanmış anlaşmaya ödeme yok (BR-14)');
select throws_ok(
	$$ select public.cancel_agreement((select id from ag), 4) $$,
	'P0001', 'invalid_transition', 'kapanmış anlaşma iptal edilemez'
);

-- cancel_agreement ----------------------------------------------------------------------------------
create temp table second as
	select (public.create_agreement(
		jsonb_set(jsonb_set(pg_temp.furniture(), '{counterparty}', '{"contact": {"display_name": "Elif", "phone_e164": "+905550000002", "kind": "person"}}'),
			'{started_on}', '"2026-10-01"'),
		gen_random_uuid()
	)->>'agreement_id')::uuid as id;
select is(
	(select linked_profile_id from public.contacts where display_name = 'Elif'),
	'22222222-2222-4222-8222-222222222222'::uuid,
	'kayıtlı numara profile bağlanır'
);
select is((select started_on::text from public.agreements where id = (select id from second)), '2026-10-01', 'started_on kaydedildi');
select is(
	(select paid_on::text from public.payments where agreement_id = (select id from second) and kind = 'down_payment'),
	'2026-10-01',
	'peşinat tarihi başlangıç tarihi'
);

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok($$ select public.cancel_agreement((select id from second), 1) $$, 'P0001', 'not_found', 'yabancı iptal edemez');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select throws_ok($$ select public.cancel_agreement((select id from second), 9) $$, 'P0001', 'conflict', 'eski row_version');
select is(public.cancel_agreement((select id from second), 1), '{"status": "cancelled"}'::jsonb, 'iptal edildi');
select results_eq(
	$$ select status::text, cancelled_at is not null, row_version from public.agreements where id = (select id from second) $$,
	$$ values ('cancelled', true, 2) $$,
	'cancelled_at ve row_version'
);

select * from finish();
rollback;
