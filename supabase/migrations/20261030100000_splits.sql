-- F4-11: "Hesabı böl" (design 40–43, ADR-061). A split groups the payer's loan records, one per person: each
-- share is an ordinary single-payment loan shared with that person. Accepting, reporting and confirming the
-- payment are the existing agreement flows; nothing new in the agreement state machine, and no money moves.

create type public.split_mode as enum ('equal', 'amount', 'percent');
create type public.split_join_state as enum ('none', 'requested', 'approved');

create table public.splits (
	id uuid primary key default gen_random_uuid(),
	owner_id uuid not null references public.profiles (id) on delete cascade,
	title text not null check (char_length(title) between 1 and 80),
	total_minor bigint not null check (total_minor > 0),
	spent_on date not null,
	mode public.split_mode not null,
	-- The QR code and the link carry this code (paramnet.app/h/<code>); it stops working at join_expires_at.
	join_code text not null unique check (join_code ~ '^[2-9A-HJ-NP-Z]{3}-[2-9A-HJ-NP-Z]{4}$'),
	join_expires_at timestamptz not null,
	idempotency_key uuid not null unique,
	row_version int not null default 1,
	created_at timestamptz not null default now()
);
create index splits_owner_id_idx on public.splits (owner_id);

create table public.split_members (
	id uuid primary key default gen_random_uuid(),
	split_id uuid not null references public.splits (id) on delete cascade,
	seq int not null,
	display_name text not null check (char_length(display_name) between 1 and 80),
	share_minor bigint not null check (share_minor >= 0),
	is_owner boolean not null default false,
	-- Who this share belongs to, once known: found by ParamNet ID, or the account that asked to join by link.
	profile_id uuid references public.profiles (id) on delete set null,
	join_state public.split_join_state not null default 'none',
	joined_via text check (joined_via in ('paramnet_id', 'link', 'qr')),
	agreement_id uuid unique references public.agreements (id) on delete set null,
	requested_at timestamptz,
	created_at timestamptz not null default now(),
	unique (split_id, seq),
	check (not is_owner or (seq = 0 and agreement_id is null)),
	check (is_owner or share_minor > 0),
	check (join_state = 'none' or profile_id is not null)
);
create index split_members_profile_id_idx on public.split_members (profile_id);

-- Joins and decisions; payments and acceptances are read from the members' agreement events.
create table public.split_events (
	id bigint generated always as identity primary key,
	split_id uuid not null references public.splits (id) on delete cascade,
	member_id uuid references public.split_members (id) on delete set null,
	actor_id uuid references public.profiles (id) on delete set null,
	type text not null check (type in ('created', 'join_requested', 'join_approved', 'join_rejected', 'member_assigned')),
	payload jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now()
);
create index split_events_split_id_idx on public.split_events (split_id, id);
create index split_events_member_id_idx on public.split_events (member_id);
create index split_events_actor_id_idx on public.split_events (actor_id);

alter table public.splits enable row level security;
alter table public.split_members enable row level security;
alter table public.split_events enable row level security;

create function private.new_split_code() returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
	v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
	v_bytes bytea;
	v_code text;
begin
	loop
		v_bytes := extensions.gen_random_bytes(7);
		v_code := '';
		for i in 0..6 loop
			v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) & 31) + 1, 1);
			if i = 2 then
				v_code := v_code || '-';
			end if;
		end loop;
		exit when not exists (select 1 from public.splits where join_code = v_code);
	end loop;
	return v_code;
end;
$$;

-- One share as a single-payment loan from the payer to that person, with no due date.
create function private.create_share_agreement(p_split public.splits, p_member public.split_members, p_key uuid)
returns public.agreements
language plpgsql
set search_path = ''
as $$
declare
	v_ag public.agreements;
	v_id uuid;
