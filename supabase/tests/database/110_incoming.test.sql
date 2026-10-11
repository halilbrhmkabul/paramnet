begin;
select plan(23);

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
	"kind": "installment_purchase", "creator_role": "creditor", "title": "Bisiklet", "description": null, "started_on": null,
	"counterparty": {"contact": {"display_name": "Bora", "phone_e164": null, "kind": "person"}},
	"terms": {"principal_minor": 200000, "down_payment_minor": 0, "notes": null,
		"plan": [{"seq": 1, "due_date": "2026-11-10", "amount_minor": 100000}, {"seq": 2, "due_date": "2026-12-10", "amount_minor": 100000}]}
}$j$::jsonb, gen_random_uuid()) ->> 'agreement_id';
insert into t select 'token', public.share_agreement((select value::uuid from t where name = 'ag'), '+905550000002', 1) ->> 'token';

-- resolve_invite ----------------------------------------------------------------------------------------
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select is(
	public.resolve_invite((select value from t where name = 'token')),
	'{"status": "active", "creator_name": "Ayşe", "mismatch": true, "agreement_id": null}'::jsonb,
	'başka numaradaki hesap: ayrıntı yok (deep-links.md 2)'
);
select is(public.resolve_invite('yok'), '{"status": "invalid"}'::jsonb, 'bilinmeyen token');
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is(
	public.resolve_invite((select value from t where name = 'token')),
	jsonb_build_object('status', 'active', 'creator_name', 'Ayşe', 'mismatch', false, 'agreement_id', (select value from t where name = 'ag')),
	'hedef numaralı hesap anlaşmaya yönlenir'
);

-- get_pending_decision: counterparty -------------------------------------------------------------------
create temp table pd as select public.get_pending_decision((select value::uuid from t where name = 'ag')) as d;
grant select on pd to authenticated;
select is((select d ->> 'actor' from pd), 'counterparty', 'karar karşı tarafta');
select is((select d ->> 'other_name' from pd), 'Ayşe', 'karşı tarafın adı');
select is((select d ->> 'my_role' from pd), 'debtor', 'bakış açısından rol');
select is((select (d ->> 'version')::int from pd), 1, 'versiyon');
select is(
	(select d ->> 'terms_hash' from pd),
	(select value from (select public.get_pending_decision((select value::uuid from t where name = 'ag')) ->> 'terms_hash' as value) x),
	'hash'
);
select is((select jsonb_array_length(d -> 'proposed' -> 'plan') from pd), 2, 'önerilen plan');
select is((select d -> 'current' from pd), (select d -> 'proposed' from pd), 'ilk paylaşımda mevcut = önerilen');
select is((select d ->> 'can_reject' from pd), 'true', 'karşı taraf reddedebilir');

select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select throws_ok($$ select public.get_pending_decision((select value::uuid from t where name = 'ag')) $$, 'P0001', 'not_found', 'yabancı göremez');

-- list_requests -----------------------------------------------------------------------------------------
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is(
	(select jsonb_agg(jsonb_build_array(r ->> 'kind', r ->> 'title', r ->> 'from_name')) from jsonb_array_elements(public.list_requests()) as r),
	'[["share", "Bisiklet", "Ayşe"]]'::jsonb,
	'Bora''ya gelen paylaşım'
);
select is((public.get_dashboard() ->> 'pending_count')::int, 1, 'Ana Sayfa bandında sayılır');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(public.list_requests(), '[]'::jsonb, 'Ayşe''nin bekleyen işi yok');
select is((public.get_agreement_detail((select value::uuid from t where name = 'ag')) ->> 'is_creator')::boolean, true, 'oluşturan');

-- After a counter offer the creator decides ------------------------------------------------------------
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select public.decide_agreement((select value::uuid from t where name = 'ag'), 1, (select d ->> 'terms_hash' from pd), 'counter',
	'{"principal_minor": 200000, "down_payment_minor": 0, "notes": null, "plan": [{"seq": 1, "due_date": "2026-12-10", "amount_minor": 200000}]}'::jsonb);
select is(public.list_requests(), '[]'::jsonb, 'öneren artık beklemiyor');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(
	(select jsonb_agg(jsonb_build_array(r ->> 'kind', r ->> 'from_name')) from jsonb_array_elements(public.list_requests()) as r),
	'[["counter", "Bora"]]'::jsonb,
	'oluşturana karşı öneri'
);
create temp table pd2 as select public.get_pending_decision((select value::uuid from t where name = 'ag')) as d;
select is((select d ->> 'actor' from pd2), 'creator', 'karar oluşturanda');
select is((select (d ->> 'version')::int from pd2), 2, 'önerilen versiyon');
select is((select jsonb_array_length(d -> 'current' -> 'plan') from pd2), 2, 'mevcut plan');
select is((select d ->> 'can_reject' from pd2), 'false', 'oluşturanın reddi geri çekmedir');
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is((public.get_agreement_detail((select value::uuid from t where name = 'ag')) ->> 'is_creator')::boolean, false, 'karşı taraf oluşturan değil');

select * from finish();
rollback;
