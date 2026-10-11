-- F1-12: core schema (spec 10.1, paramnet-domain schema.md).
-- Every table has RLS enabled and no policies here: closed by default. Read policies arrive in F1-13;
-- writes only ever go through security definer RPCs (F1-14).

-- Enums ---------------------------------------------------------------------------------------------

create type public.agreement_status as enum (
	'personal', 'pending', 'countered', 'active', 'amendment_pending', 'disputed', 'rejected', 'settled', 'cancelled'
);
create type public.agreement_kind as enum ('loan', 'installment_purchase');
create type public.party_role as enum ('creditor', 'debtor');
create type public.contact_kind as enum ('person', 'merchant');
create type public.version_status as enum ('draft', 'proposed', 'accepted', 'rejected', 'superseded');
create type public.payment_status as enum ('reported', 'confirmed', 'rejected', 'withdrawn', 'voided');
create type public.payment_kind as enum ('payment', 'down_payment', 'discount');
create type public.payment_method as enum ('cash', 'transfer', 'card', 'other');
create type public.invite_status as enum ('active', 'consumed', 'revoked', 'expired', 'locked');
create type public.event_channel as enum ('app', 'web', 'system');

-- Only Turkish mobile numbers: invites are confirmed by SMS (spec 11, ADR-014).
create domain public.phone_tr as text check (value ~ '^\+905[0-9]{9}$');

-- Profiles and contacts -----------------------------------------------------------------------------

create table public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	display_name text not null check (char_length(display_name) between 1 and 80),
	phone_e164 public.phone_tr not null unique,
	locale text not null default 'tr-TR',
	timezone text not null default 'Europe/Istanbul',
	deleted_at timestamptz,
	created_at timestamptz not null default now()
);

create table public.contacts (
	id uuid primary key default gen_random_uuid(),
	owner_id uuid not null references public.profiles (id) on delete cascade,
	display_name text not null check (char_length(display_name) between 1 and 80),
	phone_e164 public.phone_tr,
	linked_profile_id uuid references public.profiles (id) on delete set null,
	kind public.contact_kind not null default 'person',
	created_at timestamptz not null default now(),
	unique (owner_id, phone_e164)
);
create index contacts_linked_profile_id_idx on public.contacts (linked_profile_id);

-- Agreements ----------------------------------------------------------------------------------------

create table public.agreements (
	id uuid primary key default gen_random_uuid(),
	creator_id uuid not null references public.profiles (id),
	creator_role public.party_role not null,
	counterparty_contact_id uuid not null references public.contacts (id),
	counterparty_profile_id uuid references public.profiles (id),
	kind public.agreement_kind not null,
	title text not null check (char_length(title) between 1 and 80),
	description text check (char_length(description) <= 500),
	-- Spec 5.2 "verildiği / alındığı tarih" (ADR-019).
	started_on date,
	-- BR-02: the column is ready for more currencies, the first release accepts only TRY.
	currency char(3) not null default 'TRY' check (currency = 'TRY'),
	principal_minor bigint not null check (principal_minor > 0),
	-- Cache of principal − confirmed payments; RPCs keep it in step (BR-04).
	outstanding_minor bigint not null check (outstanding_minor >= 0),
	status public.agreement_status not null default 'personal',
	active_version int not null default 1 check (active_version >= 1),
	pending_version int check (pending_version >= 1),
	row_version int not null default 1 check (row_version >= 1),
	settled_at timestamptz,
	cancelled_at timestamptz,
	created_at timestamptz not null default now(),
	constraint agreements_outstanding_le_principal check (outstanding_minor <= principal_minor),
	constraint agreements_settled_at check ((status = 'settled') = (settled_at is not null)),
	constraint agreements_cancelled_at check ((status = 'cancelled') = (cancelled_at is not null)),
	-- BR-12: nobody shares an agreement with themselves.
	constraint agreements_not_self check (counterparty_profile_id is distinct from creator_id)
);
create index agreements_creator_status_idx on public.agreements (creator_id, status);
create index agreements_counterparty_profile_status_idx on public.agreements (counterparty_profile_id, status);
create index agreements_counterparty_contact_id_idx on public.agreements (counterparty_contact_id);

create table public.agreement_versions (
	agreement_id uuid not null references public.agreements (id) on delete cascade,
	version int not null check (version >= 1),
	terms jsonb not null,
	-- SHA-256 of the canonical terms JSON, lowercase hex (ADR-014).
	terms_hash text not null check (terms_hash ~ '^[0-9a-f]{64}$'),
	proposed_by uuid not null references public.profiles (id),
	reason text check (char_length(reason) <= 500),
	status public.version_status not null,
	created_at timestamptz not null default now(),
	primary key (agreement_id, version)
);
create index agreement_versions_proposed_by_idx on public.agreement_versions (proposed_by);

create table public.installments (
	id uuid primary key default gen_random_uuid(),
	agreement_id uuid not null,
	version int not null,
	seq int not null check (seq >= 1),
	due_date date,
	amount_minor bigint not null check (amount_minor > 0),
	paid_minor bigint not null default 0 check (paid_minor >= 0),
	created_at timestamptz not null default now(),
	foreign key (agreement_id, version) references public.agreement_versions (agreement_id, version) on delete cascade,
	unique (agreement_id, version, seq),
	constraint installments_paid_le_amount check (paid_minor <= amount_minor)
);
-- Reminders only look at unpaid installments that have a date.
create index installments_open_due_date_idx on public.installments (due_date)
	where due_date is not null and paid_minor < amount_minor;

-- Payments ------------------------------------------------------------------------------------------

