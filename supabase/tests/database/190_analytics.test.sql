begin;
select plan(24);

-- Spec 13: kendi olay tablomuz + mevcut tablolardan metrikler (ADR-038).
insert into auth.users (id, phone, aud, role) values
	('11111111-1111-4111-8111-111111111111', '905550000001', 'authenticated', 'authenticated'),
	('22222222-2222-4222-8222-222222222222', '905550000002', 'authenticated', 'authenticated'),
	('33333333-3333-4333-8333-333333333333', '905550000003', 'authenticated', 'authenticated');
-- Ayşe 20 gün, Bora 10 gün, Cem 2 gün önce kaydoldu.
insert into public.profiles (id, display_name, phone_e164, created_at) values
	('11111111-1111-4111-8111-111111111111', 'Ayşe', '+905550000001', now() - interval '20 days'),
	('22222222-2222-4222-8222-222222222222', 'Bora', '+905550000002', now() - interval '10 days'),
	('33333333-3333-4333-8333-333333333333', 'Cem', '+905550000003', now() - interval '2 days');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
	select set_config('role', 'authenticated', true),
		set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create temp table t (name text primary key, value text);
grant all on t to authenticated;

create function pg_temp.create(p_name text, p_rows int) returns uuid language plpgsql as $$
declare
	v_id uuid;
begin
	v_id := (public.create_agreement(jsonb_build_object(
		'kind', 'loan', 'creator_role', 'creditor', 'title', p_name, 'description', null, 'started_on', null,
		'counterparty', jsonb_build_object('contact', jsonb_build_object('display_name', 'Bora', 'phone_e164', '+905550000002', 'kind', 'person')),
		'terms', jsonb_build_object('principal_minor', 30000, 'down_payment_minor', 0, 'notes', null, 'plan',
			(select jsonb_agg(jsonb_build_object('seq', s, 'due_date', '2026-11-10'::date + (s - 1) * 30, 'amount_minor', 30000 / p_rows))
				from generate_series(1, p_rows) as s)
		)), gen_random_uuid()) ->> 'agreement_id')::uuid;
	insert into t values (p_name, v_id::text);
	return v_id;
end;
$$;
create function pg_temp.id(p_name text) returns uuid language sql as $$
	select value::uuid from t where name = p_name;
$$;
create function pg_temp.rv(p_name text) returns int language sql security definer as $$
	select row_version from public.agreements where id = pg_temp.id(p_name);
$$;

-- Olay kaydı (istemci) -----------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.track_event(text, jsonb)', 'execute'), 'anon olay yazamaz');
select ok(not has_table_privilege('authenticated', 'public.analytics_events', 'select'), 'istemci olayları okuyamaz');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(public.track_event('app_opened', '{}'), '{"tracked": true}'::jsonb, 'uygulama açılışı kaydedilir');
select is(public.track_event('reminder_opened', '{"template": "dueToday"}'), '{"tracked": true}'::jsonb, 'bildirim açılışı');
select is(public.track_event('invite_opened', '{"channel": "app"}'), '{"tracked": true}'::jsonb, 'uygulamada davet açılışı');
select throws_ok($$ select public.track_event('agreement_created', '{}') $$, 'P0001', 'validation_error', 'sunucunun bildiği olay istemciden gelmez');
select throws_ok($$ select public.track_event('app_opened', '{"phone": "+905551234567"}') $$, 'P0001', 'validation_error', 'tanımsız alan yok (kişisel veri sızmaz)');
select throws_ok($$ select public.track_event('invite_opened', '{"channel": "web"}') $$, 'P0001', 'validation_error', 'web kanalı yalnızca sunucudan');
select throws_ok($$ select public.track_event('reminder_opened', '{"template": "<script>"}') $$, 'P0001', 'validation_error', 'şablon adı biçimi');
-- Saatte 60 olaydan fazlası sessizce düşer (uygulamayı bozmadan).
select is(
	(select count(*)::int from generate_series(1, 60) as s where public.track_event('app_opened', '{}') ->> 'tracked' = 'true'),
	57,
	'saatlik sınır'
);
select is(public.track_event('app_opened', '{}'), '{"tracked": false}'::jsonb, 'sınır aşılınca kayıt yok, hata yok');
reset role;
select is(
	(select array_agg(distinct user_id) from public.analytics_events),
	array['11111111-1111-4111-8111-111111111111'::uuid],
	'olay kullanıcıya bağlı (takma adlı kimlik)'
);

