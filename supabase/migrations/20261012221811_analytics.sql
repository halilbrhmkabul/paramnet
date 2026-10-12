-- F3-02: product analytics in our own database (spec 13, ADR-038). Most spec 13.3 events already exist
-- as rows (agreements, agreement_events, payments, reminders); this table only holds what happens
-- outside them: the app was opened, a notification was opened, an invite link was opened, the web OTP
-- passed. No personal data in props (spec 13.3); user_id is the pseudonymous account id.

create table public.analytics_events (
	id bigint generated always as identity primary key,
	name text not null check (name in ('app_opened', 'reminder_opened', 'invite_opened', 'invite_otp_verified')),
	user_id uuid references public.profiles (id) on delete set null,
	-- Web events belong to an invite, not an account; also counts an invite only once.
	invite_id uuid references public.invites (id) on delete set null,
	props jsonb not null default '{}'::jsonb check (jsonb_typeof(props) = 'object'),
	created_at timestamptz not null default now()
);
create index analytics_events_name_created_at_idx on public.analytics_events (name, created_at);
create index analytics_events_user_id_idx on public.analytics_events (user_id);
create index analytics_events_invite_id_idx on public.analytics_events (invite_id);
create unique index analytics_events_invite_once_idx on public.analytics_events (name, invite_id)
	where invite_id is not null;
-- Written by RPCs, read only by get_metrics (service role).
alter table public.analytics_events enable row level security;

