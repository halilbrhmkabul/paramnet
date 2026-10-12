begin;
select plan(13);

-- Ayşe paylaşır; Bora (+905550000002) henüz kayıtlı değil, web'den yanıtlar.
insert into auth.users (id, phone, aud, role) values
	('11111111-1111-4111-8111-111111111111', '905550000001', 'authenticated', 'authenticated');
insert into public.profiles (id, display_name, phone_e164) values
	('11111111-1111-4111-8111-111111111111', 'Ayşe', '+905550000001');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
	select set_config('role', 'authenticated', true),
		set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create temp table t (name text primary key, value text);
grant all on t to authenticated;

-- Ayşe bir anlaşma oluşturup verilen numaraya paylaşır.
create function pg_temp.shared(p_name text, p_phone text) returns void language plpgsql as $$
declare
	v_id uuid;
begin
	perform pg_temp.act_as('11111111-1111-4111-8111-111111111111');
	v_id := (public.create_agreement(jsonb_build_object(
		'kind', 'loan', 'creator_role', 'creditor', 'title', p_name, 'description', null, 'started_on', null,
		'counterparty', jsonb_build_object('contact', jsonb_build_object('display_name', p_name || ' kişi', 'phone_e164', p_phone, 'kind', 'person')),
		'terms', jsonb_build_object('principal_minor', 100000, 'down_payment_minor', 0, 'notes', null, 'plan', jsonb_build_array(
			jsonb_build_object('seq', 1, 'due_date', '2026-11-10', 'amount_minor', 100000)))
	), gen_random_uuid()) ->> 'agreement_id')::uuid;
	insert into t values (p_name, v_id::text);
	perform public.share_agreement(v_id, p_phone, 1);
	reset role;
end;
$$;

-- invite_decide'ın web kanalı: hesap yokken karşı taraf bağlanmaz.
create function pg_temp.web(p_name text, p_decision text, p_counter jsonb) returns void language plpgsql as $$
declare
	v_ag public.agreements;
	v_invite uuid;
begin
	select * into v_ag from public.agreements where id = (select value::uuid from t where name = p_name) for update;
	select id into v_invite from public.invites where agreement_id = v_ag.id and status = 'active';
	perform private.apply_decision(
		v_ag, v_invite, null, (select target_phone_e164 from public.invites where id = v_invite), null, 'web', 1,
		(select terms_hash from public.agreement_versions where agreement_id = v_ag.id and version = 1),
		p_decision, p_counter, null, null
	);
end;
$$;

select pg_temp.shared('accepted', '+905550000002');
select pg_temp.web('accepted', 'accept', null);
select pg_temp.shared('countered', '+905550000002');
select pg_temp.web('countered', 'counter', '{"principal_minor": 100000, "down_payment_minor": 0, "notes": null, "plan": [
	{"seq": 1, "due_date": "2026-12-10", "amount_minor": 100000}]}'::jsonb);
select pg_temp.shared('rejected', '+905550000002');
select pg_temp.web('rejected', 'reject', null);
select pg_temp.shared('pending', '+905550000002');
select pg_temp.shared('other', '+905550000003');
select pg_temp.web('other', 'accept', null);

create function pg_temp.linked(p_name text) returns uuid language sql security definer as $$
	select counterparty_profile_id from public.agreements where id = (select value::uuid from t where name = p_name);
$$;

select ok(pg_temp.linked('accepted') is null, 'kayıttan önce web onayı hesaba bağlı değil');

-- Bora kaydolur.
insert into auth.users (id, phone, aud, role) values
	('22222222-2222-4222-8222-222222222222', '905550000002', 'authenticated', 'authenticated');
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is(
	public.complete_profile('Bora', '2026-10', '2026-10') ->> 'pending_requests',
	'1',
	'bekleyen paylaşım sayısı döner (Talepler açılır)'
);
reset role;

select is(pg_temp.linked('accepted'), '22222222-2222-4222-8222-222222222222'::uuid, 'web''de onaylanan anlaşma bağlandı');
select is(pg_temp.linked('countered'), '22222222-2222-4222-8222-222222222222'::uuid, 'web''de düzeltme önerilen anlaşma bağlandı');
select ok(pg_temp.linked('rejected') is null, '"Bana ait değil" denen anlaşma bağlanmaz');
select ok(pg_temp.linked('pending') is null, 'yanıtlanmamış davet karar anında bağlanır');
select ok(pg_temp.linked('other') is null, 'başka numaranın anlaşması bağlanmaz');
select results_eq(
	$$ select linked_profile_id from public.contacts
		where owner_id = '11111111-1111-4111-8111-111111111111' and phone_e164 = '+905550000002' $$,
	$$ values ('22222222-2222-4222-8222-222222222222'::uuid) $$,
	'Ayşe''nin rehberindeki kayıtlar hesaba bağlandı'
);
select is(
	(select linked_profile_id from public.contacts where phone_e164 = '+905550000003'),
	null,
	'başka numaranın kişisi bağlanmaz'
);

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is(
	public.get_agreement_detail((select value::uuid from t where name = 'accepted')) ->> 'status',
	'active',
	'Bora web''de onayladığı anlaşmayı uygulamada görür'
);
select is(
	public.get_agreement_detail((select value::uuid from t where name = 'countered')) ->> 'status',
	'countered',
	'Bora düzeltme önerisinin yanıtını bekler'
);
select is(
	(select r ->> 'kind' from jsonb_array_elements(public.list_requests()) as r),
	'share',
	'bekleyen davet Talepler''de'
);
select is(
	public.complete_profile('Bora B.', '2026-10', '2026-10') ->> 'pending_requests',
	'1',
	'tekrar çağrı güvenli'
);

select * from finish();
rollback;
