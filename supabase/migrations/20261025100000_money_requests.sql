-- F4-08: "Para iste" and the hand-over of the money (design 16–20, 17; ADR-058).
-- A request is an ordinary loan record created by the borrower and shared by ParamNet ID; nothing new in the
-- agreement state machine. The hand-over is a separate confirmation inside "active": the lender reports
-- that the money was given, the borrower confirms receiving it.

alter table public.agreements
	add column delivery_required boolean not null default false,
	add column delivery_reported_at timestamptz,
	add column delivery_confirmed_at timestamptz,
	add constraint agreements_delivery_check check (
		(delivery_reported_at is null or delivery_required)
		and (delivery_confirmed_at is null or delivery_reported_at is not null)
	);

-- The lender of a loan, whoever created the record.
create function private.creditor_of(p_ag public.agreements) returns uuid
language sql
immutable
set search_path = ''
as $$
	select case when p_ag.creator_role = 'creditor' then p_ag.creator_id else p_ag.counterparty_profile_id end;
$$;

create function private.debtor_of(p_ag public.agreements) returns uuid
language sql
immutable
set search_path = ''
as $$
	select case when p_ag.creator_role = 'debtor' then p_ag.creator_id else p_ag.counterparty_profile_id end;
$$;

-- "Para iste": the borrower's loan record shared with the lender in one step; the money is still to come.
create function public.request_money(p_input jsonb, p_paramnet_id text, p_idempotency_key uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_created jsonb;
	v_ag public.agreements;
	v_share jsonb;
begin
	if jsonb_typeof(p_input) is distinct from 'object'
		or p_input ->> 'kind' is distinct from 'loan' or p_input ->> 'creator_role' is distinct from 'debtor' then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'request';
	end if;
	v_created := public.create_agreement(p_input, p_idempotency_key);
	select * into v_ag from public.agreements where id = (v_created ->> 'agreement_id')::uuid;
	if (v_created ->> 'replayed')::boolean then
		return jsonb_build_object('agreement_id', v_ag.id, 'status', 'shared', 'replayed', true);
	end if;
	v_share := public.share_agreement_by_id(v_ag.id, p_paramnet_id, v_ag.row_version);
	if v_share ->> 'status' <> 'shared' then
		-- Nothing is kept for a request that could not be sent.
		raise exception using message = 'not_found', errcode = 'P0001', detail = v_share ->> 'status';
	end if;
	update public.agreements set delivery_required = true where id = v_ag.id;
	return jsonb_build_object('agreement_id', v_ag.id, 'status', 'shared', 'display_name', v_share ->> 'display_name',
		'expires_at', v_share ->> 'expires_at', 'replayed', false);
end;
$$;

create function private.delivery_json(p_ag public.agreements, p_uid uuid) returns jsonb
language sql
stable
set search_path = ''
as $$
	select jsonb_build_object(
		'required', p_ag.delivery_required,
		'reported_at', p_ag.delivery_reported_at,
		'confirmed_at', p_ag.delivery_confirmed_at,
		'my_role', case when private.creditor_of(p_ag) = p_uid then 'creditor' else 'debtor' end,
		'status', p_ag.status,
		'row_version', p_ag.row_version
	);
$$;

create function public.get_delivery(p_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_ag public.agreements;
begin
	select * into v_ag from public.agreements
	where id = p_id and (creator_id = v_uid or (counterparty_profile_id = v_uid and status <> 'personal'));
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	return private.delivery_json(v_ag, v_uid);
end;
$$;

-- p_step 'report': the lender says the money was given. 'confirm': the borrower says it was received.
create function private.delivery_step(p_id uuid, p_row_version int, p_step text) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_ag public.agreements;
begin
	select * into v_ag from public.agreements where id = p_id for update;
	if not found or (v_ag.creator_id <> v_uid and v_ag.counterparty_profile_id is distinct from v_uid) then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if (p_step = 'report' and private.creditor_of(v_ag) is distinct from v_uid)
		or (p_step = 'confirm' and private.debtor_of(v_ag) is distinct from v_uid) then
		raise exception using message = 'forbidden', errcode = 'P0001';
	end if;
	if v_ag.status <> 'active' or not v_ag.delivery_required
		or (p_step = 'report' and v_ag.delivery_reported_at is not null)
		or (p_step = 'confirm' and (v_ag.delivery_reported_at is null or v_ag.delivery_confirmed_at is not null)) then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if v_ag.row_version <> p_row_version then
		raise exception using message = 'conflict', errcode = 'P0001';
	end if;
	update public.agreements
	set delivery_reported_at = case when p_step = 'report' then now() else delivery_reported_at end,
		delivery_confirmed_at = case when p_step = 'confirm' then now() else delivery_confirmed_at end,
		row_version = row_version + 1
	where id = p_id
	returning * into v_ag;
	insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
	values (p_id, v_uid, 'app', case when p_step = 'report' then 'delivery_reported' else 'delivery_confirmed' end,
		v_ag.active_version);
	return private.delivery_json(v_ag, v_uid);
end;
$$;

create function public.report_delivery(p_id uuid, p_row_version int) returns jsonb
language sql
security definer
set search_path = ''
as $$
	select private.delivery_step(p_id, p_row_version, 'report');
$$;

create function public.confirm_delivery(p_id uuid, p_row_version int) returns jsonb
language sql
security definer
set search_path = ''
as $$
	select private.delivery_step(p_id, p_row_version, 'confirm');
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_agreement(uuid) to authenticated;
grant execute on function private.avatar_visible(text) to authenticated;

revoke all on function public.request_money(jsonb, text, uuid) from public, anon;
revoke all on function public.get_delivery(uuid) from public, anon;
revoke all on function public.report_delivery(uuid, int) from public, anon;
revoke all on function public.confirm_delivery(uuid, int) from public, anon;
grant execute on function public.request_money(jsonb, text, uuid) to authenticated;
grant execute on function public.get_delivery(uuid) to authenticated;
grant execute on function public.report_delivery(uuid, int) to authenticated;
grant execute on function public.confirm_delivery(uuid, int) to authenticated;
