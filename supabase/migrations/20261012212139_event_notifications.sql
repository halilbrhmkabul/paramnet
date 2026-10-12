-- F2-11: notifications for every event of the sharing flow and the reported-payment reminder (spec 5.9,
-- copy-tr.md "Bildirim şablonları"). Payment, amendment and dispute notices stay in their RPCs; the
-- sharing events below are written from many places (app and web decisions, three ways to settle,
-- the expiry job), so one trigger on the append-only log turns them into outbox rows (ADR-036).

-- Sharing events → notification_outbox ---------------------------------------------------------------

create function private.notify_agreement_event() returns trigger
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

	-- Before the counterparty decides, their account is the one registered to the invited number (if any).
	v_counterparty := coalesce(v_ag.counterparty_profile_id, (
		select p.id from public.invites i
		join public.profiles p on p.phone_e164 = i.target_phone_e164
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

-- The other side's name as the recipient knows it: the creator sees their own contact name.
create function private.event_payload(p_agreement public.agreements, p_to uuid) returns jsonb
language sql
stable
set search_path = ''
as $$
	select jsonb_build_object(
		'agreement_id', p_agreement.id,
		'name', coalesce(
			case when p_agreement.creator_id = p_to
				then (select display_name from public.contacts where id = p_agreement.counterparty_contact_id)
				else (select display_name from public.profiles where id = p_agreement.creator_id)
			end, ''),
		'amount_minor', p_agreement.principal_minor
	);
$$;

create trigger agreement_events_notify
	after insert on public.agreement_events
	for each row
	when (new.type in ('shared', 'share_withdrawn', 'invite_expired', 'accepted', 'countered', 'rejected', 'settled'))
	execute function private.notify_agreement_event();

-- Reported payment waiting for the creditor (spec 5.9 "Bildirilen ödeme bekliyorsa") ------------------

alter table public.reminders add column payment_id uuid references public.payments (id) on delete cascade;
-- One reminder per payment and person; also the "already sent" log.
create unique index reminders_payment_once_idx on public.reminders (payment_id, user_id, kind)
	where payment_id is not null;

-- Seven days after the report, at 10:00 Europe/Istanbul, to the creditor while it is still unanswered.
-- Same quiet hours and 12-hour window as enqueue_due_reminders.
create function private.enqueue_payment_reminders(p_now timestamptz default now()) returns int
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

	with candidates as (
		select p.id as payment_id, a.id as agreement_id,
			case when a.creator_role = 'creditor' then a.creator_id else a.counterparty_profile_id end as user_id,
			((((p.created_at at time zone 'Europe/Istanbul')::date) + 7) + time '10:00') at time zone 'Europe/Istanbul' as fire_at,
			p.amount_minor, a as agreement
		from public.payments p
		join public.agreements a on a.id = p.agreement_id
		where p.status = 'reported' and a.status in ('active', 'amendment_pending')
	),
	due as (
		select * from candidates c
		where c.user_id is not null and p_now >= c.fire_at and p_now < c.fire_at + interval '12 hours'
	),
	inserted as (
		insert into public.reminders (agreement_id, payment_id, user_id, fire_at, kind, status)
		select agreement_id, payment_id, user_id, fire_at, 'payment_pending', 'sent' from due
		on conflict (payment_id, user_id, kind) where payment_id is not null do nothing
		returning payment_id, user_id
	)
	insert into public.notification_outbox (user_id, template, payload)
	select d.user_id, 'paymentPending',
		private.event_payload(d.agreement, d.user_id) || jsonb_build_object('amount_minor', d.amount_minor)
	from inserted ins
	join due d on d.payment_id = ins.payment_id and d.user_id = ins.user_id
	order by d.fire_at, d.payment_id;

	get diagnostics v_count = row_count;
	return v_count;
end;
$$;

select cron.schedule('enqueue-payment-reminders', '*/15 * * * *', $$select private.enqueue_payment_reminders(now())$$);

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_agreement(uuid) to authenticated;
