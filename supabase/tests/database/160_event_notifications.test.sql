begin;
select plan(17);

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

-- Ayşe (alacaklı) bir plan oluşturur; telefon verilirse paylaşır. Rehberde karşı taraf "<ad> kişi"; aynı numara ilk kayıttaki adla birleşir.
create function pg_temp.agreement(p_name text, p_phone text) returns uuid language plpgsql as $$
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
	if p_phone is not null then
		perform public.share_agreement(v_id, p_phone, 1);
	end if;
	reset role;
	return v_id;
end;
$$;
create function pg_temp.id(p_name text) returns uuid language sql as $$
	select value::uuid from t where name = p_name;
$$;
create function pg_temp.hash(p_name text) returns text language sql security definer as $$
	select terms_hash from public.agreement_versions v join public.agreements a on a.id = v.agreement_id
	where a.id = pg_temp.id(p_name) and v.version = coalesce(a.pending_version, a.active_version);
$$;
create function pg_temp.version(p_name text) returns int language sql security definer as $$
	select coalesce(pending_version, active_version) from public.agreements where id = pg_temp.id(p_name);
$$;
create function pg_temp.outbox() returns table (user_id uuid, template text, name text, amount bigint) language sql security definer as $$
	select user_id, template, payload ->> 'name', (payload ->> 'amount_minor')::bigint from public.notification_outbox order by id;
$$;
create function pg_temp.clear() returns void language sql security definer as $$
	delete from public.notification_outbox;
$$;

-- Paylaşım hesabı olan numaraya gider.
select pg_temp.agreement('plan', '+905550000002');
select results_eq(
	$$ select * from pg_temp.outbox() $$,
	$$ values ('22222222-2222-4222-8222-222222222222'::uuid, 'shareReceived', 'Ayşe', 100000::bigint) $$,
	'paylaşılan kişiye bildirim (shareReceived)'
);

select pg_temp.clear();
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select public.decide_agreement(pg_temp.id('plan'), 1, pg_temp.hash('plan'), 'counter', '{"principal_minor": 100000, "down_payment_minor": 0, "notes": null, "plan": [
	{"seq": 1, "due_date": "2026-12-10", "amount_minor": 100000}]}'::jsonb);
select results_eq(
	$$ select * from pg_temp.outbox() $$,
	$$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'shareCountered', 'plan kişi', 100000::bigint) $$,
	'oluşturana düzeltme bildirimi (rehberdeki adla)'
);

select pg_temp.clear();
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.decide_counter(pg_temp.id('plan'), pg_temp.version('plan'), pg_temp.hash('plan'), 'accept', null);
select results_eq(
	$$ select * from pg_temp.outbox() $$,
	$$ values ('22222222-2222-4222-8222-222222222222'::uuid, 'counterAccepted', 'Ayşe', 100000::bigint) $$,
	'düzeltme önerene kabul bildirimi'
);

-- Alacaklı kalanın tamamını kaydeder: iki tarafa tebrik.
select pg_temp.clear();
select public.record_payment(pg_temp.id('plan'), '{"amount_minor": 100000, "paid_on": "2026-10-11", "method": "cash", "note": null}',
	(select row_version from public.agreements where id = pg_temp.id('plan')), gen_random_uuid());
reset role;
select results_eq(
	$$ select user_id, template, name from pg_temp.outbox() where template = 'settled' order by user_id $$,
	$$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'settled', 'plan kişi'),
		('22222222-2222-4222-8222-222222222222'::uuid, 'settled', 'Ayşe') $$,
	'kapanışta iki tarafa tebrik'
);

-- Red.
select pg_temp.agreement('red', '+905550000002');
select pg_temp.clear();
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select public.decide_agreement(pg_temp.id('red'), 1, pg_temp.hash('red'), 'reject', null);
reset role;
select results_eq(
	$$ select user_id, template, name from pg_temp.outbox() $$,
	$$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'shareRejected', 'plan kişi') $$,
	'oluşturana "bana ait değil" bildirimi'
);

-- Uygulamada onay.
select pg_temp.agreement('onay', '+905550000002');
select pg_temp.clear();
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select public.decide_agreement(pg_temp.id('onay'), 1, pg_temp.hash('onay'), 'accept', null);
reset role;
select results_eq(
	$$ select user_id, template, name from pg_temp.outbox() $$,
	$$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'shareAccepted', 'plan kişi') $$,
	'oluşturana onay bildirimi'
);

