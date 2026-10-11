-- F1-15: read RPCs. They return the mobile view models (apps/mobile/src/api/types.ts) as JSON, so the
-- Supabase adapter only calls them. Everything is computed from the caller's point of view.

-- "Today" can be pinned for database tests only: the setting is honoured for the postgres session user,
-- never for API requests (PostgREST connects as authenticator).
create or replace function private.today() returns date
language sql
stable
set search_path = ''
as $$
	select coalesce(
		case when session_user = 'postgres' then nullif(current_setting('paramnet.today', true), '')::date end,
		(now() at time zone 'Europe/Istanbul')::date
	);
$$;

-- Spec 8.4: derived, never stored. Mirrors packages/shared installmentStatus.
create function private.installment_state(p_due date, p_amount bigint, p_paid bigint, p_today date) returns jsonb
language sql
stable
set search_path = ''
as $$
	select jsonb_build_object(
		'status', case
			when p_paid = p_amount then 'paid'
			when p_due is null or p_due > p_today then 'upcoming'
			when p_due = p_today then 'due_today'
			else 'overdue'
		end,
		'partial', p_paid > 0 and p_paid < p_amount
	);
$$;

-- Agreements that still count towards balances and reminders.
create function private.is_open(p_status public.agreement_status) returns boolean
language sql
stable
set search_path = ''
as $$
	select p_status in ('personal', 'active', 'amendment_pending', 'disputed');
$$;

create function private.my_role(p_agreement public.agreements, p_uid uuid) returns public.party_role
language sql
stable
set search_path = ''
as $$
	select case
		when p_agreement.creator_id = p_uid then p_agreement.creator_role
		when p_agreement.creator_role = 'creditor' then 'debtor'::public.party_role
		else 'creditor'::public.party_role
	end;
$$;

-- The creator sees their own contact entry; the counterparty sees the creator's profile name.
create function private.counterparty_of(p_agreement public.agreements, p_uid uuid) returns jsonb
language sql
stable
set search_path = ''
as $$
	select case
		when p_agreement.creator_id = p_uid then (
			select jsonb_build_object('contact_id', c.id, 'display_name', c.display_name, 'kind', c.kind, 'phone_e164', c.phone_e164)
			from public.contacts c where c.id = p_agreement.counterparty_contact_id
		)
		else (
			select jsonb_build_object('contact_id', null, 'display_name', p.display_name, 'kind', 'person', 'phone_e164', p.phone_e164)
			from public.profiles p where p.id = p_agreement.creator_id
		)
	end;
$$;

create function private.agreement_summary(p_agreement public.agreements, p_uid uuid, p_today date) returns jsonb
language sql
stable
set search_path = ''
as $$
	with rows as (
		select i.seq, i.due_date, i.amount_minor, i.paid_minor,
			private.installment_state(i.due_date, i.amount_minor, i.paid_minor, p_today) as state
		from public.installments i
		where i.agreement_id = p_agreement.id and i.version = p_agreement.active_version
	),
	next_row as (
		select * from rows where state ->> 'status' <> 'paid' order by seq limit 1
	)
	select jsonb_build_object(
		'id', p_agreement.id,
		'kind', p_agreement.kind,
		'title', p_agreement.title,
		'status', p_agreement.status,
		'my_role', private.my_role(p_agreement, p_uid),
		'counterparty', private.counterparty_of(p_agreement, p_uid),
		'principal_minor', p_agreement.principal_minor,
		'outstanding_minor', p_agreement.outstanding_minor,
		'reported_minor', (
			select coalesce(sum(amount_minor), 0) from public.payments
			where agreement_id = p_agreement.id and status = 'reported'
		),
		'installment_count', (select count(*) from rows),
		'paid_installment_count', (select count(*) from rows where state ->> 'status' = 'paid'),
		'next_installment', (
			select jsonb_build_object('seq', seq, 'due_date', due_date, 'due_minor', amount_minor - paid_minor, 'state', state)
			from next_row
		),
		'row_version', p_agreement.row_version
	);
$$;

