begin;
select plan(61);

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

-- Ayşe (alacaklı) – Bora: iki aktif anlaşma. "ag": 300.000, Ayşe 100.000 aldı. "ag2": 200.000.
create function pg_temp.shared(p_name text, p_principal bigint) returns void language plpgsql as $$
declare
	v_id uuid;
begin
	perform pg_temp.act_as('11111111-1111-4111-8111-111111111111');
	v_id := (public.create_agreement(jsonb_build_object(
		'kind', 'loan', 'creator_role', 'creditor', 'title', p_name, 'description', null, 'started_on', null,
		'counterparty', jsonb_build_object('contact', jsonb_build_object('display_name', 'Bora', 'phone_e164', null, 'kind', 'person')),
		'terms', jsonb_build_object('principal_minor', p_principal, 'down_payment_minor', 0, 'notes', null, 'plan', jsonb_build_array(
			jsonb_build_object('seq', 1, 'due_date', '2026-11-10', 'amount_minor', p_principal / 2),
			jsonb_build_object('seq', 2, 'due_date', '2026-12-10', 'amount_minor', p_principal / 2)))
	), gen_random_uuid()) ->> 'agreement_id')::uuid;
	insert into t values (p_name, v_id::text);
	perform public.share_agreement(v_id, '+905550000002', 1);
	perform pg_temp.act_as('22222222-2222-4222-8222-222222222222');
	perform public.decide_agreement(v_id, 1, public.get_pending_decision(v_id) ->> 'terms_hash', 'accept', null);
end;
$$;
select pg_temp.shared('ag', 300000);
select pg_temp.shared('ag2', 200000);
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
insert into t select 'payment', public.record_payment((select value::uuid from t where name = 'ag'),
	'{"amount_minor": 100000, "paid_on": "2026-10-11", "method": "cash", "note": null}', 3, gen_random_uuid()) ->> 'payment_id';
reset role;
delete from public.notification_outbox;

create function pg_temp.id(p_name text) returns uuid language sql as $$
	select value::uuid from t where name = p_name;
$$;
create function pg_temp.ag(p_name text) returns public.agreements language sql security definer as $$
	select * from public.agreements where id = (select value::uuid from t where name = p_name);
$$;
create function pg_temp.rv(p_name text) returns int language sql security definer as $$
	select row_version from public.agreements where id = (select value::uuid from t where name = p_name);
$$;

select ok(not has_function_privilege('anon', 'public.open_dispute(uuid, text, uuid, int)', 'execute'), 'anon itiraz açamaz');
select ok(not has_function_privilege('anon', 'public.forgive_remaining(uuid, bigint, int, uuid)', 'execute'), 'anon bağışlayamaz');

