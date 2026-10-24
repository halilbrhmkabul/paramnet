-- ADR-051: first/last name, @username, avatar, own profile, erasure and export of the new fields.
begin;
select plan(43);

insert into auth.users (id, phone, aud, role) values
	('11111111-1111-4111-8111-111111111111', '905550000001', 'authenticated', 'authenticated'),
	('22222222-2222-4222-8222-222222222222', '905550000002', 'authenticated', 'authenticated'),
	('33333333-3333-4333-8333-333333333333', '905550000003', 'authenticated', 'authenticated');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
	select set_config('role', 'authenticated', true),
		set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- complete_profile splits the name at the last space --------------------------------------------------
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(public.complete_profile('Ayşe Nur Yılmaz', '2026-10', '2026-10') ->> 'display_name', 'Ayşe Nur Yılmaz', 'görünen ad aynen');
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select lives_ok($$ select public.complete_profile('Bora', '2026-10', '2026-10') $$, 'tek kelimelik ad');
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select lives_ok($$ select public.complete_profile('Cem Ak', '2026-10', '2026-10') $$, 'üçüncü hesap');
reset role;
select results_eq(
	$$ select first_name, last_name from public.profiles order by phone_e164 $$,
	$$ values ('Ayşe Nur', 'Yılmaz'), ('Bora', null::text), ('Cem', 'Ak') $$,
	'ad son boşluktan bölünür; tek kelimede soyad boş'
);

-- get_my_profile -----------------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.get_my_profile()', 'execute'), 'anon profil okuyamaz');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(
	(select array_agg(k order by k) from jsonb_object_keys(public.get_my_profile()) k),
	array['avatar_path', 'can_regenerate_at', 'display_name', 'first_name', 'id', 'id_discoverable', 'last_name',
		'paramnet_id', 'phone_e164', 'reminder_before_days', 'username'],
	'kendi profil alanları'
);
select is(public.get_my_profile() -> 'reminder_before_days', '[3, 0]'::jsonb, 'varsayılan hatırlatma: 3 gün önce ve vade günü');
select is(public.get_my_profile() ->> 'can_regenerate_at', null, 'ilk yenileme hemen yapılabilir');

-- update_profile -----------------------------------------------------------------------------------------
select is(
	(select jsonb_build_object('first_name', p ->> 'first_name', 'last_name', p ->> 'last_name',
		'display_name', p ->> 'display_name', 'username', p ->> 'username')
	from (select public.update_profile('Ayşe', 'Yılmaz', ' @AyseY ') as p) s),
	'{"first_name": "Ayşe", "last_name": "Yılmaz", "display_name": "Ayşe Yılmaz", "username": "aysey"}'::jsonb,
	'ad, soyad ve kullanıcı adı güncellenir; görünen ad türetilir'
);
select is(public.update_profile(' Ayşe ', '', 'aysey') ->> 'display_name', 'Ayşe', 'soyad boş olabilir');
select is(public.update_profile('Ayşe', null, 'aysey') ->> 'last_name', null, 'soyad null');
select throws_ok($$ select public.update_profile('', 'Yılmaz', null) $$, 'P0001', 'validation_error', 'ad zorunlu');
select throws_ok($$ select public.update_profile(repeat('a', 41), 'Yılmaz', null) $$, 'P0001', 'validation_error', 'ad en fazla 40');
select throws_ok($$ select public.update_profile('Ayşe', repeat('a', 41), null) $$, 'P0001', 'validation_error', 'soyad en fazla 40');
select throws_ok($$ select public.update_profile('Ayşe', 'Yılmaz', 'ayşe') $$, 'P0001', 'validation_error', 'Türkçe harfli kullanıcı adı');
select throws_ok($$ select public.update_profile('Ayşe', 'Yılmaz', 'destek') $$, 'P0001', 'validation_error', 'ayrılmış kullanıcı adı');
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select throws_ok($$ select public.update_profile('Bora', 'Kaya', 'AYSEY') $$, 'P0001', 'username_taken', 'alınmış kullanıcı adı (büyük/küçük harf fark etmez)');
select is(public.update_profile('Bora', 'Kaya', 'bora') ->> 'username', 'bora', 'boştaki kullanıcı adı alınır');
select is(public.update_profile('Bora', 'Kaya', null) ->> 'username', null, 'kullanıcı adı kaldırılır');
select is(public.update_profile('Bora', 'Kaya', '') ->> 'username', null, 'boş metin de kaldırır');

-- check_username ----------------------------------------------------------------------------------------
select is(public.check_username('aysey'), '{"status": "taken"}'::jsonb, 'başkasının kullanıcı adı');
select is(public.check_username('bora'), '{"status": "available"}'::jsonb, 'boşta');
select is(public.check_username('a'), '{"status": "invalid"}'::jsonb, 'geçersiz');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(public.check_username('@AyseY'), '{"status": "available"}'::jsonb, 'kendi kullanıcı adı uygundur');
do $$ begin for i in 1..29 loop perform public.check_username('xyz'); end loop; end $$;
select throws_ok($$ select public.check_username('xyz') $$, 'P0001', 'rate_limited', 'saatte 30 kontrolden sonrası reddedilir');