begin
	v_id := (public.create_agreement(jsonb_build_object(
		'kind', 'loan', 'creator_role', 'creditor', 'title', p_split.title, 'description', null,
		'started_on', to_char(p_split.spent_on, 'YYYY-MM-DD'),
		'counterparty', jsonb_build_object('contact', jsonb_build_object('display_name', p_member.display_name,
			'phone_e164', null, 'kind', 'person')),
		'terms', jsonb_build_object('principal_minor', p_member.share_minor, 'down_payment_minor', 0, 'notes', null,
			'plan', jsonb_build_array(jsonb_build_object('seq', 1, 'due_date', null, 'amount_minor', p_member.share_minor)))
	), p_key) ->> 'agreement_id')::uuid;
	select * into v_ag from public.agreements where id = v_id;
	update public.split_members set agreement_id = v_ag.id where id = p_member.id;
	return v_ag;
end;
$$;

-- The person asked to join by link, so their account is known without a ParamNet ID search.
create function private.share_to_profile(p_ag public.agreements, p_target uuid) returns void
language plpgsql
set search_path = ''
as $$
begin
	update public.contacts set linked_profile_id = p_target
	where id = p_ag.counterparty_contact_id and linked_profile_id is null;
	insert into public.invites (agreement_id, version, target_profile_id, expires_at)
	values (p_ag.id, p_ag.active_version, p_target, now() + interval '7 days');
	update public.agreements
	set status = 'pending', pending_version = active_version, row_version = row_version + 1
	where id = p_ag.id;
	insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
	values (p_ag.id, p_ag.creator_id, 'app', 'shared', p_ag.active_version);
end;
$$;

create function private.lock_own_split_member(p_member_id uuid) returns public.split_members
language plpgsql
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_member public.split_members;
begin
	select m.* into v_member from public.split_members m
	join public.splits s on s.id = m.split_id
	where m.id = p_member_id and (s.owner_id = v_uid or m.profile_id = v_uid)
	for update of m;
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if not exists (select 1 from public.splits where id = v_member.split_id and owner_id = v_uid) then
		raise exception using message = 'forbidden', errcode = 'P0001';
	end if;
	return v_member;
end;
$$;

