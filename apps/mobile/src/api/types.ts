import type {
	AgreementKind,
	AgreementStatus,
	ContactKind,
	InstallmentState,
	IsoDate,
	PartyRole,
	PaymentKind,
	PaymentMethod,
	PaymentStatus,
} from "@paramnet/shared";

// View models returned by the API layer; the Supabase adapter (F1-17) maps RPC results to the same shapes.
export type Counterparty = {
	// Null when I am the invited side: the creator's contact list is not mine (ADR-022).
	contact_id: string | null;
	display_name: string;
	kind: ContactKind;
	phone_e164: string | null;
};

export type NextInstallment = {
	seq: number;
	due_date: IsoDate | null;
	due_minor: number;
	state: InstallmentState;
};

export type AgreementSummary = {
	id: string;
	kind: AgreementKind;
	title: string;
	status: AgreementStatus;
	my_role: PartyRole;
	is_creator: boolean;
	counterparty: Counterparty;
	principal_minor: number;
	outstanding_minor: number;
	reported_minor: number;
	installment_count: number;
	paid_installment_count: number;
	next_installment: NextInstallment | null;
	row_version: number;
};

export type InstallmentView = {
	id: string;
	seq: number;
	due_date: IsoDate | null;
	amount_minor: number;
	paid_minor: number;
	state: InstallmentState;
};

export type PaymentView = {
	id: string;
	amount_minor: number;
	paid_on: IsoDate;
	method: PaymentMethod;
	kind: PaymentKind;
	status: PaymentStatus;
	note: string | null;
	created_at: string;
};

export type EventType =
	| "created"
	| "payment_recorded"
	| "updated"
	| "cancelled"
	| "settled"
	| "shared"
	| "share_withdrawn"
	| "invite_expired"
	| "accepted"
	| "countered"
	| "rejected"
	| "made_personal";

export type EventView = {
	id: string;
	type: EventType;
	at: string;
	actor: "me" | "counterparty" | "system";
	amount_minor: number | null;
};

export type AgreementDetail = AgreementSummary & {
	description: string | null;
	started_on: IsoDate | null;
	notes: string | null;
	down_payment_minor: number;
	created_at: string;
	installments: InstallmentView[];
	payments: PaymentView[];
	events: EventView[];
};

export type ContactSummary = {
	id: string;
	display_name: string;
	phone_e164: string | null;
	kind: ContactKind;
	// Signed: positive = they owe me, negative = I owe them.
	net_minor: number;
	open_agreement_count: number;
};

export type ContactDetail = ContactSummary & { agreements: AgreementSummary[] };

export type DueItem = {
	agreement_id: string;
	title: string;
	counterparty_name: string;
	my_role: PartyRole;
	seq: number;
	installment_count: number;
	due_date: IsoDate;
	due_minor: number;
	state: InstallmentState;
};

export type Dashboard = {
	receivable_minor: number;
	payable_minor: number;
	due_this_month_minor: number;
	collect_this_month_minor: number;
	overdue: DueItem[];
	upcoming: DueItem[];
	pending_count: number;
	has_agreements: boolean;
};

export type CalendarMonth = {
	month: IsoDate;
	days: Partial<Record<IsoDate, DueItem[]>>;
};

// Sharing (F2-06) ----------------------------------------------------------------------------------

export type ShareResult = { token: string; expires_at: string };

export type InviteResolution = {
	status: "active" | "expired" | "consumed" | "revoked" | "locked" | "invalid";
	creator_name?: string;
	// The invite was sent to another number than this account's.
	mismatch?: boolean;
	agreement_id?: string | null;
};

export type TermsView = {
	principal_minor: number;
	down_payment_minor: number;
	notes: string | null;
	plan: { seq: number; due_date: IsoDate | null; amount_minor: number }[];
};

export type PendingDecision = {
	agreement_id: string;
	title: string;
	actor: "creator" | "counterparty";
	other_name: string | null;
	my_role: PartyRole;
	version: number;
	terms_hash: string;
	current: TermsView;
	proposed: TermsView;
	can_reject: boolean;
	payments: { amount_minor: number; paid_on: IsoDate; kind: PaymentKind }[];
};

export type Decision = "accept" | "counter" | "reject";

export type RequestItem = {
	agreement_id: string;
	kind: "share" | "counter";
	title: string;
	from_name: string | null;
	my_role: PartyRole;
	principal_minor: number;
};
