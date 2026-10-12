begin;
select plan(36);

-- Ayşe (alacaklı) Bora'ya borç verdi; Bora onayladı (active).
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

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
insert into t select 'ag', public.create_agreement($j${
	"kind": "loan", "creator_role": "creditor", "title": "Borç", "description": null, "started_on": null,
	"counterparty": {"contact": {"display_name": "Bora", "phone_e164": null, "kind": "person"}},
	"terms": {"principal_minor": 300000, "down_payment_minor": 0, "notes": null,
		"plan": [{"seq": 1, "due_date": "2026-11-10", "amount_minor": 150000}, {"seq": 2, "due_date": "2026-12-10", "amount_minor": 150000}]}
}$j$::jsonb, gen_random_uuid()) ->> 'agreement_id';
select public.share_agreement((select value::uuid from t where name = 'ag'), '+905550000002', 1);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select public.decide_agreement((select value::uuid from t where name = 'ag'), 1,
	(public.get_pending_decision((select value::uuid from t where name = 'ag')) ->> 'terms_hash'), 'accept', null);
reset role;
delete from public.notification_outbox;

create function pg_temp.pay(amount bigint, key uuid default gen_random_uuid()) returns jsonb language sql as $$
	select public.record_payment((select value::uuid from t where name = 'ag'),
		jsonb_build_object('amount_minor', amount, 'paid_on', '2026-10-11', 'method', 'transfer', 'note', null),
		(select row_version from public.agreements where id = (select value::uuid from t where name = 'ag')), key);
$$;
create function pg_temp.ag() returns public.agreements language sql as $$
	select * from public.agreements where id = (select value::uuid from t where name = 'ag');
$$;

-- Borçlu bildirir: reported, bakiyeden düşmez (BR-08) -----------------------------------------------------
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
insert into t select 'p1', pg_temp.pay(100000) ->> 'payment_id';
reset role;
select results_eq(
	$$ select status::text, reported_by from public.payments where id = (select value::uuid from t where name = 'p1') $$,
	$$ values ('reported', '22222222-2222-4222-8222-222222222222'::uuid) $$,
	'borçlunun ödemesi reported'
);
select is((select outstanding_minor from pg_temp.ag()), 300000::bigint, 'bakiye değişmedi');
select is((select count(*)::int from public.payment_allocations), 0, 'dağıtım yok');
select is((select type from public.agreement_events order by id desc limit 1), 'payment_reported', 'olay');
select results_eq(
	$$ select user_id, template, payload ->> 'name', (payload ->> 'amount_minor')::bigint from public.notification_outbox $$,
	$$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'paymentReported', 'Bora', 100000::bigint) $$,
	'alacaklıya onay isteği'
);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is(
	(select (d ->> 'reported_minor')::bigint from (select public.get_agreement_detail((select value::uuid from t where name = 'ag')) as d) x),
	100000::bigint,
	'onay bekleyen tutar görünür'
);
select is(
	(select p -> 'by_me' from jsonb_array_elements(public.get_agreement_detail((select value::uuid from t where name = 'ag')) -> 'payments') as p),
	'true'::jsonb,
	'bildiren için by_me'
);
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(
	(select p -> 'by_me' from jsonb_array_elements(public.get_agreement_detail((select value::uuid from t where name = 'ag')) -> 'payments') as p),
	'false'::jsonb,
	'alacaklı için by_me false'
);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');

-- Yetki ----------------------------------------------------------------------------------------------------
select throws_ok(
	format('select public.decide_payment(%L, %L)', (select value from t where name = 'p1'), 'confirm'),
	'P0001', 'forbidden', 'borçlu kendi bildirimini onaylayamaz'
);
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select throws_ok(
	format('select public.decide_payment(%L, %L)', (select value from t where name = 'p1'), 'confirm'),
	'P0001', 'not_found', 'yabancı göremez'
);

-- Alacaklı onaylar --------------------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(
	public.decide_payment((select value::uuid from t where name = 'p1'), 'confirm'),
	'{"status": "confirmed", "replayed": false}'::jsonb,
	'onaylandı'
);
select is(
	public.decide_payment((select value::uuid from t where name = 'p1'), 'confirm'),
	'{"status": "confirmed", "replayed": true}'::jsonb,
	'aynı karar tekrar uygulanmaz'
);
select throws_ok(
	format('select public.decide_payment(%L, %L)', (select value from t where name = 'p1'), 'reject'),
	'P0001', 'invalid_transition', 'onaylı ödeme reddedilemez'
);
reset role;
select results_eq(
	$$ select status::text, decided_by, decided_at is not null from public.payments where id = (select value::uuid from t where name = 'p1') $$,
	$$ values ('confirmed', '11111111-1111-4111-8111-111111111111'::uuid, true) $$,
	'karar veren ve zamanı'
);
select is((select outstanding_minor from pg_temp.ag()), 200000::bigint, 'bakiye düştü');
select results_eq(
	$$ select i.seq, i.paid_minor from public.installments i order by i.seq $$,
	$$ values (1, 100000::bigint), (2, 0::bigint) $$,
	'FIFO dağıtıldı'
);
select is((select type from public.agreement_events order by id desc limit 1), 'payment_confirmed', 'olay');
select is(
	(select template from public.notification_outbox where user_id = '22222222-2222-4222-8222-222222222222' order by id desc limit 1),
	'paymentConfirmed',
	'borçluya onay bildirimi'
);

