begin;
select plan(35);

-- Same data and "today" as the mobile mock adapter's demo seed (apps/mobile/src/api/mock/seed.ts),
-- so the expected numbers match the mobile tests exactly.
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

create function pg_temp.agreement(
	kind text, role text, title text, counterparty jsonb, principal bigint, down bigint, plan jsonb
) returns uuid language sql as $$
	select (public.create_agreement(
		jsonb_build_object(
			'kind', kind, 'creator_role', role, 'title', title, 'description', null, 'started_on', null,
			'counterparty', counterparty,
			'terms', jsonb_build_object('principal_minor', principal, 'down_payment_minor', down, 'notes', null, 'plan', plan)
		),
		gen_random_uuid()
	) ->> 'agreement_id')::uuid;
$$;

create function pg_temp.plan(principal bigint, down bigint, n int, first date) returns jsonb language sql as $$
	select jsonb_agg(r || jsonb_build_object('seq', (r ->> 'seq')::int))
	from jsonb_array_elements(private.generate_plan(jsonb_build_object(
		'principal', principal, 'down_payment', down, 'count', n, 'period', 'monthly',
		'first_due_date', to_char(first, 'YYYY-MM-DD')))) as r;
$$;

create function pg_temp.pay(id uuid, amount bigint, paid_on date) returns void language sql as $$
	select public.record_payment(
		id,
		jsonb_build_object('amount_minor', amount, 'paid_on', to_char(paid_on, 'YYYY-MM-DD'), 'method', 'cash', 'note', null),
		(select row_version from public.agreements where agreements.id = pay.id),
		gen_random_uuid()
	);
$$;

-- Plans are generated as the owner (private functions are closed to clients).
create temp table plans as select
	pg_temp.plan(1200000, 0, 3, '2026-09-01') as ahmet,
	pg_temp.plan(2800000, 800000, 5, '2026-10-11') as yildiz,
	'[{"seq": 1, "due_date": null, "amount_minor": 250000}]'::jsonb as elif,
	pg_temp.plan(900000, 0, 3, '2026-10-16') as mert_sale,
	pg_temp.plan(100000, 0, 1, '2026-08-12') as mert_loan;
grant select on plans to authenticated;
create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
insert into ids values ('ahmet', pg_temp.agreement('loan', 'creditor', 'Borç',
	'{"contact": {"display_name": "Ahmet Yılmaz", "phone_e164": "+905551112233", "kind": "person"}}', 1200000, 0, (select ahmet from plans)));
insert into ids values ('yildiz', pg_temp.agreement('installment_purchase', 'debtor', 'Mobilya',
	'{"contact": {"display_name": "Yıldız Mobilya", "phone_e164": null, "kind": "merchant"}}', 2800000, 800000, (select yildiz from plans)));
insert into ids values ('elif', pg_temp.agreement('loan', 'debtor', 'Borç',
	'{"contact": {"display_name": "Elif Kaya", "phone_e164": "+905552223344", "kind": "person"}}', 250000, 0, (select elif from plans)));
insert into ids values ('mert_sale', pg_temp.agreement('installment_purchase', 'creditor', 'Bisiklet',
	'{"contact": {"display_name": "Mert Demir", "phone_e164": "+905553334455", "kind": "person"}}', 900000, 0, (select mert_sale from plans)));
insert into ids values ('mert_loan', pg_temp.agreement('loan', 'creditor', 'Borç',
	jsonb_build_object('contact_id', (select counterparty_contact_id from public.agreements where id = (select id from ids where name = 'mert_sale'))),
	100000, 0, (select mert_loan from plans)));
select pg_temp.pay((select id from ids where name = 'ahmet'), 400000, '2026-09-01');
select pg_temp.pay((select id from ids where name = 'ahmet'), 150000, '2026-10-05');
select pg_temp.pay((select id from ids where name = 'mert_loan'), 100000, '2026-08-12');

-- get_dashboard ------------------------------------------------------------------------------------
create temp table dash as select public.get_dashboard() as d;
select is((select (d ->> 'receivable_minor')::bigint from dash), 1550000::bigint, 'alacak toplamı');
select is((select (d ->> 'payable_minor')::bigint from dash), 2250000::bigint, 'borç toplamı');
select is((select (d ->> 'due_this_month_minor')::bigint from dash), 400000::bigint, 'bu ay ödenecek');
select is((select (d ->> 'collect_this_month_minor')::bigint from dash), 550000::bigint, 'bu ay tahsil edilecek');
select is((select d -> 'has_agreements' from dash), 'true'::jsonb, 'kayıt var');
select is((select (d ->> 'pending_count')::int from dash), 0, 'kişisel modda bekleyen iş yok');
select is(
	(select d -> 'overdue' from dash),
	jsonb_build_array(jsonb_build_object(
		'agreement_id', (select id from ids where name = 'ahmet'), 'title', 'Borç', 'counterparty_name', 'Ahmet Yılmaz',
		'my_role', 'creditor', 'seq', 2, 'installment_count', 3, 'due_date', '2026-10-01', 'due_minor', 250000,
		'state', jsonb_build_object('status', 'overdue', 'partial', true)
	)),
	'geciken taksit (DueItem şekli)'
);
select is(
	(select jsonb_agg(jsonb_build_array(u ->> 'due_date', u -> 'state' ->> 'status')) from dash, jsonb_array_elements(d -> 'upcoming') as u),
	'[["2026-10-11", "due_today"], ["2026-10-16", "upcoming"], ["2026-11-01", "upcoming"], ["2026-11-11", "upcoming"], ["2026-11-16", "upcoming"]]'::jsonb,
	'yaklaşan 5 vade, sıralı'
);

