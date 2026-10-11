begin;
select plan(34);

-- Ayşe shares with +905550000002; the invitee has no account and answers on the web.
insert into auth.users (id, phone, aud, role) values
	('11111111-1111-4111-8111-111111111111', '905550000001', 'authenticated', 'authenticated');
insert into public.profiles (id, display_name, phone_e164) values
	('11111111-1111-4111-8111-111111111111', 'Ayşe', '+905550000001');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
	select set_config('role', 'authenticated', true),
		set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create temp table t (name text primary key, value text);
grant all on t to authenticated, service_role;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
insert into t select 'ag', public.create_agreement($j${
	"kind": "loan", "creator_role": "creditor", "title": "Borç", "description": null, "started_on": null,
	"counterparty": {"contact": {"display_name": "Bora", "phone_e164": null, "kind": "person"}},
	"terms": {"principal_minor": 120000, "down_payment_minor": 0, "notes": "Elden",
		"plan": [{"seq": 1, "due_date": "2026-11-10", "amount_minor": 120000}]}
}$j$::jsonb, gen_random_uuid()) ->> 'agreement_id';
insert into t select 'token', public.share_agreement((select value::uuid from t where name = 'ag'), '+905550000002', 1) ->> 'token';
reset role;

-- Yalnızca servis rolü --------------------------------------------------------------------------------
select ok(not has_function_privilege('authenticated', 'public.invite_open(text)', 'execute'), 'invite_open istemciye kapalı');
select ok(not has_function_privilege('anon', 'public.invite_send_otp(text, text, text, text)', 'execute'), 'anon OTP isteyemez');
select ok(has_function_privilege('service_role', 'public.invite_decide(uuid, text, int, text, text, jsonb, text, text)', 'execute'), 'servis rolü karar iletebilir');

set local role service_role;

-- invite_open: OTP öncesi yalnızca ad (spec 5.4), durum değişmez (GET güvenli) ---------------------------
select is(public.invite_open((select value from t where name = 'token')), '{"status": "active", "creator_name": "Ayşe"}'::jsonb, 'yalnızca oluşturanın adı');
select is(public.invite_open('yanlis-token'), '{"status": "invalid"}'::jsonb, 'bilinmeyen token');
select is(public.invite_open((select value from t where name = 'token')) ->> 'status', 'active', 'açmak daveti tüketmez');

-- OTP gönderimi -------------------------------------------------------------------------------------------
select is(
	public.invite_send_otp((select value from t where name = 'token'), '0555 000 00 03', '654321', 'ip1'),
	'{"send": false}'::jsonb,
	'yanlış numaraya kod gitmez (cevap aynı biçimde, numara sızmaz)'
);
select is(
	public.invite_send_otp((select value from t where name = 'token'), '+905550000002', '654321', 'ip1'),
	'{"send": true, "phone": "+905550000002"}'::jsonb,
	'hedef numaraya kod'
);
select throws_ok(
	$$ select public.invite_send_otp((select value from t where name = 'token'), '+905550000002', '111111', 'ip1') $$,
	'P0001', 'rate_limited', '60 saniye dolmadan yeniden gönderim yok'
);
select throws_ok(
	$$ select public.invite_send_otp((select value from t where name = 'token'), '+15551234567', '111111', 'ip1') $$,
	'P0001', 'invalid_phone', 'yalnızca +90'
);
reset role;
select ok((select otp_hash is not null and otp_hash <> convert_to('654321', 'UTF8') from public.invites), 'kod yalnızca hash olarak');
set local role service_role;

-- OTP doğrulama --------------------------------------------------------------------------------------------
-- Failures return a result instead of raising, so the attempt counter is committed (a raised error
-- would roll it back and the lock would never trigger).
select is(
	public.invite_verify_otp((select value from t where name = 'token'), '+905550000003', '654321'),
	'{"ok": false, "error": "otp_invalid"}'::jsonb,
	'yanlış numarayla doğru kod da geçmez'
);
select is(
	public.invite_verify_otp((select value from t where name = 'token'), '+905550000002', '000000'),
	'{"ok": false, "error": "otp_invalid"}'::jsonb,
	'yanlış kod'
);
create temp table verified as select public.invite_verify_otp((select value from t where name = 'token'), '+905550000002', '654321') as v;
reset role;
grant select on verified to service_role;
select is((select v ->> 'phone' from verified), '+905550000002', 'doğrulandı');
select is((select (v ->> 'invite_id')::uuid from verified), (select id from public.invites), 'davet kimliği');
select is((select otp_hash from public.invites), null, 'kod tek kullanımlık');
set local role service_role;

