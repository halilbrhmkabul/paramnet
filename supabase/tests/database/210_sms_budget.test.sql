begin;
select plan(13);

-- F3-05: SMS bütçesi ve numara başına sınır (spec 17 "SMS maliyeti ve kötüye kullanım", ADR-041).

select ok(not has_function_privilege('authenticated', 'public.take_sms_budget(text, text, int)', 'execute'), 'istemci bütçeye dokunamaz');
select ok(not has_function_privilege('anon', 'public.take_sms_budget(text, text, int)', 'execute'), 'anon bütçeye dokunamaz');
select ok(not has_table_privilege('authenticated', 'public.sms_usage', 'select'), 'sayaç istemciye kapalı');

-- Günlük sınır 5: dördüncüde %80 uyarısı, altıncıda (ilk ret) tükendi alarmı.
select is(
	(select array_agg(public.take_sms_budget('auth', '+90555000' || lpad(s::text, 4, '0'), 5) - 'used' order by s) from generate_series(1, 6) as s),
	array[
		'{"allowed": true, "alarm": null, "limit": 5}',
		'{"allowed": true, "alarm": null, "limit": 5}',
		'{"allowed": true, "alarm": null, "limit": 5}',
		'{"allowed": true, "alarm": "warning", "limit": 5}',
		'{"allowed": true, "alarm": null, "limit": 5}',
		'{"allowed": false, "alarm": "exhausted", "limit": 5}'
	]::jsonb[],
	'günlük sınır ve alarmlar'
);
select is(public.take_sms_budget('invite', '+905550009999', 5) ->> 'alarm', null, 'tükendi alarmı bir kez');
select is(public.take_sms_budget('invite', '+905550009998', 5) ->> 'allowed', 'false', 'sınır aşıldıktan sonra gönderim yok');
select is((select count from public.sms_usage where day = (now() at time zone 'Europe/Istanbul')::date), 8, 'günün sayacı (İstanbul günü)');

-- Numara başına saatte 5 SMS (Auth + davet birlikte); reddedilen deneme günlük sayaca girmez.
delete from public.sms_usage;
select is(
	(select count(*)::int from generate_series(1, 5) as s where public.take_sms_budget(case when s % 2 = 0 then 'auth' else 'invite' end, '+905551234567', 500) ->> 'allowed' = 'true'),
	5,
	'bir numaraya saatte 5 SMS'
);
select is(public.take_sms_budget('auth', '+905551234567', 500) - 'used', '{"allowed": false, "alarm": null, "limit": 500, "reason": "phone_limit"}'::jsonb, 'altıncı reddedilir');
select is((select count from public.sms_usage), 5, 'numara sınırına takılan deneme bütçeyi harcamaz');
select is(
	(select count(*)::int from public.rate_limits where key like 'sms:phone:%' and key like '%+90%'),
	0,
	'sayaç anahtarında numara açık yazılmaz'
);

select throws_ok($$ select public.take_sms_budget('push', '+905551234567', 500) $$, 'P0001', 'validation_error', 'bilinmeyen kanal');
select throws_ok($$ select public.take_sms_budget('auth', '+905551234567', 0) $$, 'P0001', 'validation_error', 'geçersiz sınır');

select * from finish();
rollback;
