-- ADR-050: ParamNet ID, lookup, regeneration and sharing by ID.
begin;
select plan(57);

insert into auth.users (id, phone, aud, role) values
	('11111111-1111-4111-8111-111111111111', '905550000001', 'authenticated', 'authenticated'),
	('22222222-2222-4222-8222-222222222222', '905550000002', 'authenticated', 'authenticated'),
	('33333333-3333-4333-8333-333333333333', '905550000003', 'authenticated', 'authenticated'),
	('44444444-4444-4444-8444-444444444444', '905550000004', 'authenticated', 'authenticated');
insert into public.profiles (id, display_name, phone_e164) values
	('11111111-1111-4111-8111-111111111111', 'Ayşe Yılmaz', '+905550000001'),
	('22222222-2222-4222-8222-222222222222', 'Bora Kaya', '+905550000002'),
	('33333333-3333-4333-8333-333333333333', 'Cem Ak', '+905550000003'),
	('44444444-4444-4444-8444-444444444444', 'Dilek Er', '+905550000004');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
	select set_config('role', 'authenticated', true),
		set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.pnid(uid uuid) returns text language sql security definer as $$
	select paramnet_id from public.profiles where id = uid;
$$;
create function pg_temp.new_agreement() returns uuid language sql as $$
	select (public.create_agreement($j${
		"kind": "loan", "creator_role": "creditor", "title": "Borç", "description": null, "started_on": null,
		"counterparty": {"contact": {"display_name": "Bora", "phone_e164": null, "kind": "person"}},
		"terms": {"principal_minor": 100000, "down_payment_minor": 0, "notes": null,
			"plan": [{"seq": 1, "due_date": "2026-11-10", "amount_minor": 100000}]}
	}$j$::jsonb, gen_random_uuid()) ->> 'agreement_id')::uuid;
$$;
grant execute on function pg_temp.pnid(uuid) to authenticated;

-- Assignment ---------------------------------------------------------------------------------------------
select matches(pg_temp.pnid('11111111-1111-4111-8111-111111111111'), '^PN-[2-9A-HJ-NP-Z]{6}$', 'kayıtta ID atanır, biçim PN-XXXXXX');
select is((select count(distinct paramnet_id)::int from public.profiles), 4, 'her hesabın ID''si farklı');
select results_eq(
	$$ select id_discoverable, paramnet_id_changed_at from public.profiles where id = '11111111-1111-4111-8111-111111111111' $$,
	$$ values (true, null::timestamptz) $$,
	'varsayılan: bulunabilir, hiç yenilenmedi'
);
select is(
	(select count(distinct x)::int from (select private.new_paramnet_id() as x from generate_series(1, 500)) s
		where x ~ '^PN-[2-9A-HJ-NP-Z]{6}$'),
	500,
	'üretilen 500 ID biçime uyar ve tekrar etmez'
);
select is(
	(select count(distinct c)::int from (select private.new_paramnet_id() as x from generate_series(1, 500)) s,
		regexp_split_to_table(substr(x, 4), '') as c),
	32,
	'alfabenin 32 karakterinin hepsi kullanılır'
);
select throws_ok(
	$$ update public.profiles set paramnet_id = 'PN-ABC' where id = '11111111-1111-4111-8111-111111111111' $$,
	'23514', null, 'biçim dışı ID saklanamaz'
);
select ok(not has_table_privilege('authenticated', 'public.retired_paramnet_ids', 'select'), 'eski ID listesi istemciye kapalı');
select ok(not has_function_privilege('anon', 'public.find_by_paramnet_id(text)', 'execute'), 'anon arayamaz');
select ok(not has_function_privilege('anon', 'public.share_agreement_by_id(uuid, text, int)', 'execute'), 'anon ID ile paylaşamaz');
select ok(has_function_privilege('authenticated', 'public.find_by_paramnet_id(text)', 'execute'), 'oturumlu kullanıcı arayabilir');

-- Lookup (BR-17) -----------------------------------------------------------------------------------------
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is(
	public.find_by_paramnet_id(lower(substr(pg_temp.pnid('11111111-1111-4111-8111-111111111111'), 4))),
	jsonb_build_object('status', 'found', 'display_name', 'Ayşe Yılmaz', 'paramnet_id', pg_temp.pnid('11111111-1111-4111-8111-111111111111')),
	'önek ve büyük harf olmadan da bulunur; yalnızca ad ve ID döner'
);
select is(public.find_by_paramnet_id(pg_temp.pnid('22222222-2222-4222-8222-222222222222')), '{"status": "self"}'::jsonb, 'kendi ID''si');
select is(public.find_by_paramnet_id('PN-0000'), '{"status": "invalid"}'::jsonb, 'biçim dışı');
select is(public.find_by_paramnet_id('PN-ZZZZZZ'), '{"status": "not_found"}'::jsonb, 'olmayan ID');

