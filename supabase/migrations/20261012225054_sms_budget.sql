-- F3-05: SMS budget and a per-number cap (spec 17 "SMS maliyeti ve kötüye kullanım", ADR-041). Every SMS
-- (Auth sign-in and web invite) asks here first. The daily total caps cost even if every other limit is
-- bypassed; the per-number cap stops a single number from being flooded (SMS pumping).

create table public.sms_usage (
	day date primary key,
	count int not null default 0 check (count >= 0),
	updated_at timestamptz not null default now()
);
alter table public.sms_usage enable row level security;

create function public.take_sms_budget(p_channel text, p_phone text, p_daily_limit int) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_used int;
	v_warning int;
begin
	if p_channel is null or p_channel not in ('auth', 'invite') or p_daily_limit is null or p_daily_limit < 1 then
		raise exception using message = 'validation_error', errcode = 'P0001';
	end if;
	-- The key holds a hash, so the rate limit table never stores a number.
	if not private.take_rate_limit('sms:phone:' || encode(sha256(convert_to(coalesce(p_phone, ''), 'UTF8')), 'hex'), interval '1 hour', 5) then
		return jsonb_build_object('allowed', false, 'alarm', null, 'limit', p_daily_limit, 'reason', 'phone_limit', 'used', null);
	end if;

	insert into public.sms_usage (day, count) values ((now() at time zone 'Europe/Istanbul')::date, 1)
	on conflict (day) do update set count = public.sms_usage.count + 1, updated_at = now()
	returning count into v_used;
	v_warning := ceil(p_daily_limit * 0.8);
	return jsonb_build_object(
		'allowed', v_used <= p_daily_limit,
		-- Each alarm fires once a day: when 80 % is reached and on the first refusal.
		'alarm', case when v_used = v_warning and v_used <= p_daily_limit then 'warning' when v_used = p_daily_limit + 1 then 'exhausted' end,
		'limit', p_daily_limit,
		'used', v_used
	);
end;
$$;

revoke all on function public.take_sms_budget(text, text, int) from public, anon, authenticated;
grant execute on function public.take_sms_budget(text, text, int) to service_role;
