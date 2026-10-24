-- F4-02a: ParamNet ID (ADR-050) and the profile fields of design 04/35 (ADR-051).
-- Lookups and shares by ID answer "not found" as a value, not an error: an error would roll back the
-- rate-limit counter too, and misses must count or IDs could be scanned.

-- Rules shared with packages/shared/src/profile-ids.ts (test-vectors/profile-ids.json) ----------------

create function private.normalize_paramnet_id(p_input text) returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
	v_code text := upper(regexp_replace(coalesce(p_input, ''), '[\s-]', '', 'g'));
begin
	-- Only an eight-character input carries the prefix: a code may itself start with "PN".
	if char_length(v_code) = 8 and left(v_code, 2) = 'PN' then
		v_code := substr(v_code, 3);
	end if;
	return case when v_code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$' then 'PN-' || v_code end;
end;
$$;

create function private.normalize_username(p_input text) returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
	v_name text := lower(regexp_replace(btrim(coalesce(p_input, '')), '^@', ''));
begin
	if v_name !~ '^[a-z0-9_.]{3,20}$' or v_name like '.%' or v_name like '%.' or v_name like '%..%'
		or v_name in ('paramnet', 'admin', 'destek', 'support', 'yardim', 'help') then
		return null;
	end if;
	return v_name;
end;
$$;

-- Profile columns -----------------------------------------------------------------------------------------

-- An ID that was ever used is never handed out again (BR-18).
create table public.retired_paramnet_ids (
	paramnet_id text primary key,
	retired_at timestamptz not null default now(),
	created_at timestamptz not null default now()
);
alter table public.retired_paramnet_ids enable row level security;

alter table public.profiles
	add column first_name text check (char_length(first_name) between 1 and 80),
	add column last_name text check (char_length(last_name) between 1 and 80),
	add column username text unique check (username = private.normalize_username(username)),
	add column avatar_path text check (char_length(avatar_path) <= 200),
	add column paramnet_id text unique check (paramnet_id ~ '^PN-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$'),
	add column paramnet_id_changed_at timestamptz,
	add column id_discoverable boolean not null default true,
	add column reminder_before_days int[] not null default '{3,0}'
		check (reminder_before_days <@ array[7, 3, 1, 0] and array_position(reminder_before_days, null) is null);

-- 32 symbols, so a random byte masked to five bits is unbiased.
create function private.new_paramnet_id() returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
	v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
	v_bytes bytea;
	v_id text;
begin
	loop
		v_bytes := extensions.gen_random_bytes(6);
		v_id := 'PN-';
		for i in 0..5 loop
			v_id := v_id || substr(v_alphabet, (get_byte(v_bytes, i) & 31) + 1, 1);
		end loop;
		exit when not exists (select 1 from public.profiles where paramnet_id = v_id)
			and not exists (select 1 from public.retired_paramnet_ids where paramnet_id = v_id);
	end loop;
	return v_id;
end;
$$;

-- "Ayşe Nur Yılmaz" → "Ayşe Nur" + "Yılmaz": Turkish double first names are common, surnames rarely.
create function private.split_name(p_name text) returns text[]
language sql
immutable
set search_path = ''
as $$
	select case
		when btrim(p_name) ~ '\s' then array[
			btrim(regexp_replace(btrim(p_name), '\s+\S+$', '')),
			substring(btrim(p_name) from '\S+$')
		]
		else array[btrim(p_name), null]
	end;
$$;

-- Every profile gets an ID and first/last name, whichever path creates it (complete_profile, tests, admin).
create function private.profiles_before_write() returns trigger
language plpgsql
set search_path = ''
as $$
declare
	v_parts text[];
begin
	if tg_op = 'INSERT' then
		if new.paramnet_id is null and new.deleted_at is null then
			new.paramnet_id := private.new_paramnet_id();
		end if;
		if new.first_name is null and new.deleted_at is null then
			v_parts := private.split_name(new.display_name);
			new.first_name := v_parts[1];
			new.last_name := v_parts[2];
		end if;
	else
		-- complete_profile only knows display_name; update_profile sets all three itself.
		if new.display_name is distinct from old.display_name
			and new.first_name is not distinct from old.first_name
			and new.last_name is not distinct from old.last_name then
			v_parts := private.split_name(new.display_name);
			new.first_name := v_parts[1];
			new.last_name := v_parts[2];
		end if;
	end if;
	if new.paramnet_id is not null and new.paramnet_id is distinct from (case when tg_op = 'UPDATE' then old.paramnet_id end)
		and exists (select 1 from public.retired_paramnet_ids where paramnet_id = new.paramnet_id) then
		raise exception using message = 'paramnet_id_retired', errcode = 'P0001';
	end if;
	return new;
