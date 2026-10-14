begin;
select plan(24);

-- F4-01b: 6 haneli PIN ile girişte hesap kilidi (ADR-046, ADR-049). pin-login her denemeyi buraya yazar:
-- 15 dakika içinde 5 hata hesabı 15 dakika kilitler.

select ok(not has_function_privilege('anon', 'public.pin_login_check(text)', 'execute'), 'anon kilidi sorgulayamaz');
select ok(not has_function_privilege('authenticated', 'public.pin_login_check(text)', 'execute'), 'istemci kilidi sorgulayamaz');
select ok(not has_function_privilege('authenticated', 'public.pin_login_record(text, boolean)', 'execute'), 'istemci deneme yazamaz');
select ok(not has_function_privilege('authenticated', 'public.pin_mark_set(uuid, text)', 'execute'), 'istemci PIN kaydı yazamaz');
select ok(has_function_privilege('authenticated', 'public.has_pin()', 'execute'), 'istemci PIN durumunu sorabilir');
select ok(not has_function_privilege('anon', 'public.has_pin()', 'execute'), 'anon PIN durumunu soramaz');
select ok(not has_table_privilege('authenticated', 'public.pin_login_attempts', 'select'), 'deneme tablosu istemciye kapalı');
select ok(not has_table_privilege('authenticated', 'public.user_pins', 'insert'), 'PIN tablosuna istemci yazamaz');

-- Dört hata: kilit yok, kalan hak azalır.
select is(
	(select array_agg((public.pin_login_record('+905550000001', false) ->> 'attempts_left')::int) from generate_series(1, 4)),
	array[4, 3, 2, 1],
	'kalan deneme hakkı'
);
select is(public.pin_login_check('+905550000001') ->> 'locked', 'false', 'dört hatada kilit yok');

-- Beşinci hata 15 dakika kilitler.
select is(
	public.pin_login_record('+905550000001', false) - 'retry_after_s',
	'{"locked": true, "attempts_left": 0}'::jsonb,
	'beşinci hata kilitler'
);
select ok((public.pin_login_check('+905550000001') ->> 'retry_after_s')::int between 899 and 900, 'kilit 15 dakika');
select is(public.pin_login_check('+905550000001') ->> 'locked', 'true', 'kilitli hesap sorgusu');
select is(public.pin_login_check('+905550000002') ->> 'locked', 'false', 'kilit yalnızca o numarada');
select is(
	(select count(*)::int from public.pin_login_attempts where phone_hash like '%+90%' or phone_hash like '%555%'),
	0,
	'tabloda numara açık yazılmaz'
);

-- Kilit süresi dolunca sayaç baştan başlar.
update public.pin_login_attempts set locked_until = now() - interval '1 second', last_failed_at = now() - interval '15 minutes';
select is(public.pin_login_check('+905550000001') ->> 'locked', 'false', 'süre dolunca kilit açılır');
select is((public.pin_login_record('+905550000001', false) ->> 'attempts_left')::int, 4, 'kilitten sonra ilk hata baştan sayılır');

-- 15 dakikadan eski hatalar sayılmaz.
select public.pin_login_record('+905550000003', false) from generate_series(1, 3);
update public.pin_login_attempts set last_failed_at = now() - interval '16 minutes'
where phone_hash = encode(sha256(convert_to('+905550000003', 'UTF8')), 'hex');
select is((public.pin_login_record('+905550000003', false) ->> 'attempts_left')::int, 4, 'eski hatalar sayılmaz');

-- Başarılı giriş sayacı sıfırlar.
select is(public.pin_login_record('+905550000003', true), '{"locked": false, "attempts_left": 5}'::jsonb, 'başarılı giriş');
select is((public.pin_login_record('+905550000003', false) ->> 'attempts_left')::int, 4, 'başarıdan sonra baştan sayılır');

-- PIN belirlenince ("Şifremi unuttum") kilit ve bekleyen hatalar silinir.
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000a1', '905559990003');
select public.pin_login_record('+905559990003', false) from generate_series(1, 5);
select public.pin_mark_set('00000000-0000-0000-0000-0000000000a1', '+905559990003');
select is((public.pin_login_check('+905559990003') ->> 'locked'), 'false', 'PIN belirlenince kilit kalkar');
select is(
	(select count(*)::int from public.pin_login_attempts where phone_hash = encode(sha256(convert_to('+905559990003', 'UTF8')), 'hex')),
	0,
	'PIN belirlenince hatalar silinir'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
select is(public.has_pin(), true, 'PIN belirlemiş hesap');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}', true);
select is(public.has_pin(), false, 'PIN belirlememiş (eski) hesap');
reset role;

select * from finish();
rollback;
