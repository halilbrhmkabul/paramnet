-- ADR-061: "Hesabı böl". Each share is a single-payment loan from the payer, sent by ParamNet ID or after a
-- link join the payer approves; acceptance and payments are the existing agreement flows.
begin;
select plan(46);

select set_config('paramnet.today', '2026-10-30', true);
insert into auth.users (id, phone, aud, role) values
	('11111111-1111-4111-8111-111111111111', '905550000001', 'authenticated', 'authenticated'),
	('22222222-2222-4222-8222-222222222222', '905550000002', 'authenticated', 'authenticated'),
	('33333333-3333-4333-8333-333333333333', '905550000003', 'authenticated', 'authenticated'),
	('44444444-4444-4444-8444-444444444444', '905550000004', 'authenticated', 'authenticated');
insert into public.profiles (id, display_name, phone_e164) values
	('11111111-1111-4111-8111-111111111111', 'Deniz', '+905550000001'),
	('22222222-2222-4222-8222-222222222222', 'Ayşe', '+905550000002'),
	('33333333-3333-4333-8333-333333333333', 'Can', '+905550000003'),
	('44444444-4444-4444-8444-444444444444', 'Yabancı', '+905550000004');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
	select set_config('role', 'authenticated', true),
		set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create temp table ayse_id as select paramnet_id as id from public.profiles where id = '22222222-2222-4222-8222-222222222222';
grant select on ayse_id to authenticated;

create function pg_temp.split_input(p_ayse text, p_ayse_share bigint) returns jsonb language sql as $$
	select jsonb_build_object(
		'title', 'Kordon’da akşam yemeği', 'total_minor', 360000, 'spent_on', '2026-10-30', 'mode', 'equal',
		'owner_share_minor', 120000,
		'members', jsonb_build_array(
			jsonb_build_object('display_name', 'Ayşe Demir', 'share_minor', p_ayse_share, 'paramnet_id', p_ayse),
			jsonb_build_object('display_name', 'Can Özdemir', 'share_minor', 120000, 'paramnet_id', null)
		)
	);
$$;
grant execute on function pg_temp.split_input(text, bigint) to authenticated;

select ok(not has_function_privilege('anon', 'public.create_split(jsonb, uuid)', 'execute'), 'anon hesap bölemez');
select ok(not has_function_privilege('anon', 'public.get_split_invite(text)', 'execute'), 'anon davete bakamaz');
select is((select count(*) from pg_policies where tablename in ('splits', 'split_members', 'split_events')), 0::bigint,
	'tablolar istemciye kapalı');

-- Creating ---------------------------------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select throws_ok(
	format($$ select public.create_split(pg_temp.split_input(%L, 100000), gen_random_uuid()) $$, (select id from ayse_id)),
	'P0001', 'validation_error', 'paylar toplamı tutmuyor'
);
select throws_ok(
	$$ select public.create_split(pg_temp.split_input('PN-222222', 120000), gen_random_uuid()) $$,
	'P0001', 'not_found', 'bulunamayan ID: hesap kalmaz'
);
select throws_ok('select count(*) from public.splits', '42501', null, 'tabloya doğrudan erişilmez');
reset role;
select is((select count(*) from public.splits), 0::bigint, 'başarısız denemeler iz bırakmaz');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
create temp table c1 as
	select public.create_split(pg_temp.split_input((select id from ayse_id), 120000), 'e1000000-0000-4000-8000-000000000001') as r;
grant select on c1 to authenticated;
create temp table sp as select (r ->> 'split_id')::uuid as id from c1;
grant select on sp to authenticated;
select is(
	public.create_split(pg_temp.split_input((select id from ayse_id), 120000), 'e1000000-0000-4000-8000-000000000001') ->> 'split_id',
	(select r ->> 'split_id' from c1), 'aynı anahtar: tek hesap'
);
create temp table g0 as select public.get_split((select id from sp)) as r;
grant select on g0 to authenticated;
select is((select jsonb_array_length(r -> 'members') from g0), 3, 'üç kişi');
select is((select r -> 'members' -> 0 ->> 'state' from g0), 'payer', 'ödeyen');
select is((select r -> 'members' -> 1 ->> 'state' from g0), 'invited', 'Ayşe davet edildi');
select is((select r -> 'members' -> 2 ->> 'state' from g0), 'open', 'Can linkle katılacak');
select is((select (r ->> 'collected_minor')::bigint from g0), 120000::bigint, 'toplanan: ödeyenin payı');
select ok((select r ->> 'join_code' from g0) ~ '^[2-9A-HJ-NP-Z]{3}-[2-9A-HJ-NP-Z]{4}$', 'katılma kodu');
create temp table ag_ayse as select (r -> 'members' -> 1 ->> 'agreement_id')::uuid as id from g0;
grant select on ag_ayse to authenticated;
select is(
	(select principal_minor from public.agreements where id = (select id from ag_ayse)), 120000::bigint,
	'Ayşe’nin payı tek ödemeli borç'
);
select is((select creator_role::text from public.agreements where id = (select id from ag_ayse)), 'creditor', 'ödeyen alacaklı');
create temp table code as select r ->> 'join_code' as c from g0;
grant select on code to authenticated;
create temp table can_seat as select (r -> 'members' -> 2 ->> 'id')::uuid as id from g0;
grant select on can_seat to authenticated;

-- Strangers see nothing; the link shows the open seats ----------------------------------------------------------
select pg_temp.act_as('44444444-4444-4444-8444-444444444444');
select throws_ok(format($$ select public.get_split(%L) $$, (select id from sp)), 'P0001', 'not_found', 'yabancı göremez');
select throws_ok(format($$ select public.remind_split_member(%L) $$, (select id from can_seat)), 'P0001', 'not_found',
	'yabancı hatırlatamaz');