end;
$$;

create trigger profiles_before_write
	before insert or update on public.profiles
	for each row execute function private.profiles_before_write();

-- Existing accounts.
update public.profiles
set paramnet_id = private.new_paramnet_id()
where paramnet_id is null and deleted_at is null;
update public.profiles p
set first_name = s.parts[1], last_name = s.parts[2]
from (select id, private.split_name(display_name) as parts from public.profiles where deleted_at is null) s
where p.id = s.id;

-- Own profile ---------------------------------------------------------------------------------------------

create function private.my_profile_json(p_profile public.profiles) returns jsonb
language sql
stable
set search_path = ''
as $$
	select jsonb_build_object(
		'id', p_profile.id,
		'first_name', p_profile.first_name,
		'last_name', p_profile.last_name,
		'display_name', p_profile.display_name,
		'username', p_profile.username,
		'phone_e164', p_profile.phone_e164,
		'paramnet_id', p_profile.paramnet_id,
		'id_discoverable', p_profile.id_discoverable,
		'can_regenerate_at', p_profile.paramnet_id_changed_at + interval '30 days',
		'avatar_path', p_profile.avatar_path,
		'reminder_before_days', to_jsonb(p_profile.reminder_before_days)
	);
$$;

create function public.get_my_profile() returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_profile public.profiles;
begin
	select * into v_profile from public.profiles where id = private.require_uid();
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	return private.my_profile_json(v_profile);
end;
$$;