-- İtiraz -----------------------------------------------------------------------------------------------
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select throws_ok(
	format($$ select public.open_dispute(%L, 'Yanlış', null, %s) $$, pg_temp.id('ag'), pg_temp.rv('ag')),
	'P0001', 'not_found', 'yabancı itiraz açamaz'
);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok(
	format($$ select public.open_dispute(%L, '  ', null, %s) $$, pg_temp.id('ag'), pg_temp.rv('ag')),
	'P0001', 'validation_error', 'gerekçe zorunlu'
);
select throws_ok(
	format($$ select public.open_dispute(%L, 'Yanlış', gen_random_uuid(), %s) $$, pg_temp.id('ag'), pg_temp.rv('ag')),
	'P0001', 'validation_error', 'ödeme bu anlaşmaya ait olmalı'
);
select throws_ok(
	format($$ select public.open_dispute(%L, 'Yanlış', null, %s) $$, pg_temp.id('ag'), pg_temp.rv('ag') - 1),
	'P0001', 'conflict', 'eski row_version'
);
select is(
	public.open_dispute(pg_temp.id('ag'), '100.000 değil 150.000 verdim', pg_temp.id('payment'), pg_temp.rv('ag')),
	'{"status": "disputed"}'::jsonb,
	'borçlu bir ödemeye itiraz eder'
);
reset role;
select is((pg_temp.ag('ag')).status::text, 'disputed', 'anlaşma itirazlı');
select results_eq(
	$$ select opened_by, payment_id, reason, status from public.disputes where agreement_id = pg_temp.id('ag') $$,
	$$ values ('22222222-2222-4222-8222-222222222222'::uuid, pg_temp.id('payment'), '100.000 değil 150.000 verdim', 'open') $$,
	'itiraz kaydı açık'
);
select results_eq(
	$$ select type, actor_id from public.agreement_events where agreement_id = pg_temp.id('ag') order by id desc limit 1 $$,
	$$ values ('dispute_opened', '22222222-2222-4222-8222-222222222222'::uuid) $$,
	'dispute_opened olayı'
);
select results_eq(
	$$ select user_id, template, payload ->> 'name' from public.notification_outbox $$,
	$$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'disputeOpened', 'Bora') $$,
	'alacaklıya bildirim'
);

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok(
	format($$ select public.open_dispute(%L, 'Yine', null, %s) $$, pg_temp.id('ag'), pg_temp.rv('ag')),
	'P0001', 'invalid_transition', 'açık itiraz varken ikinci itiraz yok'
);
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select throws_ok(
	format($$ select public.record_payment(%L, '{"amount_minor": 1000, "paid_on": "2026-10-11", "method": "cash", "note": null}', %s, gen_random_uuid()) $$,
		pg_temp.id('ag'), pg_temp.rv('ag')),
	'P0001', 'invalid_transition', 'itirazlı anlaşmaya ödeme yok (BR-14)'
);
select throws_ok(
	format($$ select public.forgive_remaining(%L, null, %s, gen_random_uuid()) $$, pg_temp.id('ag'), pg_temp.rv('ag')),
	'P0001', 'invalid_transition', 'itirazlı anlaşmada bağış yok (BR-14)'
);
select is(
	(public.get_agreement_detail(pg_temp.id('ag')) -> 'dispute') - 'opened_at',
	jsonb_build_object('by_me', false, 'reason', '100.000 değil 150.000 verdim', 'payment_id', pg_temp.id('payment')),
	'alacaklı itirazı görür'
);
select is(
	(select r - 'principal_minor' from jsonb_array_elements(public.list_requests()) as r where r ->> 'kind' = 'dispute'),
	jsonb_build_object('agreement_id', pg_temp.id('ag'), 'kind', 'dispute', 'title', 'ag', 'from_name', 'Bora',
		'my_role', 'creditor', 'reason', '100.000 değil 150.000 verdim'),
	'alacaklının taleplerinde itiraz'
);
select throws_ok(
	format($$ select public.resolve_dispute(%L) $$, pg_temp.id('ag')),
	'P0001', 'forbidden', 'itirazı yalnızca açan geri çeker'
);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is(public.get_agreement_detail(pg_temp.id('ag')) -> 'dispute' ->> 'by_me', 'true', 'açan kendi itirazını görür');
select is(
	(select count(*)::int from jsonb_array_elements(public.list_requests()) as r where r ->> 'kind' = 'dispute'),
	0,
	'açanın taleplerinde kendi itirazı yok'
);
reset role;
delete from public.notification_outbox;
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is(public.resolve_dispute(pg_temp.id('ag')), '{"status": "active"}'::jsonb, 'açan itirazı geri çeker');
reset role;
select is((pg_temp.ag('ag')).status::text, 'active', 'anlaşma yeniden aktif');
select results_eq(
	$$ select status, resolved_at is not null from public.disputes where agreement_id = pg_temp.id('ag') $$,
	$$ values ('resolved', true) $$,
	'itiraz çözüldü'
);
select results_eq(
	$$ select type from public.agreement_events where agreement_id = pg_temp.id('ag') order by id desc limit 1 $$,
	$$ values ('dispute_resolved') $$,
	'dispute_resolved olayı'
);
select results_eq(
	$$ select user_id, template from public.notification_outbox $$,
	$$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'disputeResolved') $$,
	'alacaklıya çözüm bildirimi'
);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok(
	format($$ select public.resolve_dispute(%L) $$, pg_temp.id('ag')),
	'P0001', 'invalid_transition', 'açık itiraz yokken geri çekme yok'
);

-- İtiraz değişiklikle çözülür: alacaklı itiraz eder, borçlu öneri yapar, alacaklı kabul eder.
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.open_dispute(pg_temp.id('ag'), 'Plan tutmuyor', null, pg_temp.rv('ag'));
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select public.propose_amendment(pg_temp.id('ag'), '{"principal_minor": 300000, "down_payment_minor": 0, "notes": null, "plan": [
	{"seq": 1, "due_date": "2026-11-10", "amount_minor": 150000},
	{"seq": 2, "due_date": "2027-01-10", "amount_minor": 150000}]}'::jsonb, null, pg_temp.rv('ag'));
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.decide_amendment(pg_temp.id('ag'), 2,
	public.get_pending_decision(pg_temp.id('ag')) ->> 'terms_hash', 'accept');
