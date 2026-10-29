-- ADR-058: "Para iste" (a borrower's request shared by ParamNet ID) and the hand-over confirmation.
begin;
select plan(20);

select set_config('paramnet.today', '2026-10-25', true);
insert into auth.users (id, phone, aud, role) values
	('11111111-1111-4111-8111-111111111111', '905550000001', 'authenticated', 'authenticated'),
	('22222222-2222-4222-8222-222222222222', '905550000002', 'authenticated', 'authenticated'),
	('33333333-3333-4333-8333-333333333333', '905550000003', 'authenticated', 'authenticated');
insert into public.profiles (id, display_name, phone_e164) values
	('11111111-1111-4111-8111-111111111111', 'Deniz', '+905550000001'),
	('22222222-2222-4222-8222-222222222222', 'Can', '+905550000002'),
	('33333333-3333-4333-8333-333333333333', 'Üçüncü', '+905550000003');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
	select set_config('role', 'authenticated', true),
		set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create temp table can_id as select paramnet_id as id from public.profiles where id = '22222222-2222-4222-8222-222222222222';
grant select on can_id to authenticated;

create function pg_temp.request(p_key uuid, p_to text) returns jsonb language sql as $$
	select public.request_money($j${
		"kind": "loan", "creator_role": "debtor", "title": "Para isteği", "description": "Konser bileti", "started_on": null,
		"counterparty": {"contact": {"display_name": "Can", "phone_e164": null, "kind": "person"}},
		"terms": {"principal_minor": 300000, "down_payment_minor": 0, "notes": null,
			"plan": [{"seq": 1, "due_date": "2026-11-30", "amount_minor": 300000}]}
	}$j$::jsonb, p_to, p_key);
$$;
grant execute on function pg_temp.request(uuid, text) to authenticated;

select ok(not has_function_privilege('anon', 'public.request_money(jsonb, text, uuid)', 'execute'), 'anon para isteyemez');
select ok(not has_function_privilege('anon', 'public.report_delivery(uuid, int)', 'execute'), 'anon teslim bildiremez');

-- Asking ---------------------------------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
create temp table r1 as select pg_temp.request('d1000000-0000-4000-8000-000000000001', (select id from can_id)) as r;
grant select on r1 to authenticated;
create temp table ag as select (r ->> 'agreement_id')::uuid as id from r1;
grant select on ag to authenticated;
select is((select r ->> 'status' from r1), 'shared', 'talep gönderildi');
select is((select r ->> 'display_name' from r1), 'Can', 'kime gittiği');
select is(
	(pg_temp.request('d1000000-0000-4000-8000-000000000001', (select id from can_id)) ->> 'agreement_id'),
	(select r ->> 'agreement_id' from r1), 'aynı anahtar: tek talep'
);
select throws_ok($$ select pg_temp.request(gen_random_uuid(), 'PN-222222') $$, 'P0001', 'not_found', 'bulunamayan ID: talep kalmaz');
select throws_ok(
	$$ select public.request_money('{"kind": "installment_purchase", "creator_role": "debtor"}', 'PN-222222', gen_random_uuid()) $$,
	'P0001', 'validation_error', 'yalnızca borç alanın borç kaydı'
);
create temp table d0 as select public.get_delivery((select id from ag)) as r;
select is((select r ->> 'required' from d0), 'true', 'teslim onayı gerekiyor');
select is((select r ->> 'status' from d0), 'pending', 'yanıt bekleniyor');

-- The lender accepts, gives the money; the borrower confirms -------------------------------------------------
reset role;
create temp table hash as select terms_hash from public.agreement_versions where agreement_id = (select id from ag) and version = 1;
grant select on hash to authenticated;
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is(
	public.decide_agreement((select id from ag), 1, (select terms_hash from hash), 'accept', null) ->> 'status',
	'active', 'Can kabul etti'
);
create temp table d1 as select public.get_delivery((select id from ag)) as r;
select is((select r ->> 'my_role' from d1), 'creditor', 'Can borç veren');
select throws_ok(
	format($$ select public.confirm_delivery(%L, %s) $$, (select id from ag), (select r ->> 'row_version' from d1)),
	'P0001', 'forbidden', 'borç veren alındı onayı veremez'
);
create temp table rep as select public.report_delivery((select id from ag), (select (r ->> 'row_version')::int from d1)) as r;
select ok((select r ->> 'reported_at' from rep) is not null, 'Can teslim etti');
select throws_ok(
	format($$ select public.report_delivery(%L, %s) $$, (select id from ag), (select r ->> 'row_version' from rep)),
	'P0001', 'invalid_transition', 'ikinci kez bildirilmez'
);

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select throws_ok(
	format($$ select public.confirm_delivery(%L, %s) $$, (select id from ag), (select (r ->> 'row_version')::int - 1 from rep)),
	'P0001', 'conflict', 'eski row_version'
);
create temp table conf as select public.confirm_delivery((select id from ag), (select (r ->> 'row_version')::int from rep)) as r;
select ok((select r ->> 'confirmed_at' from conf) is not null, 'Deniz aldığını onayladı');
select is((select r ->> 'my_role' from conf), 'debtor', 'Deniz borç alan');
reset role;
select results_eq(
	$$ select type from public.agreement_events where agreement_id = (select id from ag) and type like 'delivery_%' order by created_at $$,
	$$ values ('delivery_reported'), ('delivery_confirmed') $$,
	'olay kaydı'
);

select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select throws_ok(format($$ select public.get_delivery(%L) $$, (select id from ag)), 'P0001', 'not_found', 'üçüncü kişi göremez');
select throws_ok(format($$ select public.report_delivery(%L, 1) $$, (select id from ag)), 'P0001', 'not_found', 'üçüncü kişi bildiremez');

select * from finish();
rollback;