select is(public.get_split_invite('XXX-0000') ->> 'status', 'not_found', 'yanlış kod');

select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
create temp table inv as select public.get_split_invite(lower((select c from code))) as r;
select is((select r ->> 'status' from inv), 'open', 'davet açık');
select is((select jsonb_array_length(r -> 'seats') from inv), 1, 'yalnızca boş yer görünür');
select is((select r ->> 'owner_name' from inv), 'Deniz', 'kim ekledi');
select throws_ok(
	format($$ select public.request_split_join(%L, %L, 'link') $$, (select c from code), (select id from ag_ayse)),
	'P0001', 'not_found', 'başka bir şey talep edilemez'
);
select is(
	public.request_split_join((select c from code), (select id from can_seat), 'link') ->> 'replayed', 'false',
	'Can katılmak istedi'
);
select is(public.get_split_invite((select c from code)) ->> 'status', 'member', 'artık üye');
select is(public.get_split((select id from sp)) -> 'members' -> 2 ->> 'state', 'requested', 'onay bekliyor');
select is(public.get_split((select id from sp)) ->> 'join_code', null, 'kod yalnızca ödeyene');
select throws_ok(format($$ select public.decide_split_join(%L, 'approve') $$, (select id from can_seat)), 'P0001',
	'forbidden', 'kendi katılımını onaylayamaz');

select pg_temp.act_as('44444444-4444-4444-8444-444444444444');
select throws_ok(
	format($$ select public.request_split_join(%L, %L, 'qr') $$, (select c from code), (select id from can_seat)),
	'P0001', 'invalid_transition', 'dolu yer alınamaz'
);

-- The payer approves; Can accepts and reports the payment -------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
create temp table d1 as select public.decide_split_join((select id from can_seat), 'approve') as r;
grant select on d1 to authenticated;
select is((select r -> 'members' -> 2 ->> 'state' from d1), 'invited', 'Can’a pay gönderildi');
create temp table ag_can as select (r -> 'members' -> 2 ->> 'agreement_id')::uuid as id from d1;
grant select on ag_can to authenticated;
select throws_ok(format($$ select public.decide_split_join(%L, 'approve') $$, (select id from can_seat)), 'P0001',
	'invalid_transition', 'ikinci kez onaylanmaz');
select is(public.remind_split_member((select id from can_seat)) ->> 'status', 'sent', 'hatırlatıldı');
select throws_ok(format($$ select public.remind_split_member(%L) $$, (select id from can_seat)), 'P0001',
	'rate_limited', 'günde bir hatırlatma');
reset role;
select is((select template from public.notification_outbox where user_id = '33333333-3333-4333-8333-333333333333'
	order by id desc limit 1), 'splitReminder', 'Can’a bildirim');
select is((select category from public.notifications where user_id = '33333333-3333-4333-8333-333333333333'
	and template = 'splitReminder'), 'reminder', 'hatırlatmalar arasında');

create temp table hash as select terms_hash from public.agreement_versions where agreement_id = (select id from ag_can) and version = 1;
grant select on hash to authenticated;
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select is(
	public.decide_agreement((select id from ag_can), 1, (select terms_hash from hash), 'accept', null) ->> 'status',
	'active', 'Can payını kabul etti'
);
select is(public.get_split((select id from sp)) -> 'members' -> 2 ->> 'state', 'accepted', 'kabul edildi');
select is(public.split_for_agreement((select id from ag_can)) ->> 'split_id', (select id::text from sp), 'kayıttan hesaba');
select is(public.get_split((select id from sp)) -> 'members' -> 1 ->> 'agreement_id', null, 'başkasının kaydı görünmez');
create temp table rv as select row_version from public.agreements where id = (select id from ag_can);
grant select on rv to authenticated;
select public.record_payment((select id from ag_can),
	'{"amount_minor": 120000, "paid_on": "2026-10-30", "method": "cash", "note": null}'::jsonb, (select row_version from rv),
	'e1000000-0000-4000-8000-000000000002');
create temp table g1 as select public.get_split((select id from sp)) as r;
grant select on g1 to authenticated;
select is((select r -> 'members' -> 2 ->> 'state' from g1), 'reported', 'ödeme bildirildi');

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
create temp table g2 as select public.get_split((select id from sp)) as r;
grant select on g2 to authenticated;
select ok((select r -> 'members' -> 2 -> 'reported_payment' ->> 'id' from g2) is not null, 'ödeyen bildirimi görür');
select public.decide_payment(((select r -> 'members' -> 2 -> 'reported_payment' ->> 'id' from g2))::uuid, 'confirm');
create temp table g3 as select public.get_split((select id from sp)) as r;
select is((select r -> 'members' -> 2 ->> 'state' from g3), 'paid', 'Aldım, onayla: ödendi');
select is((select (r ->> 'collected_minor')::bigint from g3), 240000::bigint, 'toplanan arttı');
select ok(
	(select r -> 'events' from g3) @> '[{"type": "payment_confirmed", "name": "Can Özdemir"}]'
		and (select r -> 'events' from g3) @> '[{"type": "join_requested", "via": "link"}]',
	'hareketler'
);
select is(jsonb_array_length(public.list_splits()), 1, 'listede');

-- Erasure keeps the split for the others -----------------------------------------------------------------------
reset role;
select public.delete_account_data('33333333-3333-4333-8333-333333333333');
select is((select display_name from public.split_members where id = (select id from can_seat)), 'Silinmiş kullanıcı',
	'silinen üyenin adı kalkar');

select * from finish();
rollback;