-- Web: davet açılışı davet başına bir kez, OTP doğrulaması. Cem hesabı olmayan bir numarayla paylaşır.
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select pg_temp.create('web', 1);
insert into t select 'token', public.share_agreement(pg_temp.id('web'), '+905550000004', 1) ->> 'token';
reset role;
select public.invite_open((select value from t where name = 'token'));
select public.invite_open((select value from t where name = 'token'));
select is(
	(select count(*)::int from public.analytics_events where name = 'invite_opened' and props ->> 'channel' = 'web'),
	1,
	'web davet açılışı bir kez (önizleme botları sayacı şişirmez)'
);
select is((select status::text from public.invites where agreement_id = pg_temp.id('web')), 'active', 'davet tüketilmedi');
update public.invites set otp_hash = sha256(convert_to(id::text || ':123456', 'UTF8')), otp_expires_at = now() + interval '5 minutes'
where agreement_id = pg_temp.id('web');
select public.invite_verify_otp((select value from t where name = 'token'), '+905550000004', '123456');
select is((select count(*)::int from public.analytics_events where name = 'invite_otp_verified'), 1, 'OTP doğrulaması kaydedildi');

-- Metrikler --------------------------------------------------------------------------------------------
-- Cem: "web" (paylaşıldı, yanıt yok). Ayşe: "plan" (3 taksit) Bora'yla paylaşıldı ve onaylandı; "tek" (1 taksit) kişisel, kapandı; sonra "ikinci".
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select pg_temp.create('plan', 3);
select public.share_agreement(pg_temp.id('plan'), '+905550000002', 1);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select public.decide_agreement(pg_temp.id('plan'), 1, public.get_pending_decision(pg_temp.id('plan')) ->> 'terms_hash', 'accept', null);
insert into t select 'p1', public.record_payment(pg_temp.id('plan'), '{"amount_minor": 10000, "paid_on": "2026-10-11", "method": "cash", "note": null}', pg_temp.rv('plan'), gen_random_uuid()) ->> 'payment_id';
insert into t select 'p2', public.record_payment(pg_temp.id('plan'), '{"amount_minor": 10000, "paid_on": "2026-10-11", "method": "cash", "note": null}', pg_temp.rv('plan'), gen_random_uuid()) ->> 'payment_id';
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.decide_payment(pg_temp.id('p1'), 'confirm');
select public.decide_payment(pg_temp.id('p2'), 'reject');
select pg_temp.create('tek', 1);
select public.record_payment(pg_temp.id('tek'), '{"amount_minor": 30000, "paid_on": "2026-10-11", "method": "cash", "note": null}', 1, gen_random_uuid());
reset role;
-- "ikinci" kapanıştan sonra oluşturuldu (aynı transaction'da saat ilerlemediği için tarihi elle ileri).
update public.agreements set created_at = now() - interval '30 minutes' where id in (pg_temp.id('plan'), pg_temp.id('tek'));
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select pg_temp.create('ikinci', 1);
reset role;
update public.agreements set created_at = now() + interval '1 minute' where id = pg_temp.id('ikinci');
-- Ayşe kaydından 8 gün sonra uygulamayı açtı (D7 aktif); Bora 1 gün sonra.
insert into public.analytics_events (name, user_id, props, created_at) values
	('app_opened', '11111111-1111-4111-8111-111111111111', '{}', now() - interval '12 days'),
	('app_opened', '22222222-2222-4222-8222-222222222222', '{}', now() - interval '9 days');

select ok(not has_function_privilege('authenticated', 'public.get_metrics(int)', 'execute'), 'metrikler yalnızca servis rolüne açık');
select is(
	public.get_metrics(30) - 'median_first_agreement_seconds' - 'window_days' - 'generated_at',
	jsonb_build_object(
		'signups', 3,
		'activation_rate', 0.67,
		'agreements_created', 4,
		'installment_rate', 0.25,
		'share_rate', 0.50,
		'invite_acceptance_rate', 0.50,
		'web_acceptance_share', 0.00,
		'verified_payment_rate', 0.50,
		'repeat_rate', 1.00,
		'weekly_active_agreements', 2,
		'd7_retention', 1.00,
		'd30_retention', null,
		'reminders_sent', 0,
		'reminders_opened', 1,
		'invites_opened_web', 1,
		'invites_opened_app', 1
	),
	'spec 13.1–13.2 metrikleri'
);
select is((public.get_metrics(30) ->> 'median_first_agreement_seconds')::numeric between 172800 and 1728000, true, 'kayıttan ilk anlaşmaya süre (medyan)');
select is((public.get_metrics(30) ->> 'window_days')::int, 30, 'pencere');
select is((public.get_metrics(1) ->> 'signups')::int, 0, 'pencere dışındaki kayıtlar sayılmaz');
select is(public.get_metrics(0) ->> 'activation_rate', null, 'boş pencerede oran yok (sıfıra bölme yok)');
select throws_ok($$ select public.get_metrics(400) $$, 'P0001', 'validation_error', 'pencere 0–365 gün');

-- Hesap silinince olaylar anonimleşir (F3-03 için hazır).
select is(
	(select confdeltype::text from pg_constraint where conname = 'analytics_events_user_id_fkey'),
	'n',
	'kullanıcı silinince user_id boşalır'
);
select has_index('public', 'analytics_events', 'analytics_events_name_created_at_idx', 'metrik sorguları için indeks');

select * from finish();
rollback;