-- Paylaşımı geri çekme.
select pg_temp.agreement('geri', '+905550000002');
select pg_temp.clear();
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.withdraw_share(pg_temp.id('geri'));
reset role;
select results_eq(
	$$ select user_id, template, name from pg_temp.outbox() $$,
	$$ values ('22222222-2222-4222-8222-222222222222'::uuid, 'shareWithdrawn', 'Ayşe') $$,
	'paylaşılan kişiye geri çekme bildirimi'
);

-- Hesabı olmayan numara: paylaşımda bildirim yok; web onayı oluşturana gider.
select pg_temp.clear();
select pg_temp.agreement('web', '+905550000004');
select is((select count(*)::int from pg_temp.outbox()), 0, 'hesabı olmayan numaraya push yok');
select private.apply_decision(
	(select a from public.agreements a where id = pg_temp.id('web')),
	(select id from public.invites where agreement_id = pg_temp.id('web') and status = 'active'),
	null, '+905550000004', null, 'web', 1, pg_temp.hash('web'), 'accept', null, null, null
);
select results_eq(
	$$ select user_id, template, name from pg_temp.outbox() $$,
	$$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'shareAccepted', 'web kişi') $$,
	'web''de onay oluşturana bildirilir'
);

-- Süresi dolan davet.
select pg_temp.agreement('sure', '+905550000005');
select pg_temp.clear();
select private.expire_invites(now() + interval '8 days');
select results_eq(
	$$ select user_id, template, name from pg_temp.outbox() $$,
	$$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'inviteExpired', 'sure kişi') $$,
	'oluşturana süre doldu bildirimi'
);

-- Kişisel kayıt kapanınca kimseye push gitmez.
select pg_temp.agreement('kisisel', null);
select pg_temp.clear();
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.record_payment(pg_temp.id('kisisel'), '{"amount_minor": 100000, "paid_on": "2026-10-11", "method": "cash", "note": null}', 1, gen_random_uuid());
reset role;
select is((select count(*)::int from pg_temp.outbox()), 0, 'kişisel kapanışta bildirim yok');

-- 7 gündür onay bekleyen ödeme ------------------------------------------------------------------------
select pg_temp.agreement('bekleyen', '+905550000002');
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select public.decide_agreement(pg_temp.id('bekleyen'), 1, pg_temp.hash('bekleyen'), 'accept', null);
insert into t select 'old', public.record_payment(pg_temp.id('bekleyen'), '{"amount_minor": 30000, "paid_on": "2026-10-01", "method": "cash", "note": null}',
	(select row_version from public.agreements where id = pg_temp.id('bekleyen')), gen_random_uuid()) ->> 'payment_id';
insert into t select 'new', public.record_payment(pg_temp.id('bekleyen'), '{"amount_minor": 20000, "paid_on": "2026-10-01", "method": "cash", "note": null}',
	(select row_version from public.agreements where id = pg_temp.id('bekleyen')), gen_random_uuid()) ->> 'payment_id';
reset role;
-- Bugün 10:30 (İstanbul); eski bildirim tam 7 gün önce, yenisi 3 gün önce.
insert into t values ('now', (((now() at time zone 'Europe/Istanbul')::date + time '10:30') at time zone 'Europe/Istanbul')::text);
update public.payments set created_at = (select value::timestamptz from t where name = 'now') - interval '7 days' where id = pg_temp.id('old');
update public.payments set created_at = (select value::timestamptz from t where name = 'now') - interval '3 days' where id = pg_temp.id('new');
select pg_temp.clear();

select is(
	private.enqueue_payment_reminders((select value::timestamptz from t where name = 'now') + interval '12 hours'),
	0,
	'sessiz saatlerde hatırlatma yok'
);
select is(private.enqueue_payment_reminders((select value::timestamptz from t where name = 'now')), 1, '7 günlük bildirim için bir hatırlatma');
select results_eq(
	$$ select * from pg_temp.outbox() $$,
	$$ values ('11111111-1111-4111-8111-111111111111'::uuid, 'paymentPending', 'plan kişi', 30000::bigint) $$,
	'alacaklıya bekleyen ödeme hatırlatması'
);
select is(private.enqueue_payment_reminders((select value::timestamptz from t where name = 'now') + interval '15 minutes'), 0, 'aynı ödeme için bir kez');

-- Onaylanmış ödeme için hatırlatma gitmez.
update public.payments set created_at = (select value::timestamptz from t where name = 'now') - interval '7 days' where id = pg_temp.id('new');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.decide_payment(pg_temp.id('new'), 'confirm');
reset role;
select is(private.enqueue_payment_reminders((select value::timestamptz from t where name = 'now')), 0, 'onaylanan ödeme hatırlatılmaz');

select ok(
	exists (select 1 from cron.job where jobname = 'enqueue-payment-reminders'),
	'pg_cron işi tanımlı'
);

select * from finish();
rollback;
