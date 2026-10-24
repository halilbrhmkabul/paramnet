-- ADR-051: the notification inbox and the before-due reminder preference.
begin;
select plan(34);

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

select has_table('public', 'notifications', 'notifications tablosu');
select ok(not has_table_privilege('authenticated', 'public.notifications', 'select'), 'tablo istemciye kapalı; okuma RPC ile');
select ok(not has_function_privilege('anon', 'public.list_notifications(text, bigint, int)', 'execute'), 'anon okuyamaz');
select ok(not has_function_privilege('anon', 'public.mark_notifications_read(bigint[])', 'execute'), 'anon işaretleyemez');
select ok(not has_function_privilege('anon', 'public.set_reminder_prefs(int[])', 'execute'), 'anon tercih yazamaz');

-- Every queued push lands in the inbox, with a category --------------------------------------------------
select private.notify('11111111-1111-4111-8111-111111111111', t, jsonb_build_object('agreement_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'name', 'Bora', 'amount_minor', 100))
from unnest(array['shareReceived', 'paymentReported', 'dueSoon', 'overdue7', 'paymentConfirmed', 'settled', 'shareRejected', 'inviteExpired']) t;
select private.notify('22222222-2222-4222-8222-222222222222', 'dueToday', '{"agreement_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}'::jsonb);
select results_eq(
	$$ select template, category from public.notifications where user_id = '11111111-1111-4111-8111-111111111111' order by id $$,
	$$ values ('shareReceived', 'approval'), ('paymentReported', 'approval'), ('dueSoon', 'reminder'), ('overdue7', 'reminder'),
		('paymentConfirmed', 'completed'), ('settled', 'completed'), ('shareRejected', 'info'), ('inviteExpired', 'info') $$,
	'şablona göre kategori'
);
select is(
	(select count(*)::int from public.notifications where agreement_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
	9, 'anlaşma kimliği yükten alınır'
);
select is(
	(select count(*)::int from public.notifications n join public.notification_outbox o
		on o.user_id = n.user_id and o.template = n.template and o.payload = n.payload),
	9, 'kutudaki kayıt, gönderilen push ile aynı içerik'
);
select is(
	(select category from public.notifications where template = 'dueToday'),
	'reminder', 'vade günü bir hatırlatmadır'
);

-- Reading ----------------------------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
create temp table l1 as select public.list_notifications(null, null, 50) as r;
select is(jsonb_array_length((select r -> 'items' from l1)), 8, 'yalnızca kendi bildirimleri');
select is((select (r ->> 'unread_count')::int from l1), 8, 'okunmamış sayısı');
select is((select (r ->> 'approval_count')::int from l1), 0, 'onay bekleyen sayısı canlı veriden (bekleyen karar yok)');
select is(
	(select array_agg(k order by k) from jsonb_object_keys((select r -> 'items' -> 0 from l1)) k),
	array['agreement_id', 'category', 'created_at', 'id', 'payload', 'read_at', 'template'],
	'satır alanları'
);
select is((select r -> 'items' -> 0 ->> 'template' from l1), 'inviteExpired', 'yeniden eskiye');
select is(
	jsonb_array_length(public.list_notifications('reminder', null, 50) -> 'items'), 2, 'kategori filtresi'
);
select is(
	jsonb_array_length(public.list_notifications(null, null, 3) -> 'items'), 3, 'sayfa boyutu'
);
select is(
	jsonb_array_length(public.list_notifications(null, (select (r -> 'items' -> 2 ->> 'id')::bigint from l1), 50) -> 'items'),
	5, 'imleç: verilen kimlikten eskiler (aynı anda yazılanlar atlanmaz)'
);
select throws_ok($$ select public.list_notifications('spam', null, 50) $$, 'P0001', 'validation_error', 'bilinmeyen kategori');
select throws_ok($$ select public.list_notifications(null, null, 101) $$, 'P0001', 'validation_error', 'sayfa en fazla 100');

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is(jsonb_array_length(public.list_notifications(null, null, 50) -> 'items'), 1, 'Bora yalnızca kendininkini görür');
create temp table bora_id as select (public.list_notifications(null, null, 50) -> 'items' -> 0 ->> 'id')::bigint as id;
grant select on bora_id to authenticated;

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(public.mark_notifications_read(array[(select id from bora_id)]), '{"marked": 0}'::jsonb, 'başkasınınkini işaretleyemez');
select is(
	public.mark_notifications_read(array[(select (r -> 'items' -> 0 ->> 'id')::bigint from l1)]),
	'{"marked": 1}'::jsonb, 'tek bildirim okundu'
);
select is((public.list_notifications(null, null, 50) ->> 'unread_count')::int, 7, 'okunmamış azaldı');
select is(public.mark_notifications_read(null), '{"marked": 7}'::jsonb, 'tümünü okundu işaretle');
select is((public.list_notifications(null, null, 50) ->> 'unread_count')::int, 0, 'okunmamış kalmadı');

-- Retention --------------------------------------------------------------------------------------------
reset role;
select is(private.purge_notifications(now() + interval '89 days'), 0, '90 günden yeni kayıtlar kalır');
select is(private.purge_notifications(now() + interval '91 days'), 9, '90 günü geçen kayıtlar silinir');

-- Before-due reminder preference -----------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select throws_ok($$ select public.set_reminder_prefs(array[5]) $$, 'P0001', 'validation_error', 'yalnızca 7, 3, 1 ve 0');
select throws_ok($$ select public.set_reminder_prefs(null) $$, 'P0001', 'validation_error', 'null olmaz');
select is(public.set_reminder_prefs(array[0, 7, 7]), '{"reminder_before_days": [7, 0]}'::jsonb, 'tekrarsız, büyükten küçüğe');

create temp table ag as select (public.create_agreement($j${
	"kind": "loan", "creator_role": "debtor", "title": "Borç", "description": null, "started_on": null,
	"counterparty": {"contact": {"display_name": "Can", "phone_e164": null, "kind": "person"}},
	"terms": {"principal_minor": 400000, "down_payment_minor": 0, "notes": null,
		"plan": [{"seq": 1, "due_date": "2026-11-10", "amount_minor": 400000}]}
}$j$::jsonb, gen_random_uuid()) ->> 'agreement_id')::uuid as id;
reset role;
delete from public.notification_outbox;
create function pg_temp.run(local_ts text) returns int language sql as $$
	select private.enqueue_due_reminders((local_ts || '+03')::timestamptz);
$$;
select is(pg_temp.run('2026-11-03 10:00') + pg_temp.run('2026-11-07 10:00') + pg_temp.run('2026-11-09 10:00'), 1, 'seçilen: 7 gün önce; 3 ve 1 gün önce gitmez');
select is(pg_temp.run('2026-11-10 10:00'), 1, 'vade günü seçili');
select is(pg_temp.run('2026-11-11 10:00'), 1, 'vade sonrası hatırlatma tercihten bağımsız');
select is(
	(select array_agg(template order by id) from public.notification_outbox),
	array['dueSoon', 'dueToday', 'overdue1'], 'şablonlar'
);

select * from finish();
rollback;