create function public.update_profile(p_first_name text, p_last_name text, p_username text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_first text := private.check_text(to_jsonb(btrim(coalesce(p_first_name, ''))), 40, true);
	v_last text := nullif(btrim(coalesce(p_last_name, '')), '');
	v_username text;
	v_profile public.profiles;
begin
	if v_first is null then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'first_name';
	end if;
	if v_last is not null then
		v_last := private.check_text(to_jsonb(v_last), 40, true);
	end if;
	if nullif(btrim(coalesce(p_username, '')), '') is not null then
		v_username := private.normalize_username(p_username);
		if v_username is null then
			raise exception using message = 'validation_error', errcode = 'P0001', detail = 'username';
		end if;
	end if;

	begin
		update public.profiles
		set first_name = v_first,
			last_name = v_last,
			display_name = v_first || coalesce(' ' || v_last, ''),
			username = v_username
		where id = v_uid and deleted_at is null
		returning * into v_profile;
	exception when unique_violation then
		raise exception using message = 'username_taken', errcode = 'P0001';
	end;
	if v_profile.id is null then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	return private.my_profile_json(v_profile);
end;
$$;

-- The form checks as you type; the counter keeps it from becoming a directory of who is on ParamNet.
create function public.check_username(p_username text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_username text;
begin
	if not private.take_rate_limit('username:check:' || v_uid::text, interval '1 hour', 30) then
		raise exception using message = 'rate_limited', errcode = 'P0001';
	end if;
	v_username := private.normalize_username(p_username);
	if v_username is null then
		return jsonb_build_object('status', 'invalid');
	end if;
	if exists (select 1 from public.profiles where username = v_username and id <> v_uid) then
		return jsonb_build_object('status', 'taken');
	end if;
	return jsonb_build_object('status', 'available');
end;
$$;

-- ParamNet ID: lookup, visibility, regeneration ---------------------------------------------------------

create function public.find_by_paramnet_id(p_paramnet_id text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_id text;
	v_found public.profiles;
begin
	-- Counted first, so a malformed or missing ID costs the same as a hit.
	if not private.take_rate_limit('pnid:find:' || v_uid::text, interval '1 hour', 20) then
		raise exception using message = 'rate_limited', errcode = 'P0001';
	end if;
	v_id := private.normalize_paramnet_id(p_paramnet_id);
	if v_id is null then
		return jsonb_build_object('status', 'invalid');
	end if;
	if v_id = (select paramnet_id from public.profiles where id = v_uid) then
		return jsonb_build_object('status', 'self');
	end if;
	-- BR-17: hidden, deleted and unknown IDs look the same.
	select * into v_found from public.profiles
	where paramnet_id = v_id and id_discoverable and deleted_at is null;
	if not found then
		return jsonb_build_object('status', 'not_found');
	end if;
	return jsonb_build_object('status', 'found', 'display_name', v_found.display_name, 'paramnet_id', v_found.paramnet_id);
end;
$$;

create function public.set_id_discoverable(p_on boolean) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
	if p_on is null then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'id_discoverable';
	end if;
	update public.profiles set id_discoverable = p_on where id = private.require_uid();
	return jsonb_build_object('id_discoverable', p_on);
end;
$$;

create function public.regenerate_paramnet_id() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_profile public.profiles;
begin
	select * into v_profile from public.profiles where id = private.require_uid() and deleted_at is null for update;
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if v_profile.paramnet_id_changed_at > now() - interval '30 days' then
		raise exception using message = 'rate_limited', errcode = 'P0001', detail = 'paramnet_id';
	end if;
	insert into public.retired_paramnet_ids (paramnet_id) values (v_profile.paramnet_id);
	update public.profiles
	set paramnet_id = private.new_paramnet_id(), paramnet_id_changed_at = now()
	where id = v_profile.id
	returning * into v_profile;
	return jsonb_build_object('paramnet_id', v_profile.paramnet_id, 'can_regenerate_at', v_profile.paramnet_id_changed_at + interval '30 days');
end;
$$;

-- Sharing by ID: an invite bound to an account instead of a number -------------------------------------------

alter table public.invites
	alter column token_hash drop not null,
	alter column target_phone_e164 drop not null,
	add column target_profile_id uuid references public.profiles (id) on delete cascade,
	add constraint invites_one_target check ((target_phone_e164 is null) <> (target_profile_id is null)),
	-- The account is already known: no link, so nothing to guess or forward.
	add constraint invites_token_iff_phone check ((token_hash is null) = (target_profile_id is not null));
create index invites_target_profile_idx on public.invites (target_profile_id) where status = 'active';

-- BR-11: who an invite is for. Never null: callers negate it, and `not null` would let a stranger through.
create function private.invite_is_for(p_invite public.invites, p_uid uuid) returns boolean
language sql
stable
set search_path = ''
as $$
	select coalesce(p_invite.target_profile_id = p_uid, false)
		or coalesce(p_invite.target_phone_e164 = (select phone_e164 from public.profiles where id = p_uid), false);
$$;

create function public.share_agreement_by_id(p_id uuid, p_paramnet_id text, p_row_version int) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_ag public.agreements;
	v_id text;
	v_target public.profiles;
	v_expires timestamptz := now() + interval '7 days';
begin
	v_ag := private.lock_own_agreement(p_id);
	if v_ag.status <> 'personal' then
		raise exception using message = 'invalid_transition', errcode = 'P0001';
	end if;
	if v_ag.row_version <> p_row_version then
		raise exception using message = 'conflict', errcode = 'P0001';
	end if;

	v_id := private.normalize_paramnet_id(p_paramnet_id);
	if v_id is null then
		return jsonb_build_object('status', 'invalid');
	end if;
	if v_id = (select paramnet_id from public.profiles where id = v_ag.creator_id) then
		return jsonb_build_object('status', 'self');
	end if;
	select * into v_target from public.profiles
	where paramnet_id = v_id and id_discoverable and deleted_at is null;
	if not found then
		-- A miss is a lookup: sharing must not be a way around the search limit.
		if not private.take_rate_limit('pnid:find:' || v_ag.creator_id::text, interval '1 hour', 20) then
			raise exception using message = 'rate_limited', errcode = 'P0001';
		end if;
		return jsonb_build_object('status', 'not_found');
	end if;
	if not private.take_rate_limit('pnid:share:' || v_ag.creator_id::text, interval '1 day', 10) then
		raise exception using message = 'rate_limited', errcode = 'P0001';
	end if;

	-- The contact points at the account; its number is never copied to the sharer.
	update public.contacts set linked_profile_id = v_target.id
	where id = v_ag.counterparty_contact_id and linked_profile_id is null;

	insert into public.invites (agreement_id, version, target_profile_id, expires_at)
	values (p_id, v_ag.active_version, v_target.id, v_expires);
	update public.agreements
	set status = 'pending', pending_version = active_version, row_version = row_version + 1
	where id = p_id;
	insert into public.agreement_events (agreement_id, actor_id, channel, type, version)
	values (p_id, v_ag.creator_id, 'app', 'shared', v_ag.active_version);

	return jsonb_build_object('status', 'shared', 'display_name', v_target.display_name, 'expires_at', v_expires);
end;
$$;

-- Decisions accept either kind of invite -------------------------------------------------------------------

create or replace function private.decision_actor(p_agreement public.agreements, p_uid uuid) returns text
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
						and private.invite_is_for(i, p_uid)
				)
			)
		) then 'counterparty'
		when p_agreement.status in ('amendment_pending', 'disputed') and p_agreement.pending_version is not null
			and private.is_party(p_agreement, p_uid)
			and (select proposed_by from public.agreement_versions v where v.agreement_id = p_agreement.id and v.version = p_agreement.pending_version) <> p_uid
			then 'amendment'
	end;