-- Red ve geri çekme ---------------------------------------------------------------------------------------
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
insert into t select 'p2', pg_temp.pay(50000) ->> 'payment_id';
insert into t select 'p3', pg_temp.pay(20000) ->> 'payment_id';
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(
	public.decide_payment((select value::uuid from t where name = 'p2'), 'reject'),
	'{"status": "rejected", "replayed": false}'::jsonb,
	'"Bu ödemeyi almadım"'
);
select throws_ok(
	format('select public.withdraw_payment(%L)', (select value from t where name = 'p3')),
	'P0001', 'forbidden', 'yalnızca bildiren geri çeker'
);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is(public.withdraw_payment((select value::uuid from t where name = 'p3')), '{"status": "withdrawn"}'::jsonb, 'borçlu geri çekti');
select throws_ok(
	format('select public.withdraw_payment(%L)', (select value from t where name = 'p2')),
	'P0001', 'invalid_transition', 'reddedilen geri çekilemez'
);
reset role;
select results_eq(
	$$ select status::text from public.payments where id in ((select value::uuid from t where name = 'p2'), (select value::uuid from t where name = 'p3')) order by amount_minor desc $$,
	$$ values ('rejected'), ('withdrawn') $$,
	'reddedilen ve geri çekilen geçmişte kalır (silinmez)'
);
select is((select outstanding_minor from pg_temp.ag()), 200000::bigint, 'bakiye değişmedi');
select is(
	(select array_agg(type order by id) from public.agreement_events where type like 'payment_%' and id > (select max(id) - 4 from public.agreement_events)),
	array['payment_reported', 'payment_reported', 'payment_rejected', 'payment_withdrawn'],
	'olay sırası'
);

-- Alacaklı kendi kaydettiği ödeme: doğrudan onaylı, borçluya bilgi -------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is((pg_temp.pay(50000)) ->> 'status', 'confirmed', 'alacaklının kaydı doğrudan onaylı');
reset role;
select is((select outstanding_minor from pg_temp.ag()), 150000::bigint, 'bakiye düştü');
select is(
	(select template from public.notification_outbox where user_id = '22222222-2222-4222-8222-222222222222' order by id desc limit 1),
	'paymentRecorded',
	'borçluya bilgi'
);

-- Kalan borçtan fazla bildirilemez; onay anında da kontrol edilir --------------------------------------
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok($$ select pg_temp.pay(150001) $$, 'P0001', 'amount_exceeds_outstanding', 'kalan borçtan fazla bildirim');
insert into t select 'p4', pg_temp.pay(150000) ->> 'payment_id';
insert into t select 'p5', pg_temp.pay(150000) ->> 'payment_id';
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is((public.decide_payment((select value::uuid from t where name = 'p4'), 'confirm')) ->> 'status', 'confirmed', 'kalanın tamamı onaylandı');
reset role;
select results_eq(
	$$ select status::text, outstanding_minor from pg_temp.ag() $$,
	$$ values ('settled', 0::bigint) $$,
	'onayla kapandı'
);
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select throws_ok(
	format('select public.decide_payment(%L, %L)', (select value from t where name = 'p5'), 'confirm'),
	'P0001', 'invalid_transition', 'kapanmış anlaşmada bekleyen ödeme onaylanamaz'
);

-- Talepler: bekleyen ödemeler alacaklıda --------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
insert into t select 'ag2', public.create_agreement($j${
	"kind": "loan", "creator_role": "creditor", "title": "İkinci", "description": null, "started_on": null,
	"counterparty": {"contact_id": null},
	"terms": {"principal_minor": 100000, "down_payment_minor": 0, "notes": null, "plan": [{"seq": 1, "due_date": null, "amount_minor": 100000}]}
}$j$::jsonb || jsonb_build_object('counterparty', jsonb_build_object('contact_id', (select counterparty_contact_id from pg_temp.ag()))), gen_random_uuid()) ->> 'agreement_id';
select public.share_agreement((select value::uuid from t where name = 'ag2'), '+905550000002', 1);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select public.decide_agreement((select value::uuid from t where name = 'ag2'), 1,
	(public.get_pending_decision((select value::uuid from t where name = 'ag2')) ->> 'terms_hash'), 'accept', null);
select public.record_payment((select value::uuid from t where name = 'ag2'),
	'{"amount_minor": 40000, "paid_on": "2026-10-11", "method": "cash", "note": "Elden"}', 3, gen_random_uuid());
select is(public.list_requests(), '[]'::jsonb, 'bildiren için talep yok');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(
	(select jsonb_agg(jsonb_build_array(r ->> 'kind', r ->> 'from_name', (r ->> 'amount_minor')::bigint)) from jsonb_array_elements(public.list_requests()) as r),
	'[["payment", "Bora", 40000]]'::jsonb,
	'alacaklıya bekleyen ödeme'
);
select is((public.get_dashboard() ->> 'pending_count')::int, 1, 'Ana Sayfa bandı');

-- Kişisel mod değişmedi: sahip kaydeder, onaylı.
insert into t select 'personal', public.create_agreement($j${
	"kind": "loan", "creator_role": "debtor", "title": "Kişisel", "description": null, "started_on": null,
	"counterparty": {"contact": {"display_name": "Dükkân", "phone_e164": null, "kind": "merchant"}},
	"terms": {"principal_minor": 1000, "down_payment_minor": 0, "notes": null, "plan": [{"seq": 1, "due_date": null, "amount_minor": 1000}]}
}$j$::jsonb, gen_random_uuid()) ->> 'agreement_id';
select is(
	(public.record_payment((select value::uuid from t where name = 'personal'),
		'{"amount_minor": 500, "paid_on": "2026-10-11", "method": "cash", "note": null}', 1, gen_random_uuid())) ->> 'status',
	'confirmed',
	'kişisel modda borçlu sahip de doğrudan onaylı kaydeder'
);

select * from finish();
rollback;
