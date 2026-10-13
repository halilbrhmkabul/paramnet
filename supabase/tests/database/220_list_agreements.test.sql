begin;
select plan(6);

-- F3-11: Borçlarım / Alacaklarım listesi (tasarım "12 · Borçlarım / Alacaklarım").
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

create function pg_temp.create(p_name text, p_role text, p_phone text) returns uuid language plpgsql as $$
declare
	v_id uuid;
begin
	v_id := (public.create_agreement(jsonb_build_object(
		'kind', 'loan', 'creator_role', p_role, 'title', p_name, 'description', null, 'started_on', null,
		'counterparty', jsonb_build_object('contact', jsonb_build_object('display_name', 'Kişi', 'phone_e164', p_phone, 'kind', 'person')),
		'terms', jsonb_build_object('principal_minor', 100000, 'down_payment_minor', 0, 'notes', null, 'plan', jsonb_build_array(
			jsonb_build_object('seq', 1, 'due_date', '2026-11-10', 'amount_minor', 100000)))
	), gen_random_uuid()) ->> 'agreement_id')::uuid;
	insert into t values (p_name, v_id::text);
	return v_id;
end;
$$;

-- Ayşe: bir kişisel alacak, bir kişisel borç, Bora ile paylaşılmış bir alacak. Cem'in kaydı ayrı.
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select pg_temp.create('alacak', 'creditor', null);
select pg_temp.create('borc', 'debtor', null);
select pg_temp.create('ortak', 'creditor', '+905550000002');
select public.share_agreement((select value::uuid from t where name = 'ortak'), '+905550000002', 1);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select public.decide_agreement((select value::uuid from t where name = 'ortak'), 1,
	public.get_pending_decision((select value::uuid from t where name = 'ortak')) ->> 'terms_hash', 'accept', null);
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select pg_temp.create('cem', 'creditor', null);

select ok(not has_function_privilege('anon', 'public.list_agreements()', 'execute'), 'anon listeleyemez');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(
	(select array_agg(a ->> 'title' order by a ->> 'title') from jsonb_array_elements(public.list_agreements()) as a),
	array['alacak', 'borc', 'ortak'],
	'oluşturduğu tüm anlaşmalar'
);
select is(
	(select a - 'id' - 'counterparty' - 'next_installment' - 'row_version' from jsonb_array_elements(public.list_agreements()) as a where a ->> 'title' = 'borc'),
	'{"kind": "loan", "title": "borc", "status": "personal", "my_role": "debtor", "is_creator": true,
		"principal_minor": 100000, "outstanding_minor": 100000, "reported_minor": 0,
		"installment_count": 1, "paid_installment_count": 0}'::jsonb,
	'özetle aynı alanlar (rol, kalan, taksit)'
);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is(
	(select array_agg((a ->> 'title') || ':' || (a ->> 'my_role')) from jsonb_array_elements(public.list_agreements()) as a),
	array['ortak:debtor'],
	'karşı taraf paylaşılmış anlaşmayı kendi rolüyle görür'
);
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select is(jsonb_array_length(public.list_agreements()), 1, 'başkasının anlaşmaları görünmez');
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$ select public.list_agreements() $$, '28000', null, 'oturumsuz');

select * from finish();
rollback;