-- Avatar ------------------------------------------------------------------------------------------------
reset role;
select results_eq(
	$$ select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars' $$,
	$$ values (false, 1048576::bigint, array['image/jpeg']) $$,
	'avatars: özel, 1 MB, yalnızca JPEG'
);
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select lives_ok(
	$$ insert into storage.objects (bucket_id, name) values ('avatars', '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg') $$,
	'kendi klasörüne yükler'
);
select throws_ok(
	$$ insert into storage.objects (bucket_id, name) values ('avatars', '22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg') $$,
	'42501', null, 'başkasının klasörüne yükleyemez'
);
select throws_ok(
	$$ select public.set_avatar('11111111-1111-4111-8111-111111111111/cccccccc-cccc-4ccc-8ccc-cccccccccccc.jpg') $$,
	'P0001', 'validation_error', 'yüklenmemiş dosya'
);
select throws_ok(
	$$ select public.set_avatar('22222222-2222-4222-8222-222222222222/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg') $$,
	'P0001', 'validation_error', 'başkasının yolu'
);
select throws_ok($$ select public.set_avatar('../x.jpg') $$, 'P0001', 'validation_error', 'biçim dışı yol');
select is(
	public.set_avatar('11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'),
	'{"avatar_path": "11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg", "previous_path": null}'::jsonb,
	'fotoğraf ayarlanır'
);

-- Who sees it: the owner, and the other side of a shared agreement only.
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 0, 'ortak anlaşması olmayan göremez');
reset role;
insert into public.contacts (id, owner_id, display_name, linked_profile_id)
	values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111', 'Bora', '22222222-2222-4222-8222-222222222222');
insert into public.agreements (creator_id, creator_role, counterparty_contact_id, counterparty_profile_id, kind, title, principal_minor, outstanding_minor, status)
	values ('11111111-1111-4111-8111-111111111111', 'creditor', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '22222222-2222-4222-8222-222222222222', 'loan', 'Borç', 1000, 1000, 'active');
select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 1, 'anlaşmanın karşı tarafı görür');
select is(
	(select x -> 'counterparty' ->> 'avatar_path' from jsonb_array_elements(public.list_agreements()) x limit 1),
	'11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg',
	'karşı tarafın fotoğraf yolu listede gelir'
);
select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select is((select count(*)::int from storage.objects where bucket_id = 'avatars'), 0, 'üçüncü kişi göremez');

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(
	public.set_avatar(null),
	'{"avatar_path": null, "previous_path": "11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg"}'::jsonb,
	'fotoğraf kaldırılır; eski yol silinmek üzere döner'
);
-- Storage refuses SQL deletes; the app deletes through the Storage API under this policy.
select is(
	(select qual from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_delete_own'),
	'((bucket_id = ''avatars''::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))',
	'yalnızca kendi klasöründen silebilir'
);

-- Export and erasure ------------------------------------------------------------------------------------
select public.set_avatar(null);
reset role;
insert into storage.objects (bucket_id, name) values ('avatars', '11111111-1111-4111-8111-111111111111/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.jpg');
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select public.set_avatar('11111111-1111-4111-8111-111111111111/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.jpg');
select is(
	(select array_agg(k order by k) from jsonb_object_keys(public.export_my_data() -> 'profile') k),
	array['avatar_path', 'created_at', 'display_name', 'first_name', 'id', 'id_discoverable', 'last_name', 'locale',
		'paramnet_id', 'phone_e164', 'reminder_before_days', 'timezone', 'username'],
	'dışa aktarma yeni alanları içerir'
);
select ok(public.export_my_data() ? 'notifications', 'dışa aktarma bildirim kutusunu içerir');

reset role;
create temp table pn as select paramnet_id from public.profiles where id = '11111111-1111-4111-8111-111111111111';
select is(
	public.delete_account_data('11111111-1111-4111-8111-111111111111') ->> 'avatar_path',
	'11111111-1111-4111-8111-111111111111/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.jpg',
	'silme, depodan kaldırılacak fotoğraf yolunu döner'
);
select results_eq(
	$$ select first_name, last_name, username, avatar_path, paramnet_id, id_discoverable from public.profiles where id = '11111111-1111-4111-8111-111111111111' $$,
	$$ values (null::text, null::text, null::text, null::text, null::text, false) $$,
	'silinen hesabın ad, kullanıcı adı, fotoğraf ve ID''si kalmaz'
);
select ok(exists (select 1 from public.retired_paramnet_ids where paramnet_id = (select paramnet_id from pn)), 'silinen hesabın ID''si yeniden verilmez');

select * from finish();
rollback;