reset role;
update public.profiles set id_discoverable = false where id = '33333333-3333-4333-8333-333333333333';
update public.profiles set deleted_at = now(), phone_e164 = null where id = '44444444-4444-4444-8444-444444444444';
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is(public.find_by_paramnet_id(pg_temp.pnid('33333333-3333-4333-8333-333333333333')), '{"status": "not_found"}'::jsonb, 'bulunabilirliği kapalı olan bulunamaz');
select is(public.find_by_paramnet_id(pg_temp.pnid('44444444-4444-4444-8444-444444444444')), '{"status": "not_found"}'::jsonb, 'silinmiş hesap bulunamaz');

-- Six lookups so far; misses count too, so an ID cannot be scanned.
do $$ begin for i in 1..14 loop perform public.find_by_paramnet_id('PN-ZZZZZZ'); end loop; end $$;
select throws_ok(
	$$ select public.find_by_paramnet_id(pg_temp.pnid('11111111-1111-4111-8111-111111111111')) $$,
	'P0001', 'rate_limited', 'saatte 20 aramadan sonrası reddedilir'
);
reset role;
update public.profiles set id_discoverable = true where id = '33333333-3333-4333-8333-333333333333';

-- Visibility switch ----------------------------------------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(public.set_id_discoverable(false), '{"id_discoverable": false}'::jsonb, 'bulunabilirlik kapatılır');
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select is(public.find_by_paramnet_id(pg_temp.pnid('11111111-1111-4111-8111-111111111111')) ->> 'status', 'not_found', 'kapatınca aranamaz');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(public.set_id_discoverable(true), '{"id_discoverable": true}'::jsonb, 'yeniden açılır');

-- Sharing by ID --------------------------------------------------------------------------------------------
create temp table ag as select pg_temp.new_agreement() as id;
grant select on ag to authenticated;
select is(
	public.share_agreement_by_id((select id from ag), pg_temp.pnid('11111111-1111-4111-8111-111111111111'), 1),
	'{"status": "self"}'::jsonb, 'kendine paylaşılamaz (BR-12)'
);
select is(public.share_agreement_by_id((select id from ag), 'PN-ZZZZZZ', 1), '{"status": "not_found"}'::jsonb, 'olmayan ID');
select is(public.share_agreement_by_id((select id from ag), 'PN-1', 1), '{"status": "invalid"}'::jsonb, 'biçim dışı ID');
select throws_ok(
	$$ select public.share_agreement_by_id((select id from ag), pg_temp.pnid('22222222-2222-4222-8222-222222222222'), 9) $$,
	'P0001', 'conflict', 'eski row_version'
);
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok(
	$$ select public.share_agreement_by_id((select id from ag), pg_temp.pnid('33333333-3333-4333-8333-333333333333'), 1) $$,
	'P0001', 'not_found', 'başkasının anlaşması paylaşılamaz'
);

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
create temp table shared as
	select public.share_agreement_by_id((select id from ag), pg_temp.pnid('22222222-2222-4222-8222-222222222222'), 1) as r;
select is((select r ->> 'status' from shared), 'shared', 'paylaşıldı');
select is((select r ->> 'display_name' from shared), 'Bora Kaya', 'paylaşan, kime gittiğini görür');
select ok((select (r ->> 'expires_at')::timestamptz between now() + interval '7 days' - interval '1 minute' and now() + interval '7 days' + interval '1 minute' from shared), '7 gün geçerli');
select ok((select not (r ? 'token') from shared), 'token yok');

reset role;
select results_eq(
	$$ select target_profile_id, target_phone_e164::text, token_hash, status::text from public.invites where agreement_id = (select id from ag) $$,
	$$ values ('22222222-2222-4222-8222-222222222222'::uuid, null::text, null::bytea, 'active') $$,
	'davet hedef profile bağlı; numara ve token yok'
);
select results_eq(
	$$ select status::text, pending_version, row_version from public.agreements where id = (select id from ag) $$,
	$$ values ('pending', 1, 2) $$,
	'anlaşma pending'
);
select is(
	(select type from public.agreement_events where agreement_id = (select id from ag) order by id desc limit 1),
	'shared', 'olay kaydı yazıldı'
);
select is(
	(select template from public.notification_outbox where user_id = '22222222-2222-4222-8222-222222222222' order by id desc limit 1),
	'shareReceived', 'hedef kişiye bildirim gider'
);
select ok(
	not exists (select 1 from public.notification_outbox o where o::text like '%' || pg_temp.pnid('22222222-2222-4222-8222-222222222222') || '%'),
	'bildirimde ID yok'
);

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is(
	(select r ->> 'agreement_id' from jsonb_array_elements(public.list_requests()) r),
	(select id::text from ag), 'hedef kişinin taleplerinde görünür'
);
select is(public.get_pending_decision((select id from ag)) ->> 'actor', 'counterparty', 'hedef kişi karar verebilir');
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select is(jsonb_array_length(public.list_requests()), 0, 'başkasının taleplerinde yok');
select throws_ok(
	$$ select public.decide_agreement((select id from ag), 1, (select terms_hash from public.agreement_versions where agreement_id = (select id from ag) and version = 1), 'accept', null) $$,
	'P0001', 'not_found', 'hedef olmayan karar veremez (BR-11)'
);

