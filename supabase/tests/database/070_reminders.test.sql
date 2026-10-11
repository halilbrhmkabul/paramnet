begin;
select plan(29);

-- Ayşe (borçlu) Yıldız Mobilya'dan taksitle aldı: 2. taksit 10 Kasım 2026.
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

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
create temp table ag as select (public.create_agreement($j${
	"kind": "installment_purchase", "creator_role": "debtor", "title": "Mobilya", "description": null, "started_on": null,
	"counterparty": {"contact": {"display_name": "Yıldız Mobilya", "phone_e164": null, "kind": "merchant"}},
	"terms": {"principal_minor": 800000, "down_payment_minor": 0, "notes": null, "plan": [
		{"seq": 1, "due_date": "2026-10-10", "amount_minor": 400000},
		{"seq": 2, "due_date": "2026-11-10", "amount_minor": 400000}
	]}
}$j$::jsonb, gen_random_uuid()) ->> 'agreement_id')::uuid as id;

-- Push token kaydı -------------------------------------------------------------------------------------
select is(public.register_push_token('ExponentPushToken[abc]', 'ios'), '{"registered": true}'::jsonb, 'token kaydedildi');
select throws_ok($$ select public.register_push_token('not-a-token', 'ios') $$, 'P0001', 'validation_error', 'geçersiz token');
select throws_ok($$ select public.register_push_token('ExponentPushToken[x]', 'web') $$, 'P0001', 'validation_error', 'geçersiz platform');
-- Aynı cihaz başka hesapla giriş yaparsa token yeni hesaba geçer.
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select lives_ok($$ select public.register_push_token('ExponentPushToken[abc]', 'ios') $$, 'token yeni kullanıcıya geçer');
reset role;
select is((select user_id from public.push_tokens where expo_token = 'ExponentPushToken[abc]'), '22222222-2222-4222-8222-222222222222'::uuid, 'token sahibi güncellendi');
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is(public.unregister_push_token('ExponentPushToken[abc]'), '{"removed": true}'::jsonb, 'çıkışta token silinir');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select lives_ok($$ select public.register_push_token('ExponentPushToken[ayse]', 'android') $$, 'Ayşe token');
reset role;

-- Hatırlatma zamanlaması (spec 5.9) -------------------------------------------------------------------
create function pg_temp.run(local_ts text) returns int language sql as $$
	select private.enqueue_due_reminders((local_ts || '+03')::timestamptz);
$$;
create function pg_temp.kinds() returns text[] language sql as $$
	select coalesce(array_agg(template order by id), '{}') from public.notification_outbox;
$$;

select is(pg_temp.run('2026-11-07 09:59'), 0, 'vadeden 3 gün önce 10:00 öncesi bir şey yok');
select is(pg_temp.run('2026-11-07 10:00'), 1, '3 gün önce 10:00: borçluya');
select is(pg_temp.kinds(), array['dueSoon'], 'dueSoon');
select is(pg_temp.run('2026-11-07 15:00'), 0, 'aynı hatırlatma tekrar gitmez');
select is(pg_temp.run('2026-11-10 23:00'), 0, 'sessiz saatlerde (22:00–09:00) kuyruğa girmez');
select is(pg_temp.run('2026-11-10 10:15'), 1, 'vade günü 10:00');
select is(
	(select payload from public.notification_outbox where template = 'dueToday'),
	jsonb_build_object('agreement_id', (select id from ag), 'name', 'Yıldız Mobilya', 'amount_minor', 400000,
		'due_date', '2026-11-10', 'seq', 2, 'count', 2),
	'şablon değişkenleri (not ve serbest metin yok)'
);
select is(pg_temp.run('2026-11-11 10:00'), 1, 'vade +1 gün, ödenmemişse borçluya');
select is(pg_temp.run('2026-11-18 09:30'), 0, '+7 gün henüz 10:00 olmadı');
select is(pg_temp.run('2026-11-17 10:00'), 1, 'vade +7 gün');
-- 1. taksit (10 Ekim) kayıttan önce geçmişti: eski hatırlatmalar sonradan topluca gönderilmez.
select is(
	(select count(*)::int from public.notification_outbox o where (o.payload ->> 'seq')::int = 1),
	0,
	'günü geçmiş hatırlatmalar sonradan gitmez'
);
select is(pg_temp.kinds(), array['dueSoon', 'dueToday', 'overdue1', 'overdue7'], 'dört hatırlatma sırayla');

-- Ödenen taksit için hatırlatma yok; kapanan anlaşmaya hiç yok.
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select lives_ok(
	$$ select public.record_payment((select id from ag),
		'{"amount_minor": 800000, "paid_on": "2026-10-11", "method": "cash", "note": null}', 1, gen_random_uuid()) $$,
	'tamamı ödendi'
);
reset role;
delete from public.reminders;
select is(pg_temp.run('2026-11-10 10:00'), 0, 'kapanmış anlaşmaya hatırlatma yok');

-- Kuyruk yalnızca servis rolüne açık --------------------------------------------------------------------
select ok(not has_function_privilege('authenticated', 'public.claim_notifications(int)', 'execute'), 'claim istemciye kapalı');
select ok(has_function_privilege('service_role', 'public.claim_notifications(int)', 'execute'), 'claim servis rolüne açık');

set local role service_role;
create temp table claimed as select public.claim_notifications(10) as c;
reset role;
select is((select jsonb_array_length(c) from claimed), 4, 'bekleyenler alındı');
select is(
	(select c -> 0 -> 'tokens' from claimed),
	'["ExponentPushToken[ayse]"]'::jsonb,
	'kullanıcının tokenları ile'
);

set local role service_role;
select is(
	public.finish_notifications(jsonb_build_array(
		jsonb_build_object('id', (select (c -> 0 ->> 'id')::bigint from claimed), 'status', 'sent', 'invalid_tokens', '[]'::jsonb),
		jsonb_build_object('id', (select (c -> 1 ->> 'id')::bigint from claimed), 'status', 'retry', 'invalid_tokens', '["ExponentPushToken[ayse]"]'::jsonb)
	)),
	'{"updated": 2}'::jsonb,
	'sonuçlar işlendi'
);
reset role;
select results_eq(
	$$ select status from public.notification_outbox order by id limit 2 $$,
	$$ values ('sent'), ('pending') $$,
	'gönderilen sent, yeniden denenecek pending kalır'
);
select ok(
	(select next_attempt_at > now() from public.notification_outbox order by id offset 1 limit 1),
	'yeniden deneme ileri bir zamana ertelenir'
);
select is((select count(*)::int from public.push_tokens), 0, 'geçersiz token silindi');

select * from finish();
rollback;
