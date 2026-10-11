-- F1-13: read policies (spec 10.2, paramnet-domain schema.md "RLS ilkeleri").
-- Clients only ever read; every write goes through security definer RPCs (F1-14), so table grants are
-- reduced to SELECT for authenticated and nothing for anon.

-- Grants --------------------------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- New objects start closed too; each later migration grants what it needs explicitly.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

grant select on
	public.profiles,
	public.contacts,
	public.agreements,
	public.agreement_versions,
	public.installments,
	public.payments,
	public.payment_allocations,
	public.agreement_events,
	public.consents
to authenticated;
-- reminders, notification_outbox and push_tokens stay server-only.

-- Visibility helper ---------------------------------------------------------------------------------

-- Not exposed through the Data API; security definer so the policies on child tables do not recurse
-- into the agreements policy for every row.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.can_view_agreement(p_agreement_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
		select 1
		from public.agreements a
		where a.id = p_agreement_id
			and (
				a.creator_id = (select auth.uid())
				-- The counterparty sees a shared agreement, never the creator's personal record.
				or (a.counterparty_profile_id = (select auth.uid()) and a.status <> 'personal')
			)
	);
$$;

revoke all on function private.can_view_agreement(uuid) from public, anon;
grant execute on function private.can_view_agreement(uuid) to authenticated;

-- Policies ------------------------------------------------------------------------------------------

create policy profiles_select_self on public.profiles
	for select to authenticated
	using (id = (select auth.uid()));

create policy contacts_select_owner on public.contacts
	for select to authenticated
	using (owner_id = (select auth.uid()));

create policy agreements_select_party on public.agreements
	for select to authenticated
	using (
		creator_id = (select auth.uid())
		or (counterparty_profile_id = (select auth.uid()) and status <> 'personal')
	);

create policy agreement_versions_select_party on public.agreement_versions
	for select to authenticated
	using (private.can_view_agreement(agreement_id));

create policy installments_select_party on public.installments
	for select to authenticated
	using (private.can_view_agreement(agreement_id));

create policy payments_select_party on public.payments
	for select to authenticated
	using (private.can_view_agreement(agreement_id));

create policy payment_allocations_select_party on public.payment_allocations
	for select to authenticated
	using (
		exists (
			select 1 from public.payments p
			where p.id = payment_id and private.can_view_agreement(p.agreement_id)
		)
	);

create policy agreement_events_select_party on public.agreement_events
	for select to authenticated
	using (private.can_view_agreement(agreement_id));

create policy consents_select_self on public.consents
	for select to authenticated
	using (user_id = (select auth.uid()));