-- list_contacts_with_balance / get_contact_detail ----------------------------------------------------
select is(
	(select jsonb_agg(jsonb_build_array(c ->> 'display_name', (c ->> 'net_minor')::bigint, (c ->> 'open_agreement_count')::int))
		from jsonb_array_elements(public.list_contacts_with_balance()) as c),
	'[["Ahmet Yılmaz", 650000, 1], ["Elif Kaya", -250000, 1], ["Mert Demir", 900000, 1], ["Yıldız Mobilya", -2000000, 1]]'::jsonb,
	'kişiler Türkçe sırada, işaretli net bakiye'
);
create temp table mert as select public.get_contact_detail(
	(select counterparty_contact_id from public.agreements where id = (select id from ids where name = 'mert_sale'))
) as c;
select is((select (c ->> 'net_minor')::bigint from mert), 900000::bigint, 'kişi net bakiyesi');
select is(
	(select jsonb_agg(a ->> 'status' order by a ->> 'status') from mert, jsonb_array_elements(c -> 'agreements') as a),
	'["personal", "settled"]'::jsonb,
	'kişinin tüm anlaşmaları (kapananlar dahil)'
);
select is((select c ->> 'phone_e164' from mert), '+905553334455', 'kişi telefonu');

-- get_agreement_detail -----------------------------------------------------------------------------
create temp table detail as select public.get_agreement_detail((select id from ids where name = 'ahmet')) as a;
select is((select a ->> 'my_role' from detail), 'creditor', 'rol');
select is((select (a ->> 'outstanding_minor')::bigint from detail), 650000::bigint, 'kalan');
select is((select (a ->> 'principal_minor')::bigint from detail), 1200000::bigint, 'toplam');
select is((select (a ->> 'down_payment_minor')::bigint from detail), 0::bigint, 'peşinat');
select is((select (a ->> 'row_version')::int from detail), 3, 'row_version');
select is(
	(select a -> 'counterparty' from detail),
	jsonb_build_object('contact_id', (select counterparty_contact_id from public.agreements where id = (select id from ids where name = 'ahmet')),
		'display_name', 'Ahmet Yılmaz', 'kind', 'person', 'phone_e164', '+905551112233'),
	'karşı taraf'
);
select is(
	(select jsonb_agg(jsonb_build_array((i ->> 'seq')::int, (i ->> 'paid_minor')::bigint, i -> 'state' ->> 'status', (i -> 'state' ->> 'partial')::boolean))
		from detail, jsonb_array_elements(a -> 'installments') as i),
	'[[1, 400000, "paid", false], [2, 150000, "overdue", true], [3, 0, "upcoming", false]]'::jsonb,
	'taksitler türetilmiş durumla'
);
select is(
	(select a -> 'next_installment' from detail),
	'{"seq": 2, "due_date": "2026-10-01", "due_minor": 250000, "state": {"status": "overdue", "partial": true}}'::jsonb,
	'sıradaki taksit'
);
select is((select (a ->> 'installment_count')::int from detail), 3, 'taksit sayısı');
select is((select (a ->> 'paid_installment_count')::int from detail), 1, 'ödenen taksit sayısı');
select is(
	(select jsonb_agg((p ->> 'amount_minor')::bigint) from detail, jsonb_array_elements(a -> 'payments') as p),
	'[150000, 400000]'::jsonb,
	'ödemeler yeniden eskiye'
);
select is(
	(select jsonb_agg(jsonb_build_array(e ->> 'type', e ->> 'actor', e -> 'amount_minor')) from detail, jsonb_array_elements(a -> 'events') as e),
	'[["created", "me", null], ["payment_recorded", "me", 400000], ["payment_recorded", "me", 150000]]'::jsonb,
	'olaylar eskiden yeniye, aktör bakış açısından'
);

-- get_calendar --------------------------------------------------------------------------------------
create temp table cal as select public.get_calendar('2026-10-01') as c;
select is(
	(select jsonb_agg(k order by k) from cal, jsonb_object_keys(c -> 'days') as k),
	'["2026-10-01", "2026-10-11", "2026-10-16"]'::jsonb,
	'ekim vadeleri günlere göre'
);
select is((select c -> 'days' -> '2026-10-11' -> 0 ->> 'counterparty_name' from cal), 'Yıldız Mobilya', 'gün içeriği');

-- Okuma yollarının dayandığı indeksler (spec 9: performans).
select has_index('public', 'agreements', 'agreements_creator_status_idx', array['creator_id', 'status'], 'anlaşmalar: oluşturan + durum');
select has_index('public', 'agreements', 'agreements_counterparty_profile_status_idx', array['counterparty_profile_id', 'status'], 'anlaşmalar: karşı taraf + durum');
select has_index('public', 'installments', 'installments_agreement_id_version_seq_key', array['agreement_id', 'version', 'seq'], 'taksitler: anlaşma + versiyon + sıra');
select has_index('public', 'payments', 'payments_agreement_id_idx', array['agreement_id'], 'ödemeler: anlaşma');
select has_index('public', 'agreement_events', 'agreement_events_agreement_id_idx', array['agreement_id', 'id'], 'olaylar: anlaşma + sıra');

-- Yetki: Bora hiçbirini görmez; oturumsuz çağrı reddedilir.
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is((select (public.get_dashboard() ->> 'has_agreements')::boolean), false, 'yabancı özet boş');
select is(public.list_contacts_with_balance(), '[]'::jsonb, 'yabancı kişi listesi boş');
select throws_ok(
	format('select public.get_agreement_detail(%L)', (select id from ids where name = 'ahmet')),
	'P0001', 'not_found', 'yabancı detay göremez'
);
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$ select public.get_dashboard() $$, '28000', 'not_authenticated', 'oturumsuz');

select * from finish();
rollback;