-- Installments of the caller's open agreements, as DueItem rows, ordered by date.
create function private.due_items(p_uid uuid, p_today date, p_from date, p_to date, p_include_paid boolean)
returns jsonb
language sql
stable
set search_path = ''
as $$
	select coalesce(jsonb_agg(item order by due_date, title, seq), '[]'::jsonb)
	from (
		select i.due_date, a.title, i.seq,
			jsonb_build_object(
				'agreement_id', a.id,
				'title', a.title,
				'counterparty_name', private.counterparty_of(a, p_uid) ->> 'display_name',
				'my_role', private.my_role(a, p_uid),
				'seq', i.seq,
				'installment_count', (select count(*) from public.installments x where x.agreement_id = a.id and x.version = a.active_version),
				'due_date', i.due_date,
				'due_minor', i.amount_minor - i.paid_minor,
				'state', private.installment_state(i.due_date, i.amount_minor, i.paid_minor, p_today)
			) as item
		from public.agreements a
		join public.installments i on i.agreement_id = a.id and i.version = a.active_version
		where (a.creator_id = p_uid or (a.counterparty_profile_id = p_uid and a.status <> 'personal'))
			and private.is_open(a.status)
			and i.due_date is not null
			and (p_from is null or i.due_date >= p_from)
			and (p_to is null or i.due_date <= p_to)
			and (p_include_paid or i.paid_minor < i.amount_minor)
	) as due;
$$;

create function private.require_uid() returns uuid
language plpgsql
stable
set search_path = ''
as $$
begin
	if auth.uid() is null then
		raise exception 'not_authenticated' using errcode = '28000';
	end if;
	return auth.uid();
end;
$$;

-- get_dashboard (S05) --------------------------------------------------------------------------------

create function public.get_dashboard() returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_today date := private.today();
	v_month_start date := date_trunc('month', v_today)::date;
	v_month_end date := (date_trunc('month', v_today) + interval '1 month - 1 day')::date;
	v_open jsonb := private.due_items(v_uid, v_today, null, null, false);
	v_month jsonb := private.due_items(v_uid, v_today, v_month_start, v_month_end, false);
begin
	return jsonb_build_object(
		'receivable_minor', (
			select coalesce(sum(a.outstanding_minor), 0) from public.agreements a
			where (a.creator_id = v_uid or (a.counterparty_profile_id = v_uid and a.status <> 'personal'))
				and private.is_open(a.status) and private.my_role(a, v_uid) = 'creditor'
		),
		'payable_minor', (
			select coalesce(sum(a.outstanding_minor), 0) from public.agreements a
			where (a.creator_id = v_uid or (a.counterparty_profile_id = v_uid and a.status <> 'personal'))
				and private.is_open(a.status) and private.my_role(a, v_uid) = 'debtor'
		),
		'due_this_month_minor', (
			select coalesce(sum((d ->> 'due_minor')::bigint), 0) from jsonb_array_elements(v_month) as d where d ->> 'my_role' = 'debtor'
		),
		'collect_this_month_minor', (
			select coalesce(sum((d ->> 'due_minor')::bigint), 0) from jsonb_array_elements(v_month) as d where d ->> 'my_role' = 'creditor'
		),
		'overdue', (
			select coalesce(jsonb_agg(d order by ord), '[]'::jsonb)
			from jsonb_array_elements(v_open) with ordinality as o(d, ord) where d -> 'state' ->> 'status' = 'overdue'
		),
		'upcoming', (
			select coalesce(jsonb_agg(d order by ord), '[]'::jsonb)
			from (
				select d, ord from jsonb_array_elements(v_open) with ordinality as o(d, ord)
				where (d ->> 'due_date')::date >= v_today
				order by ord
				limit 5
			) as next
		),
		-- Payments the other side reported and I, as creditor, have to confirm (Faz 2; zero in personal mode).
		'pending_count', (
			select count(*) from public.payments p
			join public.agreements a on a.id = p.agreement_id
			where p.status = 'reported' and p.reported_by <> v_uid
				and (a.creator_id = v_uid or a.counterparty_profile_id = v_uid) and a.status <> 'personal'
				and private.my_role(a, v_uid) = 'creditor'
		),
		'has_agreements', exists (
			select 1 from public.agreements a
			where a.creator_id = v_uid or (a.counterparty_profile_id = v_uid and a.status <> 'personal')
		)
	);
end;
$$;

-- get_calendar (S18) ---------------------------------------------------------------------------------

create function public.get_calendar(p_month date) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_start date := date_trunc('month', p_month)::date;
	v_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
begin
	return jsonb_build_object(
		'month', v_start,
		'days', coalesce((
			select jsonb_object_agg(day, items)
			from (
				select d ->> 'due_date' as day, jsonb_agg(d order by ord) as items
				from jsonb_array_elements(private.due_items(v_uid, private.today(), v_start, v_end, true)) with ordinality as o(d, ord)
				group by d ->> 'due_date'
			) as grouped
		), '{}'::jsonb)
	);
end;
$$;

-- get_agreement_detail (S11, S17) --------------------------------------------------------------------