-- Ayrıntılar (W03): karşı tarafın bakış açısından ------------------------------------------------------------
create temp table details as select public.invite_details((select (v ->> 'invite_id')::uuid from verified)) as d;
reset role;
grant select on details to service_role;
select is((select d ->> 'creator_name' from details), 'Ayşe', 'oluşturan');
select is((select d ->> 'my_role' from details), 'debtor', 'davetli borçlu');
select is((select (d ->> 'principal_minor')::bigint from details), 120000::bigint, 'tutar');
select is((select d ->> 'notes' from details), 'Elden', 'not doğrulamadan sonra');
select is(
	(select d ->> 'terms_hash' from details),
	(select terms_hash from public.agreement_versions where version = 1),
	'onaylanacak hash'
);
select is((select jsonb_array_length(d -> 'plan') from details), 1, 'plan');
set local role service_role;

-- Karar (web kanalı) ----------------------------------------------------------------------------------------
select throws_ok(
	$$ select public.invite_decide((select (v ->> 'invite_id')::uuid from verified), '+905550000003', 1,
		(select d ->> 'terms_hash' from details), 'accept', null, 'iphash', 'Safari') $$,
	'P0001', 'forbidden', 'oturumdaki numara davetinkiyle aynı olmalı'
);
select throws_ok(
	$$ select public.invite_decide((select (v ->> 'invite_id')::uuid from verified), '+905550000002', 1, repeat('0', 64), 'accept', null, 'iphash', 'Safari') $$,
	'P0001', 'conflict', 'değişmiş içerik onaylanamaz'
);
select is(
	public.invite_decide((select (v ->> 'invite_id')::uuid from verified), '+905550000002', 1,
		(select d ->> 'terms_hash' from details), 'accept', null, 'iphash', 'Safari'),
	'{"status": "active", "version": 1}'::jsonb,
	'web onayı'
);
reset role;
select results_eq(
	$$ select status::text, counterparty_profile_id from public.agreements $$,
	$$ values ('active', null::uuid) $$,
	'aktif; hesabı olmayan davetli henüz bağlanmaz (F2-10)'
);
select results_eq(
	$$ select type, actor_id, actor_phone_e164::text, channel::text, ip_hash, user_agent from public.agreement_events order by id desc limit 1 $$,
	$$ values ('accepted', null::uuid, '+905550000002', 'web', 'iphash', 'Safari') $$,
	'kanıt bilgisiyle web olayı'
);
select is((select status::text from public.invites), 'consumed', 'davet tüketildi');
set local role service_role;
select is(public.invite_open((select value from t where name = 'token')), '{"status": "consumed", "creator_name": "Ayşe"}'::jsonb, 'tüketilen davet');
select throws_ok(
	$$ select public.invite_send_otp((select value from t where name = 'token'), '+905550000002', '222222', 'ip2') $$,
	'P0001', 'invite_unavailable', 'tüketilen davet için kod yok'
);
reset role;

-- 5 yanlış denemede kilit ----------------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
insert into t select 'ag2', public.create_agreement($j${
	"kind": "loan", "creator_role": "creditor", "title": "İkinci", "description": null, "started_on": null,
	"counterparty": {"contact": {"display_name": "Cem", "phone_e164": null, "kind": "person"}},
	"terms": {"principal_minor": 1000, "down_payment_minor": 0, "notes": null,
		"plan": [{"seq": 1, "due_date": null, "amount_minor": 1000}]}
}$j$::jsonb, gen_random_uuid()) ->> 'agreement_id';
insert into t select 'token2', public.share_agreement((select value::uuid from t where name = 'ag2'), '+905550000003', 1) ->> 'token';
reset role;
set local role service_role;
select public.invite_send_otp((select value from t where name = 'token2'), '+905550000003', '777777', 'ip3');
create function pg_temp.wrong() returns text language sql as $$
	select public.invite_verify_otp((select value from t where name = 'token2'), '+905550000003', '000000') ->> 'error';
$$;
select is(array[pg_temp.wrong(), pg_temp.wrong(), pg_temp.wrong(), pg_temp.wrong()], array['otp_invalid', 'otp_invalid', 'otp_invalid', 'otp_invalid'], '4 yanlış deneme');
select is(pg_temp.wrong(), 'locked', '5. yanlış denemede kilit');
select is(
	public.invite_verify_otp((select value from t where name = 'token2'), '+905550000003', '777777'),
	'{"ok": false, "error": "invite_unavailable"}'::jsonb,
	'kilitli davette doğru kod da geçmez'
);
select is(public.invite_open((select value from t where name = 'token2')) ->> 'status', 'locked', 'davet locked');

select * from finish();
rollback;