reset role;
select is((pg_temp.ag('ag')).status::text, 'active', 'değişiklik kabulü itirazı bitirir');
select results_eq(
	$$ select status from public.disputes where agreement_id = pg_temp.id('ag') and reason = 'Plan tutmuyor' $$,
	$$ values ('amended') $$,
	'itiraz değişiklikle kapandı'
);
select ok(
	(select count(*) from public.disputes where agreement_id = pg_temp.id('ag') and status = 'open') = 0,
	'açık itiraz kalmadı'
);

-- Karşılıklı iptal --------------------------------------------------------------------------------------
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select throws_ok(
	format($$ select public.request_cancel(%L, %s) $$, pg_temp.id('ag'), pg_temp.rv('ag')),
	'P0001', 'not_found', 'yabancı iptal isteyemez'
);
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select throws_ok(
	format($$ select public.request_cancel(%L, %s) $$, pg_temp.id('ag'), pg_temp.rv('ag') - 1),
	'P0001', 'conflict', 'iptalde eski row_version'
);
reset role;
delete from public.notification_outbox;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(public.request_cancel(pg_temp.id('ag'), pg_temp.rv('ag')), '{"status": "active"}'::jsonb, 'alacaklı iptal ister');
reset role;
select is((pg_temp.ag('ag')).cancel_requested_by, '11111111-1111-4111-8111-111111111111'::uuid, 'talep kaydedildi');
select results_eq(
	$$ select user_id, template from public.notification_outbox $$,
	$$ values ('22222222-2222-4222-8222-222222222222'::uuid, 'cancelRequested') $$,
	'borçluya iptal talebi bildirimi'
);
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select throws_ok(
	format($$ select public.request_cancel(%L, %s) $$, pg_temp.id('ag'), pg_temp.rv('ag')),
	'P0001', 'invalid_transition', 'açık talep varken ikinci talep yok'
);
select throws_ok(
	format($$ select public.decide_cancel(%L, 'accept') $$, pg_temp.id('ag')),
	'P0001', 'forbidden', 'isteyen kendi talebine karar veremez'
);
select is(public.get_agreement_detail(pg_temp.id('ag')) -> 'cancel_request' ->> 'by_me', 'true', 'isteyen bekleyen talebini görür');
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok(
	format($$ select public.decide_cancel(%L, 'maybe') $$, pg_temp.id('ag')),
	'P0001', 'validation_error', 'karar accept veya reject'
);
select is(
	(select r ->> 'from_name' from jsonb_array_elements(public.list_requests()) as r where r ->> 'kind' = 'cancel'),
	'Ayşe',
	'borçlunun taleplerinde iptal'
);
select is(public.decide_cancel(pg_temp.id('ag'), 'reject'), '{"status": "active", "replayed": false}'::jsonb, 'borçlu iptali reddeder');
reset role;
select ok((pg_temp.ag('ag')).cancel_requested_by is null, 'talep kapandı');
select results_eq(
	$$ select type from public.agreement_events where agreement_id = pg_temp.id('ag') order by id desc limit 1 $$,
	$$ values ('cancel_rejected') $$,
	'cancel_rejected olayı'
);

