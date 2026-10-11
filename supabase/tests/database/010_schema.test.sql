begin;
select plan(49);

-- Tablolar ve enum'lar (spec 10.1, paramnet-domain schema.md)
select has_table('public', t, format('%s tablosu var', t))
from unnest(array[
	'profiles', 'contacts', 'agreements', 'agreement_versions', 'installments', 'payments',
	'payment_allocations', 'agreement_events', 'reminders', 'notification_outbox', 'push_tokens', 'consents'
]) as t;

select has_enum('public', e, format('%s enum''u var', e))
from unnest(array[
	'agreement_status', 'agreement_kind', 'party_role', 'contact_kind', 'version_status',
	'payment_status', 'payment_kind', 'payment_method', 'invite_status', 'event_channel'
]) as e;

select col_type_is('public', 'agreements', 'principal_minor', 'bigint', 'para bigint (BR-01)');
select col_type_is('public', 'agreements', 'started_on', 'date', 'started_on date (ADR-019)');
select col_is_null('public', 'agreements', 'started_on', 'started_on boş olabilir');

-- Her yabancı anahtarın baştaki sütunlarıyla başlayan bir indeksi olmalı (JOIN ve CASCADE).
select is_empty(
	$$
		select c.conrelid::regclass || '.' || c.conname
		from pg_constraint c
		join pg_namespace n on n.oid = c.connamespace
		where c.contype = 'f'
			and n.nspname = 'public'
			and not exists (
				select 1 from pg_index i
				where i.indrelid = c.conrelid
					and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey
			)
	$$,
	'tüm yabancı anahtarlar indeksli'
);

-- Test verisi
insert into auth.users (id, phone, aud, role) values
	('11111111-1111-4111-8111-111111111111', '905550000001', 'authenticated', 'authenticated'),
	('22222222-2222-4222-8222-222222222222', '905550000002', 'authenticated', 'authenticated');
insert into public.profiles (id, display_name, phone_e164) values
	('11111111-1111-4111-8111-111111111111', 'Ayşe', '+905550000001'),
	('22222222-2222-4222-8222-222222222222', 'Bora', '+905550000002');
insert into public.contacts (id, owner_id, display_name, phone_e164) values
	('c0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Bora', '+905550000002');
insert into public.agreements (id, creator_id, creator_role, counterparty_contact_id, kind, title, principal_minor, outstanding_minor, status)
values ('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'creditor',
	'c0000000-0000-4000-8000-000000000001', 'loan', 'Borç', 100000, 100000, 'personal');
insert into public.agreement_versions (agreement_id, version, terms, terms_hash, proposed_by, status)
values ('a0000000-0000-4000-8000-000000000001', 1, '{}'::jsonb, repeat('a', 64),
	'11111111-1111-4111-8111-111111111111', 'accepted');
insert into public.installments (id, agreement_id, version, seq, due_date, amount_minor)
values ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 1, 1, '2026-11-10', 100000);
insert into public.payments (id, agreement_id, amount_minor, paid_on, method, kind, status, reported_by, idempotency_key)
values ('90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 1000, '2026-10-11',
	'cash', 'payment', 'confirmed', '11111111-1111-4111-8111-111111111111', 'e0000000-0000-4000-8000-000000000001');
insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
values ('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'app', 'created', 1);

-- Kısıtlar: para
select throws_ok(
	$$ insert into public.agreements (creator_id, creator_role, counterparty_contact_id, kind, title, principal_minor, outstanding_minor, status)
		values ('11111111-1111-4111-8111-111111111111', 'creditor', 'c0000000-0000-4000-8000-000000000001', 'loan', 'X', 0, 0, 'personal') $$,
	'23514', null, 'anapara > 0'
);
select throws_ok(
	$$ update public.agreements set outstanding_minor = 100001 where id = 'a0000000-0000-4000-8000-000000000001' $$,
	'23514', null, 'kalan anaparayı aşamaz'
);
select throws_ok(
	$$ update public.agreements set outstanding_minor = -1 where id = 'a0000000-0000-4000-8000-000000000001' $$,
	'23514', null, 'kalan negatif olamaz (BR-04)'
);
select throws_ok(
	$$ insert into public.installments (agreement_id, version, seq, amount_minor) values ('a0000000-0000-4000-8000-000000000001', 1, 2, 0) $$,
	'23514', null, 'taksit tutarı > 0'
);
select throws_ok(
	$$ update public.installments set paid_minor = 100001 where seq = 1 $$,
	'23514', null, 'ödenen taksit tutarını aşamaz'
);
select throws_ok(
	$$ insert into public.installments (agreement_id, version, seq, amount_minor) values ('a0000000-0000-4000-8000-000000000001', 1, 1, 5) $$,
	'23505', null, 'aynı versiyonda seq tekil'
);
select throws_ok(
	$$ insert into public.payments (agreement_id, amount_minor, paid_on, method, kind, status, reported_by, idempotency_key)
		values ('a0000000-0000-4000-8000-000000000001', 0, '2026-10-11', 'cash', 'payment', 'confirmed',
			'11111111-1111-4111-8111-111111111111', gen_random_uuid()) $$,
	'23514', null, 'ödeme tutarı > 0'
);
select throws_ok(
	$$ insert into public.payments (agreement_id, amount_minor, paid_on, method, kind, status, reported_by, idempotency_key)
		values ('a0000000-0000-4000-8000-000000000001', 5, '2026-10-11', 'cash', 'payment', 'confirmed',
			'11111111-1111-4111-8111-111111111111', 'e0000000-0000-4000-8000-000000000001') $$,
	'23505', null, 'idempotency_key tekil (BR-09)'
);
select throws_ok(
	$$ insert into public.payment_allocations (payment_id, installment_id, amount_minor)
		values ('90000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 0) $$,
	'23514', null, 'dağıtım tutarı > 0'
);

-- Kısıtlar: kimlik ve metin
select throws_ok(
	$$ insert into public.contacts (owner_id, display_name, phone_e164) values ('11111111-1111-4111-8111-111111111111', 'Başka', '+905550000002') $$,
	'23505', null, 'aynı sahipte numara tekil'
);
select throws_ok(
	$$ insert into public.contacts (owner_id, display_name, phone_e164) values ('11111111-1111-4111-8111-111111111111', 'X', '05551234567') $$,
	'23514', null, 'kişi numarası E.164 TR cep'
);
select throws_ok(
	$$ insert into public.contacts (owner_id, display_name) values ('11111111-1111-4111-8111-111111111111', '') $$,
	'23514', null, 'kişi adı boş olamaz'
);
select throws_ok(
	$$ update public.profiles set phone_e164 = '+15551234567' where display_name = 'Ayşe' $$,
	'23514', null, 'profil numarası E.164 TR cep'
);
select throws_ok(
	$$ update public.agreements set title = repeat('x', 81) where id = 'a0000000-0000-4000-8000-000000000001' $$,
	'23514', null, 'başlık en fazla 80'
);
select throws_ok(
	$$ update public.agreements set currency = 'USD' where id = 'a0000000-0000-4000-8000-000000000001' $$,
	'23514', null, 'ilk sürümde yalnızca TRY (BR-02)'
);

-- Kısıtlar: durum tutarlılığı
select throws_ok(
	$$ update public.agreements set status = 'settled' where id = 'a0000000-0000-4000-8000-000000000001' $$,
	'23514', null, 'settled ise settled_at dolu'
);
select throws_ok(
	$$ update public.agreements set counterparty_profile_id = creator_id where id = 'a0000000-0000-4000-8000-000000000001' $$,
	'23514', null, 'kendisiyle anlaşma yok (BR-12)'
);
select throws_ok(
	$$ update public.agreement_versions set terms_hash = 'abc' $$,
	'P0001', null, 'versiyon şartları değişmez'
);
select throws_ok(
	$$ insert into public.agreement_versions (agreement_id, version, terms, terms_hash, proposed_by, status)
		values ('a0000000-0000-4000-8000-000000000001', 2, '{}', 'ABC', '11111111-1111-4111-8111-111111111111', 'draft') $$,
	'23514', null, 'terms_hash 64 küçük hex'
);

-- Yalnızca ekleme (BR-13): olaylar değişmez/silinmez; versiyonda yalnızca durum değişebilir
select throws_ok(
	$$ update public.agreement_events set type = 'x' $$,
	'P0001', null, 'olay güncellenemez'
);
select throws_ok(
	$$ delete from public.agreement_events $$,
	'P0001', null, 'olay silinemez'
);
select throws_ok(
	$$ delete from public.agreement_versions $$,
	'P0001', null, 'versiyon silinemez'
);
select lives_ok(
	$$ update public.agreement_versions set status = 'superseded' $$,
	'versiyon durumu değişebilir'
);

select * from finish();
rollback;