create function public.get_agreement_detail(p_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_today date := private.today();
	v_ag public.agreements;
	v_terms jsonb;
begin
	select * into v_ag from public.agreements a
	where a.id = p_id and (a.creator_id = v_uid or (a.counterparty_profile_id = v_uid and a.status <> 'personal'));
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	select terms into v_terms from public.agreement_versions where agreement_id = p_id and version = v_ag.active_version;

	return private.agreement_summary(v_ag, v_uid, v_today) || jsonb_build_object(
		'description', v_ag.description,
		'started_on', v_ag.started_on,
		'notes', v_terms -> 'notes',
		'down_payment_minor', (v_terms ->> 'down_payment_minor')::bigint,
		'created_at', v_ag.created_at,
		'installments', (
			select coalesce(jsonb_agg(jsonb_build_object(
				'id', i.id, 'seq', i.seq, 'due_date', i.due_date, 'amount_minor', i.amount_minor, 'paid_minor', i.paid_minor,
				'state', private.installment_state(i.due_date, i.amount_minor, i.paid_minor, v_today)
			) order by i.seq), '[]'::jsonb)
			from public.installments i where i.agreement_id = p_id and i.version = v_ag.active_version
		),
		'payments', (
			select coalesce(jsonb_agg(jsonb_build_object(
				'id', p.id, 'amount_minor', p.amount_minor, 'paid_on', p.paid_on, 'method', p.method, 'kind', p.kind,
				'status', p.status, 'note', p.note, 'created_at', p.created_at
			) order by p.paid_on desc, p.created_at desc, p.id), '[]'::jsonb)
			from public.payments p where p.agreement_id = p_id
		),
		'events', (
			select coalesce(jsonb_agg(jsonb_build_object(
				'id', e.id::text,
				'type', e.type,
				'at', e.created_at,
				'actor', case when e.actor_id = v_uid then 'me' when e.actor_id is null then 'system' else 'counterparty' end,
				'amount_minor', e.payload -> 'amount_minor'
			) order by e.id), '[]'::jsonb)
			from public.agreement_events e where e.agreement_id = p_id
		)
	);
end;
$$;

-- Contacts (S06, S07) -------------------------------------------------------------------------------

create function private.contact_summary(p_contact public.contacts, p_uid uuid) returns jsonb
language sql
stable
set search_path = ''
as $$
	select jsonb_build_object(
		'id', p_contact.id,
		'display_name', p_contact.display_name,
		'phone_e164', p_contact.phone_e164,
		'kind', p_contact.kind,
		'net_minor', coalesce((
			select sum(case when a.creator_role = 'creditor' then a.outstanding_minor else -a.outstanding_minor end)
			from public.agreements a
			where a.counterparty_contact_id = p_contact.id and a.creator_id = p_uid and private.is_open(a.status)
		), 0),
		'open_agreement_count', (
			select count(*) from public.agreements a
			where a.counterparty_contact_id = p_contact.id and a.creator_id = p_uid and private.is_open(a.status)
		)
	);
$$;

create function public.list_contacts_with_balance() returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
begin
	return (
		select coalesce(jsonb_agg(private.contact_summary(c, v_uid) order by c.display_name collate "tr-TR-x-icu", c.id), '[]'::jsonb)
		from public.contacts c
		where c.owner_id = v_uid
	);
end;
$$;

create function public.get_contact_detail(p_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_contact public.contacts;
begin
	select * into v_contact from public.contacts where id = p_id and owner_id = v_uid;
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	return private.contact_summary(v_contact, v_uid) || jsonb_build_object(
		'agreements', (
			select coalesce(jsonb_agg(private.agreement_summary(a, v_uid, private.today()) order by a.created_at desc), '[]'::jsonb)
			from public.agreements a
			where a.counterparty_contact_id = p_id and a.creator_id = v_uid
		)
	);
end;
$$;

-- Grants ---------------------------------------------------------------------------------------------

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_agreement(uuid) to authenticated;

revoke all on function public.get_dashboard() from public, anon;
revoke all on function public.get_calendar(date) from public, anon;
revoke all on function public.get_agreement_detail(uuid) from public, anon;
revoke all on function public.list_contacts_with_balance() from public, anon;
revoke all on function public.get_contact_detail(uuid) from public, anon;
grant execute on function public.get_dashboard() to authenticated;
grant execute on function public.get_calendar(date) to authenticated;
grant execute on function public.get_agreement_detail(uuid) to authenticated;
grant execute on function public.list_contacts_with_balance() to authenticated;
grant execute on function public.get_contact_detail(uuid) to authenticated;