-- input: {title, total_minor, spent_on, mode, owner_share_minor, members: [{display_name, share_minor, paramnet_id}]}
-- A member with a ParamNet ID gets the share right away; the others are seats filled through the link.
create function public.create_split(p_input jsonb, p_idempotency_key uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_split public.splits;
	v_member public.split_members;
	v_ag public.agreements;
	v_title text;
	v_total bigint;
	v_owner_share bigint;
	v_spent date;
	v_mode public.split_mode;
	v_sum bigint;
	v_row jsonb;
	v_seq int := 0;
	v_share bigint;
	v_id text;
	v_result jsonb;
begin
	if p_idempotency_key is null then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'idempotency_key';
	end if;
	select * into v_split from public.splits where idempotency_key = p_idempotency_key;
	if found then
		if v_split.owner_id <> v_uid then
			raise exception using message = 'conflict', errcode = 'P0001';
		end if;
		return jsonb_build_object('split_id', v_split.id, 'replayed', true);
	end if;

	if jsonb_typeof(p_input) is distinct from 'object'
		or (select array_agg(k order by k) from jsonb_object_keys(p_input) as k)
			<> array['members', 'mode', 'owner_share_minor', 'spent_on', 'title', 'total_minor']
		or jsonb_typeof(p_input -> 'members') <> 'array'
		or jsonb_array_length(p_input -> 'members') not between 1 and 19
		or not private.is_minor(p_input -> 'total_minor') or not private.is_minor(p_input -> 'owner_share_minor') then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'input';
	end if;
	v_title := private.check_text(p_input -> 'title', 80, true);
	v_total := (p_input ->> 'total_minor')::bigint;
	v_owner_share := (p_input ->> 'owner_share_minor')::bigint;
	v_spent := private.try_date(p_input ->> 'spent_on');
	begin
		v_mode := (p_input ->> 'mode')::public.split_mode;
	exception when invalid_text_representation then
		v_mode := null;
	end;
	if v_total <= 0 or v_spent is null or v_mode is null or v_spent > private.today() then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'input';
	end if;
	v_sum := v_owner_share;
	for v_row in select value from jsonb_array_elements(p_input -> 'members') loop
		if jsonb_typeof(v_row) <> 'object' or not private.is_minor(v_row -> 'share_minor')
			or (v_row ->> 'share_minor')::bigint <= 0 then
			raise exception using message = 'validation_error', errcode = 'P0001', detail = 'share';
		end if;
		v_sum := v_sum + (v_row ->> 'share_minor')::bigint;
	end loop;
	if v_sum <> v_total then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'shares_total';
	end if;

	insert into public.splits (owner_id, title, total_minor, spent_on, mode, join_code, join_expires_at, idempotency_key)
	values (v_uid, v_title, v_total, v_spent, v_mode, private.new_split_code(), now() + interval '48 hours', p_idempotency_key)
	returning * into v_split;
	insert into public.split_members (split_id, seq, display_name, share_minor, is_owner, profile_id, join_state)
	values (v_split.id, 0, (select display_name from public.profiles where id = v_uid), v_owner_share, true, v_uid, 'approved');
	insert into public.split_events (split_id, actor_id, type) values (v_split.id, v_uid, 'created');

	for v_row in select value from jsonb_array_elements(p_input -> 'members') loop
		v_seq := v_seq + 1;
		v_share := (v_row ->> 'share_minor')::bigint;
		insert into public.split_members (split_id, seq, display_name, share_minor)
		values (v_split.id, v_seq, private.check_text(v_row -> 'display_name', 80, true), v_share)
		returning * into v_member;
		v_id := nullif(v_row ->> 'paramnet_id', '');
		if v_id is not null then
			v_ag := private.create_share_agreement(v_split, v_member,
				md5(p_idempotency_key::text || ':' || v_seq::text)::uuid);
			v_result := public.share_agreement_by_id(v_ag.id, v_id, v_ag.row_version);
			if v_result ->> 'status' <> 'shared' then
				-- Nothing is kept for a split with a share that could not be sent.
				raise exception using message = 'not_found', errcode = 'P0001', detail = v_result ->> 'status';
			end if;
			update public.split_members
			set profile_id = (select target_profile_id from public.invites where agreement_id = v_ag.id
					order by created_at desc limit 1),
				join_state = 'approved', joined_via = 'paramnet_id'
			where id = v_member.id;
		end if;
	end loop;
	return jsonb_build_object('split_id', v_split.id, 'replayed', false);
end;
$$;

-- What a member's share looks like now, from its agreement (state names in ADR-061).
create function private.split_member_json(p_member public.split_members, p_uid uuid, p_owner boolean) returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
	v_ag public.agreements;
	v_payment public.payments;
	v_state text;
	v_paid_at timestamptz;
begin
	if p_member.is_owner then
		v_state := 'payer';
	elsif p_member.agreement_id is null then
		v_state := case when p_member.join_state = 'requested' then 'requested' else 'open' end;
	else
		select * into v_ag from public.agreements where id = p_member.agreement_id;
		select * into v_payment from public.payments
		where agreement_id = v_ag.id and status = 'reported' order by created_at desc limit 1;
		v_state := case
			when v_ag.status in ('pending', 'countered') then 'invited'
			when v_ag.status = 'settled' then 'paid'
			when v_ag.status = 'disputed' then 'disputed'
			when v_ag.status in ('active', 'amendment_pending') and v_payment.id is not null then 'reported'
			when v_ag.status in ('active', 'amendment_pending') then 'accepted'
			else 'declined'
		end;
		if v_state = 'paid' then
			v_paid_at := v_ag.settled_at;
		end if;
	end if;
	return jsonb_build_object(
		'id', p_member.id,
		'display_name', p_member.display_name,
		'share_minor', p_member.share_minor,
		'is_owner', p_member.is_owner,
		'is_me', p_member.profile_id is not distinct from p_uid,
		'state', v_state,
		'joined_via', p_member.joined_via,
		'requested_at', p_member.requested_at,
		-- The agreement belongs to the payer and that member only.
		'agreement_id', case when p_owner or p_member.profile_id = p_uid then p_member.agreement_id end,
		'paid_minor', case when v_ag.id is null then 0 else v_ag.principal_minor - v_ag.outstanding_minor end,
		'reported_payment', case when v_payment.id is not null and (p_owner or p_member.profile_id = p_uid) then
			jsonb_build_object('id', v_payment.id, 'amount_minor', v_payment.amount_minor, 'reported_at', v_payment.created_at)
		end,
		'paid_at', v_paid_at
	);
end;
$$;

create function private.split_json(p_split public.splits, p_uid uuid) returns jsonb
language sql
stable
set search_path = ''
as $$
	with m as (
		select private.split_member_json(m, p_uid, p_split.owner_id = p_uid) as j, m.seq
		from public.split_members m where m.split_id = p_split.id
	),
	feed as (
		select e.type, e.created_at, m2.display_name as name, e.payload
		from public.split_events e
		left join public.split_members m2 on m2.id = e.member_id
		where e.split_id = p_split.id and e.type <> 'created'
		union all
		select ae.type, ae.created_at, m3.display_name, '{}'::jsonb
		from public.split_members m3
		join public.agreement_events ae on ae.agreement_id = m3.agreement_id
		where m3.split_id = p_split.id
			and ae.type in ('accepted', 'rejected', 'countered', 'payment_reported', 'payment_confirmed', 'payment_rejected')
	)
	select jsonb_build_object(
		'id', p_split.id,
		'title', p_split.title,
		'total_minor', p_split.total_minor,
		'spent_on', p_split.spent_on,
		'mode', p_split.mode,
		'is_owner', p_split.owner_id = p_uid,
		'owner_name', (select display_name from public.split_members where split_id = p_split.id and is_owner),
		-- Only the payer shares the code; a member keeps seeing the split without it.
		'join_code', case when p_split.owner_id = p_uid then p_split.join_code end,
		'join_expires_at', case when p_split.owner_id = p_uid then p_split.join_expires_at end,
		'collected_minor', (select coalesce(sum(case when (j ->> 'is_owner')::boolean then (j ->> 'share_minor')::bigint
			else (j ->> 'paid_minor')::bigint end), 0) from m),
		'members', (select coalesce(jsonb_agg(j order by seq), '[]'::jsonb) from m),
		'events', (select coalesce(jsonb_agg(jsonb_build_object('type', f.type, 'name', f.name, 'at', f.created_at,
			'via', f.payload ->> 'via') order by f.created_at desc), '[]'::jsonb)
			from (select * from feed order by created_at desc limit 30) f),
		'row_version', p_split.row_version
	);
$$;

-- The payer, and every account a share was given to or that asked for one.
create function public.get_split(p_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_split public.splits;
begin
	select s.* into v_split from public.splits s
	where s.id = p_id and (s.owner_id = v_uid
		or exists (select 1 from public.split_members m where m.split_id = s.id and m.profile_id = v_uid));
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	return private.split_json(v_split, v_uid);
end;
$$;

create function public.list_splits() returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce(jsonb_agg(jsonb_build_object(
		'id', s.id, 'title', s.title, 'total_minor', s.total_minor, 'spent_on', s.spent_on,
		'is_owner', s.owner_id = private.require_uid(),
		'owner_name', (select display_name from public.split_members where split_id = s.id and is_owner),
		'member_count', (select count(*) from public.split_members where split_id = s.id),
		'my_share_minor', (select share_minor from public.split_members where split_id = s.id
			and profile_id = private.require_uid() order by seq limit 1)
	) order by s.spent_on desc, s.created_at desc), '[]'::jsonb)
	from public.splits s
	where s.owner_id = private.require_uid()
		or exists (select 1 from public.split_members m where m.split_id = s.id and m.profile_id = private.require_uid());
$$;

-- Agreement detail links back to its split.
create function public.split_for_agreement(p_agreement_id uuid) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select jsonb_build_object('split_id', s.id, 'title', s.title)
	from public.split_members m
	join public.splits s on s.id = m.split_id
	where m.agreement_id = p_agreement_id
		and (s.owner_id = private.require_uid() or m.profile_id = private.require_uid());
$$;

-- What the link shows before joining: the split and the seats still open (design 43).
create function public.get_split_invite(p_code text) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_split public.splits;
begin
	select * into v_split from public.splits where join_code = upper(trim(p_code));
	if not found then
		return jsonb_build_object('status', 'not_found');
	end if;
	if v_split.owner_id = v_uid then
		return jsonb_build_object('status', 'owner', 'split_id', v_split.id);
	end if;
	if exists (select 1 from public.split_members where split_id = v_split.id and profile_id = v_uid) then
		return jsonb_build_object('status', 'member', 'split_id', v_split.id);
	end if;
	if v_split.join_expires_at <= now() then
		return jsonb_build_object('status', 'expired');
	end if;
	return jsonb_build_object(
		'status', 'open',
		'title', v_split.title,
		'total_minor', v_split.total_minor,
		'spent_on', v_split.spent_on,
		'owner_name', (select display_name from public.split_members where split_id = v_split.id and is_owner),
		'member_count', (select count(*) from public.split_members where split_id = v_split.id),
		'seats', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'display_name', m.display_name,
			'share_minor', m.share_minor) order by m.seq), '[]'::jsonb)
			from public.split_members m
			where m.split_id = v_split.id and not m.is_owner and m.profile_id is null)
	);
