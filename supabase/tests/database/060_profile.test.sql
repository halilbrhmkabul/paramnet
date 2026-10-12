begin;
select plan(10);

insert into auth.users (id, phone, aud, role) values
	('11111111-1111-4111-8111-111111111111', '905550000001', 'authenticated', 'authenticated'),
	('44444444-4444-4444-8444-444444444444', null, 'authenticated', 'authenticated');

create function pg_temp.act_as(uid uuid) returns void language sql as $$
	select set_config('role', 'authenticated', true),
		set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select ok(has_function_privilege('authenticated', 'public.complete_profile(text, text, text)', 'execute'), 'authenticated çağırabilir');
select ok(not has_function_privilege('anon', 'public.complete_profile(text, text, text)', 'execute'), 'anon çağıramaz');

select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
select is(
	public.complete_profile('Ayşe', '2026-10', '2026-10'),
	'{"id": "11111111-1111-4111-8111-111111111111", "display_name": "Ayşe", "phone_e164": "+905550000001", "pending_requests": 0}'::jsonb,
	'profil auth numarasıyla oluşur'
);
select results_eq(
	$$ select document, version from public.consents order by document $$,
	$$ values ('kvkk', '2026-10'), ('terms', '2026-10') $$,
	'KVKK ve koşullar onayı kaydedildi'
);
select is(
	public.complete_profile('Ayşe Y.', '2026-10', '2026-10') ->> 'display_name',
	'Ayşe Y.',
	'tekrar çağrı adı günceller'
);
select is((select count(*)::int from public.consents), 2, 'aynı sürüm onayı tekrarlanmaz');
select throws_ok($$ select public.complete_profile(' ', '2026-10', '2026-10') $$, 'P0001', 'validation_error', 'boş ad');
select throws_ok($$ select public.complete_profile(repeat('a', 81), '2026-10', '2026-10') $$, 'P0001', 'validation_error', 'uzun ad');

select pg_temp.act_as('44444444-4444-4444-8444-444444444444');
select throws_ok($$ select public.complete_profile('Numarasız', '2026-10', '2026-10') $$, 'P0001', 'forbidden', 'telefonu doğrulanmamış kullanıcı');

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$ select public.complete_profile('X', '1', '1') $$, '28000', 'not_authenticated', 'oturumsuz');

select * from finish();
rollback;
