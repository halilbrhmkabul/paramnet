begin;
select plan(32);

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

select has_table('public', 'invites', 'invites tablosu');
select ok(not has_table_privilege('authenticated', 'public.invites', 'select'), 'davetler istemciye kapalı');
select ok(not has_function_privilege('anon', 'public.share_agreement(uuid, text, int)', 'execute'), 'anon paylaşamaz');

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
create temp table ag as select (public.create_agreement($j${
	"kind": "loan", "creator_role": "creditor", "title": "Borç", "description": null, "started_on": null,
	"counterparty": {"contact": {"display_name": "Bora", "phone_e164": null, "kind": "person"}},
	"terms": {"principal_minor": 100000, "down_payment_minor": 0, "notes": null,
		"plan": [{"seq": 1, "due_date": "2026-11-10", "amount_minor": 100000}]}
}$j$::jsonb, gen_random_uuid()) ->> 'agreement_id')::uuid as id;

-- Reddedilen paylaşımlar ------------------------------------------------------------------------------
select throws_ok($$ select public.share_agreement((select id from ag), '+905550000001', 1) $$, 'P0001', 'validation_error', 'kendine paylaşılamaz (BR-12)');
select throws_ok($$ select public.share_agreement((select id from ag), '+15551234567', 1) $$, 'P0001', 'validation_error', 'yalnızca TR cep');
select throws_ok($$ select public.share_agreement((select id from ag), '+905550000002', 7) $$, 'P0001', 'conflict', 'eski row_version');

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok($$ select public.share_agreement((select id from ag), '+905550000002', 1) $$, 'P0001', 'not_found', 'başkası paylaşamaz');

-- Paylaşım ----------------------------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
create temp table shared as select public.share_agreement((select id from ag), '0555 000 00 02', 1) as r;
select matches((select r ->> 'token' from shared), '^[A-Za-z0-9_-]{43}$', 'token 32 bayt base64url (43 karakter)');
select ok((select (r ->> 'expires_at')::timestamptz between now() + interval '7 days' - interval '1 minute' and now() + interval '7 days' + interval '1 minute' from shared), '7 gün geçerli');

reset role;
select is(
	(select token_hash from public.invites),
	(select sha256(convert_to(r ->> 'token', 'UTF8')) from shared),
	'yalnızca sha256(token) saklanır'
);
select is(
	(select count(*)::int from public.invites i, shared s where i::text like '%' || (s.r ->> 'token') || '%'),
	0,
	'düz token hiçbir sütunda yok'
);
select results_eq(
	$$ select target_phone_e164::text, status::text, version, otp_attempts from public.invites $$,
	$$ values ('+905550000002', 'active', 1, 0) $$,
	'davet: hedef numara normalize, aktif, versiyon 1'
);
select results_eq(
	$$ select status::text, pending_version, row_version from public.agreements where id = (select id from ag) $$,
	$$ values ('pending', 1, 2) $$,
	'anlaşma pending, pending_version = mevcut versiyon'
);
select is((select phone_e164::text from public.contacts), '+905550000002', 'numarası olmayan kişiye numara yazıldı');
select is((select linked_profile_id from public.contacts), '22222222-2222-4222-8222-222222222222'::uuid, 'kayıtlı numara profile bağlandı');
select is(
	(select type from public.agreement_events where agreement_id = (select id from ag) order by id desc limit 1),
	'shared',
	'olay kaydı'
);
-- Karşı taraf karar vermeden anlaşmayı göremez (RLS: counterparty_profile_id henüz boş).
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is_empty('select 1 from public.agreements', 'davetli karar vermeden anlaşmayı görmez');

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select throws_ok($$ select public.share_agreement((select id from ag), '+905550000002', 2) $$, 'P0001', 'invalid_transition', 'pending iken yeniden paylaşım yok');
select throws_ok(
	$$ select public.record_payment((select id from ag), '{"amount_minor": 1, "paid_on": "2026-10-11", "method": "cash", "note": null}', 2, gen_random_uuid()) $$,
	'P0001', 'invalid_transition', 'yanıt beklenirken ödeme yok'
);

-- Geri çekme ----------------------------------------------------------------------------------------------
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok($$ select public.withdraw_share((select id from ag)) $$, 'P0001', 'not_found', 'başkası geri çekemez');
select throws_ok(
	$$ select public.record_payment((select id from ag), '{"amount_minor": 1, "paid_on": "2026-10-11", "method": "cash", "note": null}', 2, gen_random_uuid()) $$,
	'P0001', 'not_found', 'yabancı, paylaşılmış ama kabul edilmemiş anlaşmanın varlığını öğrenemez'
);
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(public.withdraw_share((select id from ag)), '{"status": "personal"}'::jsonb, 'geri çekildi');
reset role;
select results_eq(
	$$ select a.status::text, a.pending_version, i.status::text from public.agreements a join public.invites i on i.agreement_id = a.id $$,
	$$ values ('personal', null::int, 'revoked') $$,
	'kişisel moda döndü, davet revoked'
);
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select throws_ok($$ select public.withdraw_share((select id from ag)) $$, 'P0001', 'invalid_transition', 'kişiseldeyken geri çekilecek paylaşım yok');

-- Süre dolumu (7 gün) ---------------------------------------------------------------------------------------
create temp table second as select public.share_agreement((select id from ag), '+905550000002', (select row_version from public.agreements where id = (select id from ag))) as r;
reset role;
select is(private.expire_invites(now() + interval '6 days'), 0, 'süresi dolmadan bir şey olmaz');
select is(private.expire_invites(now() + interval '8 days'), 1, 'süresi dolan davet');
select results_eq(
	$$ select a.status::text, a.pending_version from public.agreements a where a.id = (select id from ag) $$,
	$$ values ('personal', null::int) $$,
	'anlaşma kişisel moda döndü'
);
select is(
	(select status::text from public.invites where status <> 'revoked'),
	'expired',
	'davet expired'
);
select results_eq(
	$$ select type, actor_id, channel::text from public.agreement_events where agreement_id = (select id from ag) order by id desc limit 1 $$,
	$$ values ('invite_expired', null::uuid, 'system') $$,
	'sistem olayı'
);
select is((select count(*)::int from cron.job where jobname = 'expire-invites'), 1, 'expire-invites cron işi');

-- Kapanmış anlaşma paylaşılamaz.
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select lives_ok(
	$$ select public.record_payment((select id from ag), '{"amount_minor": 100000, "paid_on": "2026-10-11", "method": "cash", "note": null}',
		(select row_version from public.agreements where id = (select id from ag)), gen_random_uuid()) $$,
	'kalanın tamamı ödendi'
);
select throws_ok(
	$$ select public.share_agreement((select id from ag), '+905550000002', (select row_version from public.agreements where id = (select id from ag))) $$,
	'P0001', 'invalid_transition', 'kapanmış anlaşma paylaşılamaz'
);

select * from finish();
rollback;