-- The target's ID changes while the invite waits: the invite follows the account.
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select ok(public.regenerate_paramnet_id() ? 'paramnet_id', 'hedef kişi ID''sini yeniler');
reset role;
create temp table hash as select terms_hash from public.agreement_versions where agreement_id = (select id from ag) and version = 1;
grant select on hash to authenticated;
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is(
	public.decide_agreement((select id from ag), 1, (select terms_hash from hash), 'accept', null) ->> 'status',
	'active', 'ID değişse de davet geçerli; kabul edildi'
);
reset role;
select results_eq(
	$$ select a.counterparty_profile_id, c.linked_profile_id, c.phone_e164::text, i.status::text
		from public.agreements a join public.contacts c on c.id = a.counterparty_contact_id
		join public.invites i on i.agreement_id = a.id
		where a.id = (select id from ag) $$,
	$$ values ('22222222-2222-4222-8222-222222222222'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, null::text, 'consumed') $$,
	'kabulde kişi hesaba bağlanır, numarası paylaşana açılmaz'
);
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select throws_ok(
	$$ select public.share_agreement_by_id((select id from ag), pg_temp.pnid('33333333-3333-4333-8333-333333333333'), 3) $$,
	'P0001', 'invalid_transition', 'aktif anlaşma yeniden paylaşılamaz'
);

-- Withdraw and expiry work the same as a phone invite -------------------------------------------------
create temp table ag2 as select pg_temp.new_agreement() as id;
grant select on ag2 to authenticated;
select is(
	public.share_agreement_by_id((select id from ag2), pg_temp.pnid('33333333-3333-4333-8333-333333333333'), 1) ->> 'status',
	'shared', 'ikinci anlaşma paylaşıldı'
);
select is(public.withdraw_share((select id from ag2)) ->> 'status', 'personal', 'geri çekilir');
reset role;
select is((select status::text from public.invites where agreement_id = (select id from ag2)), 'revoked', 'davet geçersiz');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(
	public.share_agreement_by_id((select id from ag2), pg_temp.pnid('33333333-3333-4333-8333-333333333333'), 3) ->> 'status',
	'shared', 'yeniden paylaşıldı'
);
reset role;
select is(private.expire_invites(now() + interval '8 days'), 1, 'süresi dolar');
select is((select status::text from public.agreements where id = (select id from ag2)), 'personal', 'süre dolunca personal');

-- Daily limit: ten shares by ID (three so far) ---------------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
do $$ begin
	for i in 1..7 loop
		perform public.share_agreement_by_id(pg_temp.new_agreement(), pg_temp.pnid('33333333-3333-4333-8333-333333333333'), 1);
	end loop;
end $$;
select throws_ok(
	$$ select public.share_agreement_by_id(pg_temp.new_agreement(), pg_temp.pnid('33333333-3333-4333-8333-333333333333'), 1) $$,
	'P0001', 'rate_limited', 'günde 10 ID ile paylaşımdan sonrası reddedilir'
);
select is(
	(select count(*)::int from public.agreements where creator_id = '11111111-1111-4111-8111-111111111111' and status = 'pending'),
	7, 'reddedilen paylaşım anlaşmayı değiştirmez'
);

-- Regeneration (BR-18) ---------------------------------------------------------------------------------------
reset role;
create temp table old_id as select pg_temp.pnid('11111111-1111-4111-8111-111111111111') as v;
grant select on old_id to authenticated;
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
create temp table regen as select public.regenerate_paramnet_id() as r;
select isnt((select r ->> 'paramnet_id' from regen), (select v from old_id), 'yeni ID farklı');
select is((select r ->> 'paramnet_id' from regen), pg_temp.pnid('11111111-1111-4111-8111-111111111111'), 'profile yazıldı');
select throws_ok($$ select public.regenerate_paramnet_id() $$, 'P0001', 'rate_limited', '30 gün dolmadan yenilenemez');
reset role;
select ok(exists (select 1 from public.retired_paramnet_ids where paramnet_id = (select v from old_id)), 'eski ID emekliye ayrıldı');
select throws_ok(
	$$ update public.profiles set paramnet_id = (select v from old_id) where id = '33333333-3333-4333-8333-333333333333' $$,
	'P0001', 'paramnet_id_retired', 'eski ID başka hesaba verilemez'
);
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select is(public.find_by_paramnet_id((select v from old_id)) ->> 'status', 'not_found', 'eski ID ile bulunamaz');
reset role;
update public.profiles set paramnet_id_changed_at = now() - interval '31 days' where id = '11111111-1111-4111-8111-111111111111';
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select ok(public.regenerate_paramnet_id() ? 'paramnet_id', '30 gün sonra yeniden yenilenir');

select * from finish();
rollback;