-- İtirazlı anlaşmada iptal: kabul itirazı da kapatır.
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select public.open_dispute(pg_temp.id('ag'), 'Anlaşamıyoruz', null, pg_temp.rv('ag'));
select is(public.request_cancel(pg_temp.id('ag'), pg_temp.rv('ag')), '{"status": "disputed"}'::jsonb, 'itirazlıyken iptal istenebilir');
reset role;
delete from public.notification_outbox;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(public.decide_cancel(pg_temp.id('ag'), 'accept'), '{"status": "cancelled", "replayed": false}'::jsonb, 'alacaklı iptali kabul eder');
select is(public.decide_cancel(pg_temp.id('ag'), 'accept'), '{"status": "cancelled", "replayed": true}'::jsonb, 'tekrar eden kabul ilk sonucu döner');
reset role;
select results_eq(
	$$ select status::text, cancelled_at is not null, cancel_requested_by is null, pending_version is null from pg_temp.ag('ag') $$,
	$$ values ('cancelled', true, true, true) $$,
	'anlaşma iptal edildi'
);
select results_eq(
	$$ select status from public.disputes where agreement_id = pg_temp.id('ag') and reason = 'Anlaşamıyoruz' $$,
	$$ values ('closed') $$,
	'iptal açık itirazı kapatır'
);
select results_eq(
	$$ select type from public.agreement_events where agreement_id = pg_temp.id('ag') order by id desc limit 2 $$,
	$$ values ('cancelled'), ('cancel_accepted') $$,
	'cancel_accepted ve cancelled olayları'
);
select results_eq(
	$$ select user_id, template from public.notification_outbox $$,
	$$ values ('22222222-2222-4222-8222-222222222222'::uuid, 'cancelAccepted') $$,
	'isteyene kabul bildirimi'
);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok(
	format($$ select public.open_dispute(%L, 'Geç', null, %s) $$, pg_temp.id('ag'), pg_temp.rv('ag')),
	'P0001', 'invalid_transition', 'iptal edilmiş anlaşmaya itiraz yok'
);

-- Bağış / indirim ---------------------------------------------------------------------------------------
select throws_ok(
	format($$ select public.forgive_remaining(%L, null, %s, gen_random_uuid()) $$, pg_temp.id('ag2'), pg_temp.rv('ag2')),
	'P0001', 'forbidden', 'borçlu bağışlayamaz'
);
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select throws_ok(
	format($$ select public.forgive_remaining(%L, null, %s, null) $$, pg_temp.id('ag2'), pg_temp.rv('ag2')),
	'P0001', 'validation_error', 'idempotency anahtarı zorunlu'
);
select throws_ok(
	format($$ select public.forgive_remaining(%L, 0, %s, gen_random_uuid()) $$, pg_temp.id('ag2'), pg_temp.rv('ag2')),
	'P0001', 'validation_error', 'tutar sıfırdan büyük'
);
select throws_ok(
	format($$ select public.forgive_remaining(%L, 200001, %s, gen_random_uuid()) $$, pg_temp.id('ag2'), pg_temp.rv('ag2')),
	'P0001', 'amount_exceeds_outstanding', 'kalandan fazlası bağışlanamaz'
);
reset role;
delete from public.notification_outbox;
insert into t values ('key', gen_random_uuid()::text);
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(
	public.forgive_remaining(pg_temp.id('ag2'), 50000, pg_temp.rv('ag2'), pg_temp.id('key')) - 'payment_id',
	'{"replayed": false, "settled": false}'::jsonb,
	'alacaklı 50.000 indirim yapar'
);
select is(
	public.forgive_remaining(pg_temp.id('ag2'), 50000, pg_temp.rv('ag2') - 1, pg_temp.id('key')) - 'payment_id',
	'{"replayed": true, "settled": false}'::jsonb,
	'aynı anahtar tek kayıt'
);
reset role;
select results_eq(
	$$ select kind::text, status::text, amount_minor, reported_by from public.payments where agreement_id = pg_temp.id('ag2') $$,
	$$ values ('discount', 'confirmed', 50000::bigint, '11111111-1111-4111-8111-111111111111'::uuid) $$,
	'indirim onaylı discount ödemesi'
);
select is((pg_temp.ag('ag2')).outstanding_minor, 150000::bigint, 'kalan 150.000');
select results_eq(
	$$ select user_id, template, (payload ->> 'amount_minor')::bigint, (payload ->> 'remaining_minor')::bigint from public.notification_outbox $$,
	$$ values ('22222222-2222-4222-8222-222222222222'::uuid, 'forgiven', 50000::bigint, 150000::bigint) $$,
	'borçluya bilgi (onay gerekmez)'
);
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(
	public.forgive_remaining(pg_temp.id('ag2'), null, pg_temp.rv('ag2'), gen_random_uuid()) - 'payment_id',
	'{"replayed": false, "settled": true}'::jsonb,
	'kalanın tamamı bağışlanır'
);
reset role;
select results_eq(
	$$ select status::text, outstanding_minor from pg_temp.ag('ag2') $$,
	$$ values ('settled', 0::bigint) $$,
	'anlaşma kapandı'
);
select results_eq(
	$$ select type from public.agreement_events where agreement_id = pg_temp.id('ag2') order by id desc limit 2 $$,
	$$ values ('settled'), ('forgiven') $$,
	'forgiven ve settled olayları'
);

select * from finish();
rollback;
