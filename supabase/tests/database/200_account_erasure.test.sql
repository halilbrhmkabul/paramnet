begin;
select plan(25);

-- F3-03: hesap silme ve veri dışa aktarma (spec 12 "Silme hakkı", 16/10, security.md, ADR-039).
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

create function pg_temp.create(p_name text, p_contact text, p_phone text) returns uuid language plpgsql as $$
declare
	v_id uuid;
begin
	v_id := (public.create_agreement(jsonb_build_object(
		'kind', 'loan', 'creator_role', 'creditor', 'title', p_name, 'description', null, 'started_on', null,
		'counterparty', jsonb_build_object('contact', jsonb_build_object('display_name', p_contact, 'phone_e164', p_phone, 'kind', 'person')),
		'terms', jsonb_build_object('principal_minor', 100000, 'down_payment_minor', 0, 'notes', null, 'plan', jsonb_build_array(
			jsonb_build_object('seq', 1, 'due_date', '2026-11-10', 'amount_minor', 50000),
			jsonb_build_object('seq', 2, 'due_date', '2026-12-10', 'amount_minor', 50000)))
	), gen_random_uuid()) ->> 'agreement_id')::uuid;
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

-- Ayşe (alacaklı) – Bora: paylaşılmış, aktif. Bora notlu bir ödeme bildirir, gerekçeli değişiklik önerir, itiraz eder.
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select pg_temp.create('ortak', 'Bora', '+905550000002');
select public.share_agreement(pg_temp.id('ortak'), '+905550000002', 1);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select public.decide_agreement(pg_temp.id('ortak'), 1, public.get_pending_decision(pg_temp.id('ortak')) ->> 'terms_hash', 'accept', null);
insert into t select 'payment', public.record_payment(pg_temp.id('ortak'),
	'{"amount_minor": 20000, "paid_on": "2026-10-11", "method": "cash", "note": "Elden verdim, Kadıköy"}', pg_temp.rv('ortak'), gen_random_uuid()) ->> 'payment_id';
select public.propose_amendment(pg_temp.id('ortak'), '{"principal_minor": 100000, "down_payment_minor": 0, "notes": null, "plan": [
	{"seq": 1, "due_date": "2026-11-10", "amount_minor": 50000}, {"seq": 2, "due_date": "2027-01-10", "amount_minor": 50000}]}'::jsonb,
	'Maaşım geç yatıyor', pg_temp.rv('ortak'));
select public.open_dispute(pg_temp.id('ortak'), 'Tutar yanlış girildi', null, pg_temp.rv('ortak'));
-- Bora'nın yalnızca kendisine ait kişisel kaydı ve rehberi.
select pg_temp.create('kisisel', 'Annem', '+905550000009');
select public.track_event('app_opened', '{}');
select public.register_push_token('ExponentPushToken[bora]', 'ios');
-- Cem, Bora'nın numarasına bir plan paylaştı (henüz yanıtlanmadı).
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select pg_temp.create('cem', 'Bora', '+905550000002');
select public.share_agreement(pg_temp.id('cem'), '+905550000002', 1);
reset role;
insert into public.consents (user_id, document, version) values ('22222222-2222-4222-8222-222222222222', 'kvkk', '2026-10');
insert into public.notification_outbox (user_id, template, payload) values ('22222222-2222-4222-8222-222222222222', 'dueToday', '{}');
-- Web'deki kararın kanıtı (numara, IP, cihaz) Bora'ya ait.
insert into public.agreement_events (agreement_id, actor_id, actor_phone_e164, channel, type, ip_hash, user_agent)
values (pg_temp.id('ortak'), null, '+905550000002', 'web', 'accepted', 'iphash', 'Mozilla/5.0');
insert into t select 'ayse_events', count(*)::text from public.agreement_events where actor_id = '11111111-1111-4111-8111-111111111111';

-- Dışa aktarma -----------------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.export_my_data()', 'execute'), 'anon dışa aktaramaz');
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
insert into t select 'export', public.export_my_data()::text;
reset role;
select is((select value::jsonb -> 'profile' ->> 'phone_e164' from t where name = 'export'), '+905550000002', 'profil dışa aktarılır');
select is((select jsonb_array_length(value::jsonb -> 'agreements') from t where name = 'export'), 2, 'taraf olduğu anlaşmalar (kendi kaydı + paylaşılan)');
select ok((select value::jsonb -> 'contacts' @> '[{"display_name": "Annem"}]' from t where name = 'export'), 'rehberi');
select is((select jsonb_array_length(value::jsonb -> 'consents') from t where name = 'export'), 1, 'onayları');
select ok((select value::jsonb ? 'exported_at' from t where name = 'export'), 'dışa aktarma zamanı');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(jsonb_array_length(public.export_my_data() -> 'agreements'), 1, 'başkasının kişisel kaydı dışa aktarılmaz');
reset role;

