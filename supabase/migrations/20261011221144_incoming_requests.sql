-- F2-06: in-app side of sharing (S13, S14, S19 "Paylaşımlar").

-- deep-links.md: the token resolves to the agreement only for the account whose verified number is
-- the invite's target; anyone else learns just who shared it.
create function public.resolve_invite(p_token text) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_invite public.invites := private.invite_by_token(p_token);
	v_status text;
	v_creator text;
	v_mine boolean;
begin
	if v_invite.id is null then
		return jsonb_build_object('status', 'invalid');
	end if;
	v_status := private.invite_status_now(v_invite);
	select p.display_name into v_creator
	from public.agreements a join public.profiles p on p.id = a.creator_id
	where a.id = v_invite.agreement_id;
	v_mine := v_invite.target_phone_e164 = (select phone_e164 from public.profiles where id = v_uid);
	return jsonb_build_object(
		'status', v_status,
		'creator_name', v_creator,
		'mismatch', not v_mine,
		'agreement_id', case when v_mine and v_status = 'active' then v_invite.agreement_id end
	);
end;
$$;

-- Whose turn it is on a shared agreement, or null.
create function private.decision_actor(p_agreement public.agreements, p_uid uuid) returns text
language sql
stable
set search_path = ''
as $$
	select case
		when p_agreement.status = 'countered' and p_agreement.creator_id = p_uid then 'creator'
		when p_agreement.status = 'pending' and p_agreement.creator_id <> p_uid and (
			p_agreement.counterparty_profile_id = p_uid
			or (
				p_agreement.counterparty_profile_id is null
				and exists (
					select 1 from public.invites i
					where i.agreement_id = p_agreement.id and i.status = 'active' and i.expires_at > now()
						and i.target_phone_e164 = (select phone_e164 from public.profiles where id = p_uid)
				)
			)
		) then 'counterparty'
	end;
$$;

-- S14 / "Öneriyi incele": current terms, proposed terms (version + hash to decide on), from my side.
create function public.get_pending_decision(p_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_ag public.agreements;
	v_actor text;
	v_current public.agreement_versions;
	v_proposed public.agreement_versions;
begin
	select * into v_ag from public.agreements where id = p_id;
	v_actor := case when found then private.decision_actor(v_ag, v_uid) end;
	if v_actor is null then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	select * into v_current from public.agreement_versions where agreement_id = p_id and version = v_ag.active_version;
	select * into v_proposed from public.agreement_versions where agreement_id = p_id and version = v_ag.pending_version;
	return jsonb_build_object(
		'agreement_id', v_ag.id,
		'title', v_ag.title,
		'actor', v_actor,
		'other_name', case
			when v_actor = 'creator' then (select display_name from public.profiles where id = v_ag.counterparty_profile_id)
			else (select display_name from public.profiles where id = v_ag.creator_id)
		end,
		'my_role', private.my_role(v_ag, v_uid),
		'version', v_proposed.version,
		'terms_hash', v_proposed.terms_hash,
		'current', v_current.terms,
		'proposed', v_proposed.terms,
		-- The creator's "no" to a counter offer is withdraw_share, not a rejection.
		'can_reject', v_actor = 'counterparty',
		'payments', (
			select coalesce(jsonb_agg(jsonb_build_object('amount_minor', p.amount_minor, 'paid_on', p.paid_on, 'kind', p.kind) order by p.paid_on, p.created_at), '[]'::jsonb)
			from public.payments p where p.agreement_id = p_id and p.status = 'confirmed'
		)
	);
end;
$$;

-- S19 "Paylaşımlar": shared plans waiting for me (an invite to my number, or my turn after a counter).
create function public.list_requests() returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
begin
	return (
		select coalesce(jsonb_agg(jsonb_build_object(
			'agreement_id', a.id,
			'kind', case when private.decision_actor(a, v_uid) = 'creator' then 'counter' else 'share' end,
			'title', a.title,
			'from_name', case
				when a.creator_id = v_uid then (select display_name from public.profiles where id = a.counterparty_profile_id)
				else (select display_name from public.profiles where id = a.creator_id)
			end,
			'my_role', private.my_role(a, v_uid),
			'principal_minor', a.principal_minor
		) order by a.created_at desc), '[]'::jsonb)
		from public.agreements a
		where a.status in ('pending', 'countered') and private.decision_actor(a, v_uid) is not null
	);
end;
$$;

-- Summary and dashboard additions for the sharing screens -------------------------------------------

create or replace function private.agreement_summary(p_agreement public.agreements, p_uid uuid, p_today date) returns jsonb
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
		-- Which actions apply depends on whether I created it (S11 primary action table).
		'is_creator', p_agreement.creator_id = p_uid,
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

create or replace function public.get_dashboard() returns jsonb
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
		-- Reported payments I have to confirm plus shared plans waiting for my answer (S19).
		'pending_count', (
			select count(*) from public.payments p
			join public.agreements a on a.id = p.agreement_id
			where p.status = 'reported' and p.reported_by <> v_uid
				and (a.creator_id = v_uid or a.counterparty_profile_id = v_uid) and a.status <> 'personal'
				and private.my_role(a, v_uid) = 'creditor'
		) + jsonb_array_length(public.list_requests()),
		'has_agreements', exists (
			select 1 from public.agreements a
			where a.creator_id = v_uid or (a.counterparty_profile_id = v_uid and a.status <> 'personal')
		)
	);
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_agreement(uuid) to authenticated;

revoke all on function public.resolve_invite(text) from public, anon;
revoke all on function public.get_pending_decision(uuid) from public, anon;
revoke all on function public.list_requests() from public, anon;
grant execute on function public.resolve_invite(text) to authenticated;
grant execute on function public.get_pending_decision(uuid) to authenticated;
grant execute on function public.list_requests() to authenticated;
