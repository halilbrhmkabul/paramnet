-- F1-18: push tokens, reminder scheduling and the notification outbox (spec 5.9).
-- Flow: pg_cron → private.enqueue_due_reminders() writes reminders (dedupe log) + notification_outbox;
-- pg_cron → private.trigger_dispatch() calls the dispatch-notifications edge function, which claims
-- outbox rows with the service role, sends them through the Expo Push API and reports back.

-- Push tokens ----------------------------------------------------------------------------------------

create function public.register_push_token(p_token text, p_platform text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
begin
	if v_uid is null then
		raise exception 'not_authenticated' using errcode = '28000';
	end if;
	if p_token is null or p_token !~ '^Expo(nent)?PushToken\[[^\]]+\]$' or p_platform is null or p_platform not in ('ios', 'android') then
		raise exception using message = 'validation_error', errcode = 'P0001';
	end if;
	-- A device belongs to whoever signed in last on it.
	insert into public.push_tokens (user_id, expo_token, platform, last_seen_at)
	values (v_uid, p_token, p_platform, now())
	on conflict (expo_token) do update
		set user_id = excluded.user_id, platform = excluded.platform, last_seen_at = excluded.last_seen_at;
	return jsonb_build_object('registered', true);
end;
$$;

create function public.unregister_push_token(p_token text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
begin
	if v_uid is null then
		raise exception 'not_authenticated' using errcode = '28000';
	end if;
	delete from public.push_tokens where expo_token = p_token and user_id = v_uid;
	return jsonb_build_object('removed', found);
end;
$$;

-- Reminder scheduling ----------------------------------------------------------------------------------

-- One reminder per installment, person and kind: reminders doubles as the "already sent" log.
create unique index reminders_once_idx on public.reminders (installment_id, user_id, kind)
	where installment_id is not null;

-- Spec 5.9: who gets what, relative to the due date, always at 10:00 Europe/Istanbul.
--   dueSoon  −3 days  debtor
--   dueToday  0       debtor and creditor
--   overdue1 +1 day   debtor (only while unpaid)
--   overdue7 +7 days  debtor and creditor
-- Nothing is queued in quiet hours (22:00–09:00); a missed slot is not sent later than 22:00 that day,
-- so a record created after its dates never fires a burst of stale reminders.
create function private.enqueue_due_reminders(p_now timestamptz default now()) returns int
language plpgsql
set search_path = ''
as $$
declare
	v_local_hour int := extract(hour from p_now at time zone 'Europe/Istanbul');
	v_count int;
begin
	if v_local_hour < 9 or v_local_hour >= 22 then
		return 0;
	end if;

	with recipients as (
		-- The creator always; the counterparty once the agreement is shared.
		select a.id as agreement_id, a.creator_id as user_id, a.creator_role as role
		from public.agreements a
		where a.status in ('personal', 'active', 'amendment_pending')
		union all
		select a.id, a.counterparty_profile_id,
			case when a.creator_role = 'creditor' then 'debtor'::public.party_role else 'creditor'::public.party_role end
		from public.agreements a
		where a.status in ('active', 'amendment_pending') and a.counterparty_profile_id is not null
	),
	-- reminders.kind is snake_case; the outbox template is the copy key (copy-tr.md notif.*).
	kinds (kind, template, day_offset, debtor_only) as (
		values ('due_soon', 'dueSoon', -3, true), ('due_today', 'dueToday', 0, false),
			('overdue_1', 'overdue1', 1, true), ('overdue_7', 'overdue7', 7, false)
	),
	candidates as (
		select r.agreement_id, r.user_id, i.id as installment_id, k.kind, k.template,
			((i.due_date + k.day_offset) + time '10:00') at time zone 'Europe/Istanbul' as fire_at,
			jsonb_build_object(
				'agreement_id', a.id,
				'name', private.counterparty_of(a, r.user_id) ->> 'display_name',
				'amount_minor', i.amount_minor - i.paid_minor,
				'due_date', i.due_date,
				'seq', i.seq,
				'count', (select count(*) from public.installments x where x.agreement_id = a.id and x.version = a.active_version)
			) as payload
		from recipients r
		join public.agreements a on a.id = r.agreement_id
		join public.installments i on i.agreement_id = a.id and i.version = a.active_version
		cross join kinds k
		where i.due_date is not null
			and i.paid_minor < i.amount_minor
			and (not k.debtor_only or r.role = 'debtor')
	),
	due as (
		select * from candidates c
		where p_now >= c.fire_at and p_now < c.fire_at + interval '12 hours'
	),
	inserted as (
		insert into public.reminders (agreement_id, installment_id, user_id, fire_at, kind, status)
		select agreement_id, installment_id, user_id, fire_at, kind, 'sent' from due
		on conflict (installment_id, user_id, kind) where installment_id is not null do nothing
		returning installment_id, user_id, kind
	)
	insert into public.notification_outbox (user_id, template, payload)
	select d.user_id, d.template, d.payload
	from inserted ins
	join due d on d.installment_id = ins.installment_id and d.user_id = ins.user_id and d.kind = ins.kind
	order by d.fire_at, d.installment_id;

	get diagnostics v_count = row_count;
	return v_count;
end;
$$;

-- Outbox processing (service role only) --------------------------------------------------------------

-- Claims due rows with a short lease so two dispatcher runs never send the same row twice.
create function public.claim_notifications(p_limit int) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_result jsonb;
begin
	with picked as (
		select id from public.notification_outbox
		where status = 'pending' and next_attempt_at <= now()
		order by id
		limit greatest(least(p_limit, 500), 1)
		for update skip locked
	),
	claimed as (
		update public.notification_outbox o
		set attempts = o.attempts + 1, next_attempt_at = now() + interval '5 minutes'
		from picked
		where o.id = picked.id
		returning o.id, o.user_id, o.template, o.payload, o.attempts
	)
	select coalesce(jsonb_agg(jsonb_build_object(
		'id', c.id,
		'template', c.template,
		'payload', c.payload,
		'attempts', c.attempts,
		'tokens', coalesce((select jsonb_agg(t.expo_token order by t.expo_token) from public.push_tokens t where t.user_id = c.user_id), '[]'::jsonb)
	) order by c.id), '[]'::jsonb)
	into v_result
	from claimed c;
	return v_result;
end;
$$;

-- Results: [{ id, status: sent | retry | failed, invalid_tokens: [...] }]. Retries back off
-- exponentially (2, 4, 8 … minutes, max 1 hour) and give up after 5 attempts.
create function public.finish_notifications(p_results jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_result jsonb;
	v_updated int := 0;
	v_rows int;
begin
	for v_result in select value from jsonb_array_elements(p_results) loop
		update public.notification_outbox
		set status = case
				when v_result ->> 'status' = 'sent' then 'sent'
				when v_result ->> 'status' = 'retry' and attempts < 5 then 'pending'
				else 'failed'
			end,
			next_attempt_at = case
				when v_result ->> 'status' = 'retry' then now() + least(interval '1 hour', interval '1 minute' * power(2, attempts))
				else next_attempt_at
			end
		where id = (v_result ->> 'id')::bigint;
		get diagnostics v_rows = row_count;
		v_updated := v_updated + v_rows;

		-- Expo reports DeviceNotRegistered for uninstalled apps; such tokens are dropped.
		delete from public.push_tokens
		where expo_token in (select jsonb_array_elements_text(coalesce(v_result -> 'invalid_tokens', '[]'::jsonb)));
	end loop;
	return jsonb_build_object('updated', v_updated);
end;
$$;

-- Scheduling -------------------------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- The edge function URL and service role key live in Vault (secrets "project_url" and
-- "service_role_key"; see supabase/README.md). Without them nothing is called.
create function private.trigger_dispatch() returns void
language plpgsql
set search_path = ''
as $$
declare
	v_url text;
	v_key text;
begin
	if not exists (select 1 from public.notification_outbox where status = 'pending' and next_attempt_at <= now()) then
		return;
	end if;
	select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
	select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
	if v_url is null or v_key is null then
		return;
	end if;
	perform net.http_post(
		url := v_url || '/functions/v1/dispatch-notifications',
		headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
		body := '{}'::jsonb
	);
end;
$$;

select cron.schedule('enqueue-reminders', '*/15 * * * *', $$select private.enqueue_due_reminders(now())$$);
select cron.schedule('dispatch-notifications', '* * * * *', $$select private.trigger_dispatch()$$);

-- Grants ---------------------------------------------------------------------------------------------

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_agreement(uuid) to authenticated;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

revoke all on function public.claim_notifications(int) from public, anon, authenticated;
revoke all on function public.finish_notifications(jsonb) from public, anon, authenticated;
grant execute on function public.claim_notifications(int) to service_role;
grant execute on function public.finish_notifications(jsonb) to service_role;