-- Hesap silme ------------------------------------------------------------------------------------------
select ok(not has_function_privilege('authenticated', 'public.delete_account_data(uuid)', 'execute'), 'silme yalnızca servis rolüyle (edge function)');
select is(
	public.delete_account_data('22222222-2222-4222-8222-222222222222'),
	'{"deleted_agreements": 1, "kept_agreements": 1, "avatar_path": null}'::jsonb,
	'kendi kaydı silinir, ortak anlaşma korunur'
);
select results_eq(
	$$ select display_name, phone_e164::text, deleted_at is not null from public.profiles where id = '22222222-2222-4222-8222-222222222222' $$,
	$$ values ('Silinmiş kullanıcı', null::text, true) $$,
	'profil anonimleşti'
);
select is((select count(*)::int from public.agreements where id = pg_temp.id('kisisel')), 0, 'yalnızca kendisine ait anlaşma silindi');
select is((select count(*)::int from public.contacts where owner_id = '22222222-2222-4222-8222-222222222222'), 0, 'rehberi silindi');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(
	public.get_agreement_detail(pg_temp.id('ortak')) -> 'counterparty' ->> 'display_name',
	'Bora',
	'Ayşe kendi rehberindeki adla görmeye devam eder'
);
reset role;
select is((select linked_profile_id from public.contacts where owner_id = '11111111-1111-4111-8111-111111111111' and phone_e164 = '+905550000002'), null, 'Ayşe''nin kişisi artık silinen hesaba bağlı değil');
select results_eq(
	$$ select note, amount_minor from public.payments where id = pg_temp.id('payment') $$,
	$$ values (null::text, 20000::bigint) $$,
	'Bora''nın notu silindi, ödeme kaydı korundu'
);
select is((select reason from public.agreement_versions where agreement_id = pg_temp.id('ortak') and version = 2), null, 'önerideki gerekçe silindi');
select is((select reason from public.disputes where agreement_id = pg_temp.id('ortak')), '—', 'itiraz gerekçesi silindi');
select is(
	(select count(*)::int from public.agreement_events where agreement_id = pg_temp.id('ortak')
		and (actor_phone_e164 is not null or ip_hash is not null or user_agent is not null)),
	0,
	'olay kaydında numara, IP ve cihaz izi kalmadı'
);
select is(
	(select count(*)::text from public.agreement_events where actor_id = '11111111-1111-4111-8111-111111111111'),
	(select value from t where name = 'ayse_events'),
	'karşı tarafın olay kaydı korundu'
);
select is(
	(select count(*)::int from public.push_tokens where user_id = '22222222-2222-4222-8222-222222222222')
	+ (select count(*)::int from public.consents where user_id = '22222222-2222-4222-8222-222222222222')
	+ (select count(*)::int from public.notification_outbox where user_id = '22222222-2222-4222-8222-222222222222')
	+ (select count(*)::int from public.rate_limits where key like '%22222222-2222-4222-8222-222222222222%'),
	0,
	'push token, onay, bildirim kuyruğu ve sayaçlar silindi'
);
select is((select count(*)::int from public.analytics_events where user_id = '22222222-2222-4222-8222-222222222222'), 0, 'analitik olaylar anonimleşti');
select is((select status::text from public.agreements where id = pg_temp.id('cem')), 'pending', 'başkasının numaraya paylaşımı değişmedi');
select throws_ok(
	$$ delete from public.agreement_events where agreement_id = (select value::uuid from t where name = 'ortak') $$,
	'P0001', null, 'silme dışında olay kaydı yine yalnızca eklenir'
);
select is(
	public.delete_account_data('22222222-2222-4222-8222-222222222222'),
	'{"deleted_agreements": 0, "kept_agreements": 1, "avatar_path": null}'::jsonb,
	'tekrar çağrı güvenli'
);
select throws_ok($$ select public.delete_account_data(gen_random_uuid()) $$, 'P0001', 'not_found', 'olmayan hesap');

select * from finish();
rollback;
