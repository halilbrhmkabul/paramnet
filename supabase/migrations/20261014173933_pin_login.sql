-- F4-01b: sign-in with a 6-digit PIN (ADR-046) and the server-side account lock (ADR-049). The pin-login
-- edge function is the only way in with a PIN: GoTrue stores a password derived from the PIN with a
-- server secret, so the client cannot bypass the lock by calling Auth directly.

-- Failed attempts per number. The key is a hash, so the table never stores a number.
create table public.pin_login_attempts (
	phone_hash text primary key,
	failed_count int not null default 0 check (failed_count between 0 and 5),
	last_failed_at timestamptz,
	locked_until timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);
alter table public.pin_login_attempts enable row level security;

-- Accounts that have set a PIN; accounts from before F4-01b have no row and are sent to set one.
create table public.user_pins (
	user_id uuid primary key references auth.users (id) on delete cascade,
	pin_set_at timestamptz not null default now(),
	created_at timestamptz not null default now()
);
alter table public.user_pins enable row level security;

create function private.pin_phone_hash(p_phone text) returns text
language sql
immutable
set search_path = ''
as $$
	select encode(sha256(convert_to(coalesce(p_phone, ''), 'UTF8')), 'hex');
$$;

create function public.pin_login_check(p_phone text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_locked_until timestamptz;
begin
	select locked_until into v_locked_until
	from public.pin_login_attempts
	where phone_hash = private.pin_phone_hash(p_phone);
	if v_locked_until is not null and v_locked_until > now() then
		return jsonb_build_object('locked', true, 'retry_after_s', ceil(extract(epoch from v_locked_until - now()))::int);
	end if;
	return jsonb_build_object('locked', false);
end;
$$;

-- 5 failures within 15 minutes lock the number for 15 minutes; a success clears the count.
create function public.pin_login_record(p_phone text, p_ok boolean) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_hash text := private.pin_phone_hash(p_phone);
	v_count int;
	v_locked_until timestamptz;
begin
	if p_ok then
		delete from public.pin_login_attempts where phone_hash = v_hash;
		return jsonb_build_object('locked', false, 'attempts_left', 5);
	end if;

	insert into public.pin_login_attempts as a (phone_hash, failed_count, last_failed_at)
	values (v_hash, 1, now())
	on conflict (phone_hash) do update set
		-- An expired lock or a quiet quarter of an hour starts the count again.
		failed_count = case
			when a.locked_until is not null or a.last_failed_at < now() - interval '15 minutes' then 1
			else a.failed_count + 1
		end,
		locked_until = null,
		last_failed_at = now(),
		updated_at = now()
	returning failed_count into v_count;

	if v_count >= 5 then
		v_locked_until := now() + interval '15 minutes';
		update public.pin_login_attempts set locked_until = v_locked_until where phone_hash = v_hash;
		return jsonb_build_object('locked', true, 'attempts_left', 0, 'retry_after_s', 900);
	end if;
	return jsonb_build_object('locked', false, 'attempts_left', 5 - v_count);
end;
$$;

-- Called by pin-set after the derived password is stored.
create function public.pin_mark_set(p_uid uuid, p_phone text) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	insert into public.user_pins (user_id) values (p_uid)
	on conflict (user_id) do update set pin_set_at = now();
	delete from public.pin_login_attempts where phone_hash = private.pin_phone_hash(p_phone);
end;
$$;

create function public.has_pin() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (select 1 from public.user_pins where user_id = auth.uid());
$$;

-- Rows hold a number's hash; nothing is kept a day after the last failure or lock.
create function private.purge_pin_login_attempts(p_now timestamptz) returns void
language sql
set search_path = ''
as $$
	delete from public.pin_login_attempts
	where greatest(coalesce(locked_until, last_failed_at), last_failed_at) < p_now - interval '1 day';
$$;

select cron.schedule('purge-pin-login-attempts', '23 * * * *', $$select private.purge_pin_login_attempts(now())$$);

revoke all on function public.pin_login_check(text) from public, anon, authenticated;
revoke all on function public.pin_login_record(text, boolean) from public, anon, authenticated;
revoke all on function public.pin_mark_set(uuid, text) from public, anon, authenticated;
grant execute on function public.pin_login_check(text) to service_role;
grant execute on function public.pin_login_record(text, boolean) to service_role;
grant execute on function public.pin_mark_set(uuid, text) to service_role;
revoke all on function public.has_pin() from public, anon;
grant execute on function public.has_pin() to authenticated;
revoke all on function private.pin_phone_hash(text) from public, anon, authenticated;
revoke all on function private.purge_pin_login_attempts(timestamptz) from public, anon, authenticated;