$$;

create or replace function public.decide_agreement(
	p_id uuid,
	p_version int,
	p_terms_hash text,
	p_decision text,
	p_counter_terms jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
	v_me public.profiles;
	v_ag public.agreements;
	v_invite public.invites;
begin
	if v_uid is null then
		raise exception 'not_authenticated' using errcode = '28000';
	end if;
	select * into v_me from public.profiles where id = v_uid;
	select * into v_ag from public.agreements where id = p_id for update;
	if not found then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	if v_ag.creator_id = v_uid then
		raise exception using message = 'forbidden', errcode = 'P0001';
	end if;
	select * into v_invite from public.invites
	where agreement_id = p_id and status = 'active' and expires_at > now()
	order by created_at desc
	limit 1;
	-- The counterparty is either already linked, or the invite names their account or verified number (BR-11).
	if not (
		v_ag.counterparty_profile_id is not distinct from v_uid
		or (v_ag.counterparty_profile_id is null and v_invite.id is not null and private.invite_is_for(v_invite, v_uid))
	) or v_ag.status = 'personal' then
		raise exception using message = 'not_found', errcode = 'P0001';
	end if;
	return private.apply_decision(
		v_ag, v_invite.id, v_uid, v_me.phone_e164,
		case when p_decision = 'reject' then null else v_uid end,
		'app', p_version, p_terms_hash, p_decision, p_counter_terms, null, null
	);
end;
$$;

-- Sharing notices reach the invited account however it was invited.
create or replace function private.notify_agreement_event() returns trigger
language plpgsql
set search_path = ''
as $$
declare
	v_ag public.agreements;
	v_counterparty uuid;
	v_to uuid;
	v_template text;
begin
	select * into v_ag from public.agreements where id = new.agreement_id;

	if new.type = 'settled' then
		-- Spec 5.8: congratulations to both sides; a personal record has nobody to tell.
		if v_ag.counterparty_profile_id is not null then
			perform private.notify(v_ag.creator_id, 'settled', private.event_payload(v_ag, v_ag.creator_id));
			perform private.notify(v_ag.counterparty_profile_id, 'settled', private.event_payload(v_ag, v_ag.counterparty_profile_id));
		end if;
		return null;
	end if;

	-- Before the counterparty decides, their account is the invited one, or the one registered to the invited number.
	v_counterparty := coalesce(v_ag.counterparty_profile_id, (
		select coalesce(i.target_profile_id, p.id) from public.invites i
		left join public.profiles p on p.phone_e164 = i.target_phone_e164
		where i.agreement_id = v_ag.id
		order by i.created_at desc
		limit 1
	));
	-- What the creator does reaches the counterparty; everything else (app, web, expiry job) the creator.
	if new.actor_id is not distinct from v_ag.creator_id then
		v_to := v_counterparty;
		v_template := case new.type
			when 'shared' then 'shareReceived'
			when 'share_withdrawn' then 'shareWithdrawn'
			when 'accepted' then 'counterAccepted'
			when 'countered' then 'shareCountered'
		end;
	else
		v_to := v_ag.creator_id;
		v_template := case new.type
			when 'invite_expired' then 'inviteExpired'
			when 'accepted' then 'shareAccepted'
			when 'countered' then 'shareCountered'
			when 'rejected' then 'shareRejected'
		end;
	end if;
	if v_template is not null and v_to is not null then
		perform private.notify(v_to, v_template, private.event_payload(v_ag, v_to));
	end if;
	return null;
end;
$$;

-- Avatar (ADR-051) -----------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/jpeg']);

-- The other side of a shared agreement sees the photo; nobody else (not even an ID lookup, BR-17).
create function private.avatar_visible(p_owner text) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select p_owner = (select auth.uid())::text
		or exists (
			select 1 from public.agreements a
			where a.status <> 'personal'
				and ((a.creator_id::text = p_owner and a.counterparty_profile_id = (select auth.uid()))
					or (a.counterparty_profile_id::text = p_owner and a.creator_id = (select auth.uid())))
		);
$$;

create policy avatars_select on storage.objects
	for select to authenticated
	using (bucket_id = 'avatars' and private.avatar_visible((storage.foldername(name))[1]));
create policy avatars_insert_own on storage.objects
	for insert to authenticated
	with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_update_own on storage.objects
	for update to authenticated
	using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete_own on storage.objects
	for delete to authenticated
	using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- The app uploads to {uid}/{uuid}.jpg, then points the profile at it; the old file's path comes back so
-- the app can delete it.
create function public.set_avatar(p_path text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_previous text;
begin
	if p_path is not null and (
		p_path !~ ('^' || v_uid::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
		or not exists (select 1 from storage.objects where bucket_id = 'avatars' and name = p_path)
	) then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'avatar_path';
	end if;
	select avatar_path into v_previous from public.profiles where id = v_uid for update;
	update public.profiles set avatar_path = p_path where id = v_uid;
	return jsonb_build_object('avatar_path', p_path, 'previous_path', v_previous);
end;
$$;

-- The counterparty's photo travels with the agreement summaries and detail.
create or replace function private.counterparty_of(p_agreement public.agreements, p_uid uuid) returns jsonb
language sql
stable
set search_path = ''
as $$
	select case
		when p_agreement.creator_id = p_uid then (
			select jsonb_build_object('contact_id', c.id, 'display_name', c.display_name, 'kind', c.kind, 'phone_e164', c.phone_e164,
				'avatar_path', case when p_agreement.status <> 'personal'
					then (select avatar_path from public.profiles where id = p_agreement.counterparty_profile_id) end)
			from public.contacts c where c.id = p_agreement.counterparty_contact_id
		)
		else (
			select jsonb_build_object('contact_id', null, 'display_name', p.display_name, 'kind', 'person', 'phone_e164', p.phone_e164,
				'avatar_path', p.avatar_path)
			from public.profiles p where p.id = p_agreement.creator_id
		)
	end;
$$;

-- Grants ---------------------------------------------------------------------------------------------------

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_agreement(uuid) to authenticated;
grant execute on function private.avatar_visible(text) to authenticated;

revoke all on function public.get_my_profile() from public, anon;
revoke all on function public.update_profile(text, text, text) from public, anon;
revoke all on function public.check_username(text) from public, anon;
revoke all on function public.find_by_paramnet_id(text) from public, anon;
revoke all on function public.set_id_discoverable(boolean) from public, anon;
revoke all on function public.regenerate_paramnet_id() from public, anon;
revoke all on function public.share_agreement_by_id(uuid, text, int) from public, anon;
revoke all on function public.set_avatar(text) from public, anon;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.update_profile(text, text, text) to authenticated;
grant execute on function public.check_username(text) to authenticated;
grant execute on function public.find_by_paramnet_id(text) to authenticated;
grant execute on function public.set_id_discoverable(boolean) to authenticated;
grant execute on function public.regenerate_paramnet_id() to authenticated;
grant execute on function public.share_agreement_by_id(uuid, text, int) to authenticated;
grant execute on function public.set_avatar(text) to authenticated;
