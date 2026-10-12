begin;
select plan(6);

-- Spec 16 kritik senaryo 1: iki taraf aynı sürüme göre farklı ödemeler kaydeder. Satır kilidi + row_version
-- ikinciyi "conflict" ile durdurur; istemci yeniler ve tekrar dener. Bakiye her adımda doğrudur.

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
create temp table t (name text primary key, value text);
grant all on t to authenticated;

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
insert into t select 'ag', public.create_agreement($j${
	"kind": "loan", "creator_role": "creditor", "title": "Borç", "description": null, "started_on": null,
	"counterparty": {"contact": {"display_name": "Bora", "phone_e164": null, "kind": "person"}},
	"terms": {"principal_minor": 100000, "down_payment_minor": 0, "notes": null, "plan": [
		{"seq": 1, "due_date": "2026-11-10", "amount_minor": 50000},
		{"seq": 2, "due_date": "2026-12-10", "amount_minor": 50000}]}
}$j$::jsonb, gen_random_uuid()) ->> 'agreement_id';
select public.share_agreement((select value::uuid from t where name = 'ag'), '+905550000002', 1);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select public.decide_agreement((select value::uuid from t where name = 'ag'), 1,
	(public.get_pending_decision((select value::uuid from t where name = 'ag')) ->> 'terms_hash'), 'accept', null);
reset role;

create function pg_temp.ag() returns public.agreements language sql security definer as $$
	select * from public.agreements where id = (select value::uuid from t where name = 'ag');
$$;
-- İki taraf da ekranında aynı sürümü görüyor.
insert into t select 'rv', (pg_temp.ag()).row_version::text;

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(
	public.record_payment((select value::uuid from t where name = 'ag'),
		'{"amount_minor": 30000, "paid_on": "2026-10-11", "method": "cash", "note": null}',
		(select value::int from t where name = 'rv'), gen_random_uuid()) ->> 'status',
	'confirmed',
	'alacaklının kaydı önce gelir'
);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok(
	$$ select public.record_payment((select value::uuid from t where name = 'ag'),
		'{"amount_minor": 20000, "paid_on": "2026-10-11", "method": "transfer", "note": null}',
		(select value::int from t where name = 'rv'), gen_random_uuid()) $$,
	'P0001', 'conflict', 'eski sürümle gelen ikinci kayıt reddedilir (sessizce üst üste yazılmaz)'
);
reset role;
select is((pg_temp.ag()).outstanding_minor, 70000::bigint, 'bakiye yalnızca kabul edilen kayıtla değişti');

-- Borçlu yeniler ve tekrar dener; alacaklı onaylar.
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
insert into t select 'p2', public.record_payment((select value::uuid from t where name = 'ag'),
	'{"amount_minor": 20000, "paid_on": "2026-10-11", "method": "transfer", "note": null}',
	(select row_version from public.agreements where id = (select value::uuid from t where name = 'ag')), gen_random_uuid()) ->> 'payment_id';
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.decide_payment((select value::uuid from t where name = 'p2'), 'confirm');
reset role;
select is((pg_temp.ag()).outstanding_minor, 50000::bigint, 'iki ödeme de bakiyede');
select is(
	(select sum(paid_minor)::bigint from public.installments where agreement_id = (select value::uuid from t where name = 'ag')),
	50000::bigint,
	'dağıtımlar bakiyeyle tutarlı'
);
select is(
	(select count(*)::int from public.payments where agreement_id = (select value::uuid from t where name = 'ag') and status = 'confirmed'),
	2,
	'çift kayıt yok'
);

select * from finish();
rollback;
