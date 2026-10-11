begin;
select plan(3);

select has_extension('pgtap', 'pgTAP yüklü');
select has_table('auth', 'users', 'auth.users mevcut');

-- İstemci public şemaya Data API ile erişebildiği için RLS'siz tablo güvenlik açığıdır.
select is_empty(
	$$
		select c.relname
		from pg_class c
		join pg_namespace n on n.oid = c.relnamespace
		where n.nspname = 'public'
			and c.relkind in ('r', 'p')
			and not c.relrowsecurity
	$$,
	'public şemasındaki tüm tablolarda RLS açık'
);

select * from finish();
rollback;