end;
$$;

-- "Bu benim": the person picks their seat; the payer approves before the share is sent (design 41).
create function public.request_split_join(p_code text, p_member_id uuid, p_via text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_split public.splits;
	v_member public.split_members;
begin
	if p_via is null or p_via not in ('link', 'qr') then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'via';
	end if;
	if not private.take_rate_limit('split:join:' || v_uid::text, interval '1 hour', 20) then
		raise exception using message = 'rate_limited', errcode = 'P0001';
	end if;
	select * into v_split from public.splits where join_code = upper(trim(p_code)) for update;
	if not found or v_split.owner_id = v_uid then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if exists (select 1 from public.split_members where split_id = v_split.id and profile_id = v_uid) then
		return jsonb_build_object('split_id', v_split.id, 'replayed', true);
	end if;
	if v_split.join_expires_at <= now() then
		raise exception using message = 'invalid_transition', errcode = 'P0001', detail = 'expired';
	end if;
	select * into v_member from public.split_members where id = p_member_id and split_id = v_split.id for update;
	if not found or v_member.is_owner then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if v_member.profile_id is not null then
		raise exception using message = 'invalid_transition', errcode = 'P0001', detail = 'taken';
	end if;
	update public.split_members
	set profile_id = v_uid, join_state = 'requested', joined_via = p_via, requested_at = now()
	where id = v_member.id;
	insert into public.split_events (split_id, member_id, actor_id, type, payload)
	values (v_split.id, v_member.id, v_uid, 'join_requested', jsonb_build_object('via', p_via));
	return jsonb_build_object('split_id', v_split.id, 'replayed', false);
end;
$$;

-- The payer approves (the share is sent to that account) or rejects (the seat opens again).
create function public.decide_split_join(p_member_id uuid, p_decision text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_member public.split_members;
	v_split public.splits;
	v_ag public.agreements;
begin
	v_member := private.lock_own_split_member(p_member_id);
	if p_decision is null or p_decision not in ('approve', 'reject') then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'decision';
	end if;
	if v_member.join_state <> 'requested' then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	select * into v_split from public.splits where id = v_member.split_id;
	if p_decision = 'reject' then
		update public.split_members set profile_id = null, join_state = 'none', joined_via = null, requested_at = null
		where id = v_member.id;
	else
		v_ag := private.create_share_agreement(v_split, v_member, gen_random_uuid());
		perform private.share_to_profile(v_ag, v_member.profile_id);
		update public.split_members set join_state = 'approved' where id = v_member.id;
	end if;
	insert into public.split_events (split_id, member_id, actor_id, type, payload)
	values (v_split.id, v_member.id, v_split.owner_id, case when p_decision = 'approve' then 'join_approved' else 'join_rejected' end,
		jsonb_build_object('via', v_member.joined_via));
	update public.splits set row_version = row_version + 1 where id = v_split.id;
	return private.split_json((select s from public.splits s where s.id = v_split.id), v_split.owner_id);
end;
$$;

-- "ParamNet ID ile ekle": an open seat goes to an account found by its ID (design 41).
create function public.assign_split_member(p_member_id uuid, p_paramnet_id text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_member public.split_members;
	v_split public.splits;
	v_ag public.agreements;
	v_result jsonb;
begin
	v_member := private.lock_own_split_member(p_member_id);
	if v_member.is_owner or v_member.profile_id is not null then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	select * into v_split from public.splits where id = v_member.split_id;
	v_ag := private.create_share_agreement(v_split, v_member, gen_random_uuid());
	v_result := public.share_agreement_by_id(v_ag.id, p_paramnet_id, v_ag.row_version);
	if v_result ->> 'status' <> 'shared' then
		raise exception using message = 'not_found', errcode = 'P0001', detail = v_result ->> 'status';
	end if;
	update public.split_members
	set profile_id = (select target_profile_id from public.invites where agreement_id = v_ag.id
			order by created_at desc limit 1),
		join_state = 'approved', joined_via = 'paramnet_id'
	where id = v_member.id;
	insert into public.split_events (split_id, member_id, actor_id, type)
	values (v_split.id, v_member.id, v_split.owner_id, 'member_assigned');
	update public.splits set row_version = row_version + 1 where id = v_split.id;
	return private.split_json((select s from public.splits s where s.id = v_split.id), v_split.owner_id);
end;
$$;

-- "Can'a hatırlat": at most once a day for each share still open.
create function public.remind_split_member(p_member_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_member public.split_members;
	v_split public.splits;
	v_ag public.agreements;
begin
	v_member := private.lock_own_split_member(p_member_id);
	select * into v_ag from public.agreements where id = v_member.agreement_id;
	if not found or v_ag.status not in ('pending', 'countered', 'active') then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if not private.take_rate_limit('split:remind:' || v_member.id::text, interval '1 day', 1) then
		raise exception using message = 'rate_limited', errcode = 'P0001';
	end if;
	select * into v_split from public.splits where id = v_member.split_id;
	perform private.notify(v_member.profile_id, 'splitReminder', jsonb_build_object(
		'agreement_id', v_ag.id, 'name', v_split.title, 'amount_minor', v_ag.outstanding_minor));
	return jsonb_build_object('status', 'sent');
end;
$$;

-- The reminder lands under "Hatırlatmalar" in the inbox.
create or replace function private.notification_category(p_template text) returns text
language sql
immutable
set search_path = ''
as $$
	select case
		when p_template in ('shareReceived', 'shareCountered', 'paymentReported', 'paymentPending', 'amendmentProposed', 'cancelRequested')
			then 'approval'
		when p_template in ('dueSoon', 'dueToday', 'overdue1', 'overdue7', 'splitReminder') then 'reminder'
		when p_template in ('paymentConfirmed', 'paymentRecorded', 'amendmentAccepted', 'cancelAccepted', 'settled',
			'shareAccepted', 'counterAccepted', 'forgiven', 'disputeResolved') then 'completed'
		else 'info'
	end;
$$;

-- Account deletion and export cover splits (ADR-039, ADR-061) ----------------------------------------------

create function private.erase_splits(p_uid uuid) returns void
language sql
set search_path = ''
as $$
	-- A split nobody else joined is only this person's data; otherwise names stay for the others.
	delete from public.splits s
	where s.owner_id = p_uid
		and not exists (select 1 from public.split_members m where m.split_id = s.id and not m.is_owner and m.profile_id is not null);
	update public.split_members set display_name = 'Silinmiş kullanıcı' where profile_id = p_uid;
	update public.split_members set profile_id = null, join_state = 'none'
	where profile_id = p_uid and not is_owner and agreement_id is null;
$$;

create or replace function public.delete_account_data(p_uid uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_phone text;
	v_avatar text;
	v_paramnet_id text;
	v_deleted int;
	v_kept int;
begin
	if not exists (select 1 from public.profiles where id = p_uid) then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	select phone_e164, avatar_path, paramnet_id into v_phone, v_avatar, v_paramnet_id from public.profiles where id = p_uid;
	perform set_config('paramnet.erasure', 'on', true);

	perform private.erase_splits(p_uid);

	-- Agreements no other account is party to are only this person's data.
	delete from public.agreements where creator_id = p_uid and counterparty_profile_id is null;
	get diagnostics v_deleted = row_count;
	select count(*) into v_kept from public.agreements where creator_id = p_uid or counterparty_profile_id = p_uid;

	-- Their address book: entries still behind a kept agreement lose name and number.
	delete from public.contacts c
	where c.owner_id = p_uid and not exists (select 1 from public.agreements a where a.counterparty_contact_id = c.id);
	update public.contacts set display_name = 'Silinmiş kişi', phone_e164 = null, linked_profile_id = null
	where owner_id = p_uid;
	-- Other people's contacts keep what they typed, but no longer point at this account.
	update public.contacts set linked_profile_id = null where linked_profile_id = p_uid;

	-- Their words and traces inside kept agreements; amounts, dates and statuses stay for the other side.
	update public.agreement_events set actor_phone_e164 = null, ip_hash = null, user_agent = null
	where actor_id = p_uid or (v_phone is not null and actor_phone_e164 = v_phone);
	update public.payments set note = null, attachment_path = null where reported_by = p_uid;
	update public.agreement_versions set reason = null where proposed_by = p_uid and reason is not null;
	update public.disputes set reason = '—' where opened_by = p_uid;
	update public.analytics_events set user_id = null where user_id = p_uid;

	-- Plans shared to this account by ID can no longer be decided; the expiry job returns them to their creators.
	update public.invites set expires_at = now() where target_profile_id = p_uid and status = 'active';

	-- Own accounts and records are nobody else's; their history and repeating rules go with them.
	delete from public.accounts where owner_id = p_uid;
	delete from public.budgets where owner_id = p_uid;
	delete from public.cards where owner_id = p_uid;
	delete from public.loans where owner_id = p_uid;

	delete from public.push_tokens where user_id = p_uid;
	delete from public.reminders where user_id = p_uid;
	delete from public.notification_outbox where user_id = p_uid;
	delete from public.notifications where user_id = p_uid;
	delete from public.consents where user_id = p_uid;
	delete from public.rate_limits where key like '%' || p_uid::text || '%';

	if v_paramnet_id is not null then
		insert into public.retired_paramnet_ids (paramnet_id) values (v_paramnet_id) on conflict do nothing;
	end if;
	update public.profiles
	set display_name = 'Silinmiş kullanıcı', phone_e164 = null, deleted_at = coalesce(deleted_at, now()),
		first_name = null, last_name = null, username = null, avatar_path = null, paramnet_id = null, id_discoverable = false
	where id = p_uid;

	perform set_config('paramnet.erasure', 'off', true);
	-- The photo file is removed by the delete-account edge function through the Storage API.
	return jsonb_build_object('deleted_agreements', v_deleted, 'kept_agreements', v_kept, 'avatar_path', v_avatar);
end;
$$;

create or replace function public.export_my_data() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
begin
	return jsonb_build_object(
		'exported_at', now(),
		'profile', (
			select jsonb_build_object('id', p.id, 'display_name', p.display_name, 'first_name', p.first_name,
				'last_name', p.last_name, 'username', p.username, 'phone_e164', p.phone_e164, 'paramnet_id', p.paramnet_id,
				'id_discoverable', p.id_discoverable, 'avatar_path', p.avatar_path, 'reminder_before_days', to_jsonb(p.reminder_before_days),
				'locale', p.locale, 'timezone', p.timezone, 'created_at', p.created_at)
			from public.profiles p where p.id = v_uid
		),
		'consents', (
			select coalesce(jsonb_agg(jsonb_build_object('document', c.document, 'version', c.version, 'accepted_at', c.accepted_at)
				order by c.accepted_at), '[]'::jsonb)
			from public.consents c where c.user_id = v_uid
		),
		'contacts', (
			select coalesce(jsonb_agg(jsonb_build_object('display_name', c.display_name, 'phone_e164', c.phone_e164,
				'kind', c.kind, 'created_at', c.created_at) order by c.created_at), '[]'::jsonb)
			from public.contacts c where c.owner_id = v_uid
		),
		'agreements', (
			select coalesce(jsonb_agg(public.get_agreement_detail(a.id) order by a.created_at), '[]'::jsonb)
			from public.agreements a
			where a.creator_id = v_uid or (a.counterparty_profile_id = v_uid and a.status <> 'personal')
		),
		'accounts', (
			select coalesce(jsonb_agg(private.account_json(a) order by a.created_at), '[]'::jsonb)
			from public.accounts a where a.owner_id = v_uid
		),
		'transactions', (
			select coalesce(jsonb_agg(private.transaction_json(t) order by t.occurred_on, t.created_at), '[]'::jsonb)
			from public.transactions t where t.owner_id = v_uid
		),
		'cards', (
			select coalesce(jsonb_agg(private.card_json(c) order by c.created_at), '[]'::jsonb)
			from public.cards c where c.owner_id = v_uid
		),
		'loans', (
			select coalesce(jsonb_agg(private.loan_json(l) order by l.created_at), '[]'::jsonb)
			from public.loans l where l.owner_id = v_uid
		),
		'splits', (
			select coalesce(jsonb_agg(private.split_json(s, v_uid) order by s.created_at), '[]'::jsonb)
			from public.splits s
			where s.owner_id = v_uid
				or exists (select 1 from public.split_members m where m.split_id = s.id and m.profile_id = v_uid)
		),
		'recurring_rules', (
			select coalesce(jsonb_agg(private.recurring_json(r) order by r.created_at), '[]'::jsonb)
			from public.recurring_rules r where r.owner_id = v_uid
		),
		'budgets', (
			select coalesce(jsonb_agg(jsonb_build_object('category', b.category, 'limit_minor', b.limit_minor)
				order by b.category), '[]'::jsonb)
			from public.budgets b where b.owner_id = v_uid
		),
		'notifications', (
			select coalesce(jsonb_agg(jsonb_build_object('template', n.template, 'payload', n.payload,
				'created_at', n.created_at, 'read_at', n.read_at) order by n.id), '[]'::jsonb)
			from public.notifications n where n.user_id = v_uid
		),
		'devices', (
			select coalesce(jsonb_agg(jsonb_build_object('platform', t.platform, 'last_seen_at', t.last_seen_at)), '[]'::jsonb)
			from public.push_tokens t where t.user_id = v_uid
		),
		'analytics_events', (
			select coalesce(jsonb_agg(jsonb_build_object('name', e.name, 'props', e.props, 'created_at', e.created_at)
				order by e.created_at), '[]'::jsonb)
			from public.analytics_events e where e.user_id = v_uid
		)
	);
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_agreement(uuid) to authenticated;
grant execute on function private.avatar_visible(text) to authenticated;

revoke all on function public.create_split(jsonb, uuid) from public, anon;
revoke all on function public.get_split(uuid) from public, anon;
revoke all on function public.list_splits() from public, anon;
revoke all on function public.split_for_agreement(uuid) from public, anon;
revoke all on function public.get_split_invite(text) from public, anon;
revoke all on function public.request_split_join(text, uuid, text) from public, anon;
revoke all on function public.decide_split_join(uuid, text) from public, anon;
revoke all on function public.assign_split_member(uuid, text) from public, anon;
revoke all on function public.remind_split_member(uuid) from public, anon;
grant execute on function public.create_split(jsonb, uuid) to authenticated;
grant execute on function public.get_split(uuid) to authenticated;
grant execute on function public.list_splits() to authenticated;
grant execute on function public.split_for_agreement(uuid) to authenticated;
grant execute on function public.get_split_invite(text) to authenticated;
grant execute on function public.request_split_join(text, uuid, text) to authenticated;
grant execute on function public.decide_split_join(uuid, text) to authenticated;
grant execute on function public.assign_split_member(uuid, text) to authenticated;
grant execute on function public.remind_split_member(uuid) to authenticated;
