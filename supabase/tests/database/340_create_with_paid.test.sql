-- ADR-059: an installment record whose first installments are already behind it (design 24, "Ödendi").
begin;
select plan(14);

select set_config('paramnet.today', '2026-10-12', true);
insert into auth.users (id, phone, aud, role) values
	('11111111-1111-4111-8111-111111111111', '905550000001', 'authenticated', 'authenticated');
insert into public.profiles (id, display_name, phone_e164) values
	('11111111-1111-4111-8111-111111111111', 'Deniz', '+905550000001');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
	select set_config('role', 'authenticated', true),
		set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- 28.000 TL, 8.000 down on 15 Jul, six monthly rows from 15 Aug (the design's example).
create function pg_temp.create(p_key uuid, p_paid int) returns jsonb language sql as $$
	select public.create_agreement_with_paid($j${
		"kind": "installment_purchase", "creator_role": "debtor", "title": "Salon mobilyası", "description": null,
		"started_on": "2026-07-15",
		"counterparty": {"contact": {"display_name": "Kaya Mobilya", "phone_e164": null, "kind": "merchant"}},
		"terms": {"principal_minor": 2800000, "down_payment_minor": 800000, "notes": null, "plan": [
			{"seq": 1, "due_date": "2026-08-15", "amount_minor": 333333},
			{"seq": 2, "due_date": "2026-09-15", "amount_minor": 333333},
			{"seq": 3, "due_date": "2026-10-15", "amount_minor": 333333},
			{"seq": 4, "due_date": "2026-11-15", "amount_minor": 333333},
			{"seq": 5, "due_date": "2026-12-15", "amount_minor": 333333},
			{"seq": 6, "due_date": "2027-01-15", "amount_minor": 333335}
		]}
	}$j$::jsonb, p_paid, p_key);
$$;
grant execute on function pg_temp.create(uuid, int) to authenticated;

select ok(
	not has_function_privilege('anon', 'public.create_agreement_with_paid(jsonb, int, uuid)', 'execute'),
	'anon kayıt oluşturamaz'
);

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
create temp table r1 as select pg_temp.create('e1000000-0000-4000-8000-000000000001', 2) as r;
grant select on r1 to authenticated;
create temp table ag as select (r ->> 'agreement_id')::uuid as id from r1;
grant select on ag to authenticated;

select is((select r ->> 'replayed' from r1), 'false', 'yeni kayıt');
select is(
	(select outstanding_minor from public.agreements where id = (select id from ag)),
	1333334::bigint, 'kalan: iki taksit düşüldü'
);
select is(
	(select array_agg(paid_on order by paid_on) from public.payments
		where agreement_id = (select id from ag) and kind = 'payment'),
	array['2026-08-15', '2026-09-15']::date[], 'her ödeme kendi vade gününde'
);
select is(
	(select array_agg(paid_minor order by seq) from public.installments
		where agreement_id = (select id from ag)),
	array[333333, 333333, 0, 0, 0, 0]::bigint[], 'ödemeler ilk iki taksite dağıtıldı'
);
select is(
	(select paid_on from public.payments where agreement_id = (select id from ag) and kind = 'down_payment'),
	'2026-07-15'::date, 'peşinat alış tarihinde'
);
select is(
	(select count(*)::int from public.agreement_events
		where agreement_id = (select id from ag) and type = 'payment_recorded'),
	2, 'her ödeme olay kaydı yazar'
);
select is(
	(select status::text from public.agreements where id = (select id from ag)), 'personal', 'kişisel kayıt'
);

-- Same key: the same record, no second set of payments.
select is(
	(pg_temp.create('e1000000-0000-4000-8000-000000000001', 2) ->> 'replayed'), 'true', 'aynı anahtar: tekrar'
);
select is(
	(select count(*)::int from public.payments where agreement_id = (select id from ag)),
	3, 'tekrarda ödeme eklenmez'
);

-- Only past rows can be marked paid; the whole call rolls back.
select throws_ok(
	$$ select pg_temp.create('e1000000-0000-4000-8000-000000000002', 3) $$,
	'P0001', 'validation_error', 'vadesi gelmemiş taksit ödendi sayılmaz'
);
select is(
	(select count(*)::int from public.agreements where idempotency_key = 'e1000000-0000-4000-8000-000000000002'),
	0, 'hata: kayıt da oluşmaz'
);
select throws_ok(
	$$ select pg_temp.create('e1000000-0000-4000-8000-000000000003', -1) $$,
	'P0001', 'validation_error', 'negatif sayı'
);

-- Zero: same as create_agreement.
create temp table r0 as select pg_temp.create('e1000000-0000-4000-8000-000000000004', 0) as r;
select is(
	(select outstanding_minor from public.agreements where id = (select (r ->> 'agreement_id')::uuid from r0)),
	2000000::bigint, 'sıfır: ödeme yok'
);

select * from finish();
rollback;
