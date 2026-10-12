begin;
select plan(8);

-- Faz 2 kapısı (F2-12): yeni bir migration bu sınırları sessizce gevşetemez (security.md, ADR-020).

select is_empty(
	$$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
		where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
	'public şemasındaki her tabloda RLS açık'
);
select is_empty(
	$$ select c.relname::text || ' ' || p from pg_class c join pg_namespace n on n.oid = c.relnamespace
		cross join unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) as p
		where n.nspname = 'public' and c.relkind = 'r'
			and (has_table_privilege('authenticated', c.oid, p) or has_table_privilege('anon', c.oid, p)) $$,
	'istemci hiçbir tabloya doğrudan yazamaz (yazmalar RPC ile)'
);
select is_empty(
	$$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
		where n.nspname = 'public' and c.relkind in ('r', 'v', 'm') and has_table_privilege('anon', c.oid, 'SELECT') $$,
	'anon hiçbir tabloyu okuyamaz'
);
select is_empty(
	$$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
		where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') $$,
	'anon hiçbir RPC çalıştıramaz (web onayı edge function + servis rolüyle)'
);
select is_empty(
	$$ select n.nspname::text || '.' || p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
		where n.nspname in ('public', 'private') and p.prosecdef
			and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) as c where c like 'search_path=%') $$,
	'her security definer fonksiyonun search_path''i sabit'
);
select results_eq(
	$$ select p.proname::text collate "default" from pg_proc p join pg_namespace n on n.oid = p.pronamespace
		where n.nspname = 'private' and has_function_privilege('authenticated', p.oid, 'execute') $$,
	$$ values ('can_view_agreement') $$,
	'private şemasından yalnızca RLS yardımcısı çağrılabilir'
);
-- Web onayı ve outbox işleme servis rolüne ait; oturum açmış kullanıcı da çağıramaz.
select is_empty(
	$$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
		where n.nspname = 'public'
			and p.proname in ('invite_open', 'invite_send_otp', 'invite_verify_otp', 'invite_details', 'invite_decide',
				'claim_notifications', 'finish_notifications')
			and has_function_privilege('authenticated', p.oid, 'execute') $$,
	'servis rolü RPC''leri istemciye kapalı'
);
-- Yalnızca eklenen tablolar (BR-13): sahibi bile güncelleyip silemez.
select results_eq(
	$$ select c.relname::text collate "default", t.tgname::text collate "default" from pg_trigger t join pg_class c on c.oid = t.tgrelid
		where c.relname in ('agreement_versions', 'agreement_events') and t.tgname ~ '_no_(update|delete)$' order by 1, 2 $$,
	$$ values ('agreement_events', 'agreement_events_no_delete'), ('agreement_events', 'agreement_events_no_update'),
		('agreement_versions', 'agreement_versions_no_delete') $$,
	'geçmiş tabloları yalnızca eklemeye açık'
);

select * from finish();
rollback;