-- track_event: the app's own events. Unknown names, unknown keys or odd values are refused, so nothing
-- personal can slip in; too many calls are dropped quietly (analytics must never break the app).
create function public.track_event(p_name text, p_props jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
	v_props jsonb := coalesce(p_props, '{}'::jsonb);
	v_valid boolean;
begin
	if v_uid is null then
		raise exception 'not_authenticated' using errcode = '28000';
	end if;
	v_valid := jsonb_typeof(v_props) = 'object' and case p_name
		when 'app_opened' then v_props = '{}'::jsonb
		when 'reminder_opened' then
			(select array_agg(k) from jsonb_object_keys(v_props) as k) = array['template']
			and coalesce(v_props ->> 'template', '') ~ '^[A-Za-z0-9]{1,40}$'
		when 'invite_opened' then v_props = '{"channel": "app"}'::jsonb
		else false
	end;
	if not coalesce(v_valid, false) then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'event';
	end if;
	if not private.take_rate_limit('track:' || v_uid::text, interval '1 hour', 60) then
		return jsonb_build_object('tracked', false);
	end if;
	insert into public.analytics_events (name, user_id, props) values (p_name, v_uid, v_props);
	return jsonb_build_object('tracked', true);
end;
$$;

-- Web invite events -------------------------------------------------------------------------------------

-- Same answer as before; the first open of each invite is counted. Only an analytics row is written, never
-- the invite, so link preview bots still cannot consume or change it (spec 11.2).
create or replace function public.invite_open(p_token text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_invite public.invites := private.invite_by_token(p_token);
begin
	if v_invite.id is null then
		return jsonb_build_object('status', 'invalid');
	end if;
	insert into public.analytics_events (name, invite_id, props)
	values ('invite_opened', v_invite.id, '{"channel": "web"}'::jsonb)
	on conflict (name, invite_id) where invite_id is not null do nothing;
	return jsonb_build_object(
		'status', private.invite_status_now(v_invite),
		'creator_name', (select p.display_name from public.agreements a join public.profiles p on p.id = a.creator_id where a.id = v_invite.agreement_id)
	);
end;
$$;

create or replace function public.invite_verify_otp(p_token text, p_phone text, p_code text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_invite public.invites := private.invite_by_token(p_token);
	v_phone text := private.normalize_phone_tr(p_phone);
	v_attempts int;
begin
	if v_invite.id is null or private.invite_status_now(v_invite) <> 'active' then
		return jsonb_build_object('ok', false, 'error', 'invite_unavailable');
	end if;
	if v_phone is not distinct from v_invite.target_phone_e164
		and v_invite.otp_hash is not null
		and v_invite.otp_expires_at > now()
		and v_invite.otp_hash = sha256(convert_to(v_invite.id::text || ':' || coalesce(p_code, ''), 'UTF8')) then
		update public.invites set otp_hash = null, otp_expires_at = null where id = v_invite.id;
		insert into public.analytics_events (name, invite_id) values ('invite_otp_verified', v_invite.id)
		on conflict (name, invite_id) where invite_id is not null do nothing;
		return jsonb_build_object('ok', true, 'invite_id', v_invite.id, 'phone', v_phone);
	end if;

	update public.invites
	set otp_attempts = least(otp_attempts + 1, 5),
		status = case when otp_attempts + 1 >= 5 then 'locked'::public.invite_status else status end
	where id = v_invite.id
	returning otp_attempts into v_attempts;
	return jsonb_build_object('ok', false, 'error', case when v_attempts >= 5 then 'locked' else 'otp_invalid' end);
end;
$$;

-- Metrics panel (spec 13.1–13.2) ----------------------------------------------------------------------

create function private.ratio(p_part bigint, p_whole bigint) returns numeric
language sql
immutable
set search_path = ''
as $$
	select case when p_whole = 0 then null else round(p_part::numeric / p_whole, 2) end;
$$;

-- Everything counted from the last p_days days, except the north star (always the last 7 days).
-- Service role only: run it from `pnpm metrics` or the SQL editor.
create function public.get_metrics(p_days int) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_from timestamptz;
	v_result jsonb;
begin
	if p_days is null or p_days not between 0 and 365 then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'days';
	end if;
	v_from := now() - make_interval(days => p_days);

	with signups as (
		select p.id, p.created_at,
			(select min(a.created_at) from public.agreements a where a.creator_id = p.id) as first_agreement_at
		from public.profiles p
		where p.created_at >= v_from
	),
	created as (
		select a.id,
			(select count(*) from public.installments i where i.agreement_id = a.id and i.version = 1) > 1 as installments,
			exists (select 1 from public.agreement_events e where e.agreement_id = a.id and e.type = 'shared') as shared,
			exists (select 1 from public.agreement_events e where e.agreement_id = a.id and e.type = 'accepted') as accepted
		from public.agreements a
		where a.created_at >= v_from
	),
	accepted_events as (
		select e.channel from public.agreement_events e where e.type = 'accepted' and e.created_at >= v_from
	),
	-- Payments the debtor reported on a shared agreement: did the creditor confirm them?
	reported as (
		select p.status from public.payments p
		join public.agreements a on a.id = p.agreement_id
		where p.created_at >= v_from and p.kind = 'payment' and a.status <> 'personal'
			and p.reported_by is distinct from (case when a.creator_role = 'creditor' then a.creator_id else a.counterparty_profile_id end)
			and p.status in ('reported', 'confirmed', 'rejected')
	),
	-- Users whose agreement settled, and whether they opened another one afterwards.
	settlers as (
		select a.creator_id, min(e.created_at) as settled_at
		from public.agreement_events e
		join public.agreements a on a.id = e.agreement_id
		where e.type = 'settled' and e.created_at >= v_from
		group by a.creator_id
	),
	retention as (
		select s.id,
			s.created_at <= now() - interval '14 days' as d7_eligible,
			s.created_at <= now() - interval '37 days' as d30_eligible,
			exists (select 1 from public.analytics_events x where x.user_id = s.id and x.name = 'app_opened'
				and x.created_at >= s.created_at + interval '7 days' and x.created_at < s.created_at + interval '14 days') as d7_active,
			exists (select 1 from public.analytics_events x where x.user_id = s.id and x.name = 'app_opened'
				and x.created_at >= s.created_at + interval '30 days' and x.created_at < s.created_at + interval '37 days') as d30_active
		from signups s
	)
	select jsonb_build_object(
		'window_days', p_days,
		'generated_at', now(),
		'signups', (select count(*) from signups),
		'activation_rate', private.ratio((select count(*) from signups where first_agreement_at is not null), (select count(*) from signups)),
		'median_first_agreement_seconds', (
			select round(percentile_cont(0.5) within group (order by extract(epoch from first_agreement_at - created_at)))
			from signups where first_agreement_at is not null
		),
		'agreements_created', (select count(*) from created),
		'installment_rate', private.ratio((select count(*) from created where installments), (select count(*) from created)),
		'share_rate', private.ratio((select count(*) from created where shared), (select count(*) from created)),
		'invite_acceptance_rate', private.ratio((select count(*) from created where shared and accepted), (select count(*) from created where shared)),
		'web_acceptance_share', private.ratio((select count(*) from accepted_events where channel = 'web'), (select count(*) from accepted_events)),
		'verified_payment_rate', private.ratio((select count(*) from reported where status = 'confirmed'), (select count(*) from reported)),
		'repeat_rate', private.ratio(
			(select count(*) from settlers s where exists (select 1 from public.agreements a where a.creator_id = s.creator_id and a.created_at > s.settled_at)),
			(select count(*) from settlers)
		),
		'weekly_active_agreements', (
			select count(distinct e.agreement_id) from public.agreement_events e
			where e.created_at >= now() - interval '7 days'
				and (e.type in ('accepted', 'countered', 'forgiven', 'settled') or e.type ~ '^(payment|amendment|dispute|cancel)_')
		),
		'd7_retention', private.ratio((select count(*) from retention where d7_eligible and d7_active), (select count(*) from retention where d7_eligible)),
		'd30_retention', private.ratio((select count(*) from retention where d30_eligible and d30_active), (select count(*) from retention where d30_eligible)),
		'reminders_sent', (select count(*) from public.reminders where status = 'sent' and fire_at >= v_from),
		'reminders_opened', (select count(*) from public.analytics_events where name = 'reminder_opened' and created_at >= v_from),
		'invites_opened_web', (select count(*) from public.analytics_events where name = 'invite_opened' and props ->> 'channel' = 'web' and created_at >= v_from),
		'invites_opened_app', (select count(*) from public.analytics_events where name = 'invite_opened' and props ->> 'channel' = 'app' and created_at >= v_from)
	) into v_result;
	return v_result;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_agreement(uuid) to authenticated;

revoke all on function public.track_event(text, jsonb) from public, anon;
grant execute on function public.track_event(text, jsonb) to authenticated;
revoke all on function public.get_metrics(int) from public, anon, authenticated;
grant execute on function public.get_metrics(int) to service_role;
