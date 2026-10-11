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
	contact_id: string;
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

export type EventType = "created" | "payment_recorded" | "settled";

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