create table public.payments (
	id uuid primary key default gen_random_uuid(),
	agreement_id uuid not null references public.agreements (id) on delete cascade,
	amount_minor bigint not null check (amount_minor > 0),
	paid_on date not null,
	method public.payment_method not null,
	kind public.payment_kind not null,
	status public.payment_status not null,
	note text check (char_length(note) <= 500),
	reported_by uuid not null references public.profiles (id),
	decided_by uuid references public.profiles (id),
	decided_at timestamptz,
	-- BR-09: a repeated request with the same key returns the first result.
	idempotency_key uuid not null unique,
	attachment_path text,
	created_at timestamptz not null default now(),
	constraint payments_decision check ((decided_by is null) = (decided_at is null))
);
create index payments_agreement_id_idx on public.payments (agreement_id);
create index payments_reported_by_idx on public.payments (reported_by);
create index payments_decided_by_idx on public.payments (decided_by);

create table public.payment_allocations (
	payment_id uuid not null references public.payments (id) on delete cascade,
	installment_id uuid not null references public.installments (id) on delete cascade,
	amount_minor bigint not null check (amount_minor > 0),
	created_at timestamptz not null default now(),
	primary key (payment_id, installment_id)
);
create index payment_allocations_installment_id_idx on public.payment_allocations (installment_id);

-- Event log (append only, BR-13) --------------------------------------------------------------------

create table public.agreement_events (
	id bigint generated always as identity primary key,
	agreement_id uuid not null references public.agreements (id) on delete cascade,
	actor_id uuid references public.profiles (id),
	actor_phone_e164 public.phone_tr,
	channel public.event_channel not null,
	type text not null check (type ~ '^[a-z_]+$'),
	version int,
	payload jsonb not null default '{}'::jsonb,
	ip_hash text,
	user_agent text check (char_length(user_agent) <= 200),
	created_at timestamptz not null default now()
);
create index agreement_events_agreement_id_idx on public.agreement_events (agreement_id, id);
create index agreement_events_actor_id_idx on public.agreement_events (actor_id);

-- Notifications and reminders -----------------------------------------------------------------------

create table public.reminders (
	id uuid primary key default gen_random_uuid(),
	agreement_id uuid not null references public.agreements (id) on delete cascade,
	installment_id uuid references public.installments (id) on delete cascade,
	user_id uuid not null references public.profiles (id) on delete cascade,
	fire_at timestamptz not null,
	kind text not null check (kind ~ '^[a-z_0-9]+$'),
	status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'cancelled')),
	created_at timestamptz not null default now()
);
create index reminders_agreement_id_idx on public.reminders (agreement_id);
create index reminders_installment_id_idx on public.reminders (installment_id);
create index reminders_user_id_idx on public.reminders (user_id);
create index reminders_due_idx on public.reminders (fire_at) where status = 'scheduled';

create table public.notification_outbox (
	id bigint generated always as identity primary key,
	user_id uuid not null references public.profiles (id) on delete cascade,
	template text not null check (template ~ '^[a-zA-Z0-9_.]+$'),
	-- Template variables only; no free text from users (spec 13: no personal data in logs).
	payload jsonb not null default '{}'::jsonb,
	status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
	attempts int not null default 0 check (attempts >= 0),
	next_attempt_at timestamptz not null default now(),
	created_at timestamptz not null default now()
);
create index notification_outbox_user_id_idx on public.notification_outbox (user_id);
create index notification_outbox_pending_idx on public.notification_outbox (next_attempt_at) where status = 'pending';

create table public.push_tokens (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.profiles (id) on delete cascade,
	expo_token text not null unique,
	platform text not null check (platform in ('ios', 'android')),
	last_seen_at timestamptz not null default now(),
	created_at timestamptz not null default now()
);
create index push_tokens_user_id_idx on public.push_tokens (user_id);

create table public.consents (
	user_id uuid not null references public.profiles (id) on delete cascade,
	document text not null check (document in ('kvkk', 'terms')),
	version text not null check (char_length(version) between 1 and 20),
	accepted_at timestamptz not null default now(),
	created_at timestamptz not null default now(),
	primary key (user_id, document, version)
);

-- Append-only guards --------------------------------------------------------------------------------

create function public.reject_change() returns trigger
language plpgsql
set search_path = ''
as $$
begin
	raise exception '% on %.% is not allowed (append only)', tg_op, tg_table_schema, tg_table_name
		using errcode = 'P0001';
end;
$$;

create trigger agreement_events_no_update before update on public.agreement_events
	for each row execute function public.reject_change();
create trigger agreement_events_no_delete before delete on public.agreement_events
	for each row execute function public.reject_change();

-- A version's terms are what someone approved; only its status may move (proposed → accepted/superseded).
create function public.guard_agreement_version_update() returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if new.agreement_id is distinct from old.agreement_id
		or new.version is distinct from old.version
		or new.terms is distinct from old.terms
		or new.terms_hash is distinct from old.terms_hash
		or new.proposed_by is distinct from old.proposed_by
		or new.reason is distinct from old.reason
		or new.created_at is distinct from old.created_at then
		raise exception 'agreement version terms are immutable' using errcode = 'P0001';
	end if;
	return new;
end;
$$;

create trigger agreement_versions_guard_update before update on public.agreement_versions
	for each row execute function public.guard_agreement_version_update();
create trigger agreement_versions_no_delete before delete on public.agreement_versions
	for each row execute function public.reject_change();

-- RLS: on everywhere, no policies yet (closed) ------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.agreements enable row level security;
alter table public.agreement_versions enable row level security;
alter table public.installments enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.agreement_events enable row level security;
alter table public.reminders enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.push_tokens enable row level security;
alter table public.consents enable row level security;

revoke execute on function public.reject_change() from public, anon, authenticated;
revoke execute on function public.guard_agreement_version_update() from public, anon, authenticated;
