import type {
	AccountKind,
	AgreementKind,
	CardColor,
	CardState,
	LoanRow,
	AgreementStatus,
	ContactKind,
	InstallmentState,
	IsoDate,
	PartyRole,
	PaymentKind,
	PaymentMethod,
	PaymentStatus,
	RecurrenceFrequency,
	SplitMode,
	TransactionCategory,
	TransactionKind,
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
	// I reported it: a reported payment of mine can be withdrawn, someone else's confirmed or rejected.
	by_me: boolean;
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
	| "made_personal"
	| "payment_reported"
	| "payment_confirmed"
	| "payment_rejected"
	| "payment_withdrawn"
	| "amendment_proposed"
	| "amendment_accepted"
	| "amendment_rejected"
	| "amendment_withdrawn"
	| "dispute_opened"
	| "dispute_resolved"
	| "cancel_requested"
	| "cancel_accepted"
	| "cancel_rejected"
	| "forgiven";

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
	// An open counter offer / amendment: true if I proposed it, false if it waits for me, null if none.
	pending_by_me: boolean | null;
	// The open dispute (S16), if any; only its opener may withdraw it.
	dispute: {
		by_me: boolean;
		reason: string;
		payment_id: string | null;
		opened_at: string;
	} | null;
	// An open request to cancel together; the other side answers it.
	cancel_request: { by_me: boolean; requested_at: string } | null;
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
	actor: "creator" | "counterparty" | "amendment";
	other_name: string | null;
	my_role: PartyRole;
	version: number;
	terms_hash: string;
	reason: string | null;
	current: TermsView;
	proposed: TermsView;
	can_reject: boolean;
	payments: { amount_minor: number; paid_on: IsoDate; kind: PaymentKind }[];
};

export type Decision = "accept" | "counter" | "reject";

export type RequestItem = {
	agreement_id: string;
	kind: "share" | "counter" | "payment" | "amendment" | "dispute" | "cancel";
	// Only for kind "payment": a payment the other side reported, waiting for my confirmation.
	payment_id?: string;
	amount_minor?: number;
	paid_on?: IsoDate;
	note?: string | null;
	// Only for kind "dispute".
	reason?: string;
	title: string;
	from_name: string | null;
	my_role: PartyRole;
	principal_minor: number;
};

// The app's own analytics events (F3-02, spec 13.3); everything else is counted from server rows.
// No personal data: only these names and fields reach track_event.
export type AnalyticsEvent =
	| { name: "app_opened" }
	| { name: "reminder_opened"; template: string }
	| { name: "invite_opened" };

// Profile, ParamNet ID and the notification inbox (ADR-050, ADR-051) ---------------------------------

// Days before the due date a reminder goes out; 0 is the due day itself.
export type ReminderDay = 7 | 3 | 1 | 0;

export type MyProfile = {
	id: string;
	first_name: string | null;
	last_name: string | null;
	display_name: string | null;
	username: string | null;
	phone_e164: string;
	paramnet_id: string;
	id_discoverable: boolean;
	// Earliest time a new ID can be taken (once every 30 days).
	can_regenerate_at: string;
	avatar_path: string | null;
	reminder_before_days: ReminderDay[];
};

export type ProfileInput = { first_name: string; last_name: string; username: string };

export type UsernameStatus = "available" | "taken" | "invalid";

// "Not found" is a value, not an error (ADR-050): only the display name comes back.
export type IdLookup =
	| { status: "found"; display_name: string; paramnet_id: string }
	| { status: "not_found" | "self" | "invalid" };

export type IdShareResult =
	| { status: "shared"; display_name: string; expires_at: string }
	| { status: "not_found" | "self" | "invalid" };

export type NotificationCategory = "approval" | "reminder" | "completed" | "info";

// Same fields the push texts are built from (supabase/functions/_shared/notifications.ts).
export type NotificationPayload = {
	agreement_id?: string;
	name?: string;
	amount_minor?: number;
	due_date?: IsoDate;
	seq?: number;
	count?: number;
	remaining_minor?: number;
};

export type InboxItem = {
	id: number;
	template: string;
	category: NotificationCategory;
	payload: NotificationPayload;
	agreement_id: string | null;
	created_at: string;
	read_at: string | null;
};

export type InboxPage = { items: InboxItem[]; unread_count: number; approval_count: number };

// Own accounts and cash records (F4-03, ADR-053). Balances come from the server; never stored.
export type Account = {
	id: string;
	kind: AccountKind;
	name: string;
	bank_name: string | null;
	opening_balance_minor: number;
	balance_minor: number;
	include_in_total: boolean;
	archived_at: string | null;
	row_version: number;
	created_at: string;
};

export type AccountList = { accounts: Account[]; total_cash_minor: number; included_count: number };

export type Transaction = {
	id: string;
	kind: TransactionKind;
	account_id: string | null;
	account_name: string | null;
	to_account_id: string | null;
	to_account_name: string | null;
	// A card purchase or refund (no account), or a card payment (to_card_id); ADR-055.
	card_id: string | null;
	card_name: string | null;
	to_card_id: string | null;
	to_card_name: string | null;
	installments: number;
	// An installment of the user's own bank loan (ADR-056).
	to_loan_id: string | null;
	to_loan_name: string | null;
	// Signed only for adjustments.
	amount_minor: number;
	category: TransactionCategory | null;
	title: string | null;
	note: string | null;
	occurred_on: IsoDate;
	deleted_at: string | null;
	row_version: number;
	created_at: string;
	updated_at: string;
};

export type TransactionChange = [unknown, unknown];

export type TransactionEvent = {
	type: "created" | "updated" | "deleted" | "restored";
	changes: Record<string, TransactionChange>;
	created_at: string;
};

export type TransactionDetail = { transaction: Transaction; events: TransactionEvent[] };

export type TransactionMonth = {
	items: Transaction[];
	income_minor: number;
	expense_minor: number;
};

export type CashSummary = {
	total_cash_minor: number;
	account_count: number;
	income_minor: number;
	expense_minor: number;
	updated_at: string | null;
};

// Repeating records, budgets and the monthly report (F4-04, ADR-054).
export type RecurringRule = {
	id: string;
	kind: "expense" | "income";
	name: string;
	amount_minor: number;
	category: TransactionCategory;
	account_id: string;
	account_name: string;
	frequency: RecurrenceFrequency;
	start_on: IsoDate;
	confirm_each: boolean;
	paused_at: string | null;
	next_dates: IsoDate[];
	// Due and waiting for "Onayla" / "Atla" (only rules that ask each time).
	pending_dates: IsoDate[];
	row_version: number;
	created_at: string;
};

export type BudgetItem = {
	category: TransactionCategory;
	limit_minor: number;
	spent_minor: number;
	count: number;
};

export type BudgetMonth = {
	items: BudgetItem[];
	total_limit_minor: number;
	total_spent_minor: number;
	month_expense_minor: number;
};

export type MonthlyReport = {
	month: IsoDate;
	income_minor: number;
	expense_minor: number;
	by_category: { category: TransactionCategory; amount_minor: number }[];
	series: { month: IsoDate; income_minor: number; expense_minor: number }[];
};

// Credit cards (F4-05, ADR-055); state is derived on the server (packages/shared deriveCardState).
export type Card = {
	id: string;
	bank_name: string;
	card_name: string | null;
	last4: string;
	label: string;
	color: CardColor;
	limit_minor: number;
	opening_debt_minor: number;
	statement_day: number;
	due_offset_days: number;
	min_payment_rate: number;
	archived_at: string | null;
	row_version: number;
	created_at: string;
	state: CardState;
};

export type CardList = {
	cards: Card[];
	total_debt_minor: number;
	available_minor: number;
	limit_minor: number;
};

export type CardDetail = {
	card: Card;
	period_items: Transaction[];
	installment_items: Transaction[];
	payments: Transaction[];
};

// The user's own bank loans (F4-06, ADR-056); the plan comes from the server (packages/shared loanSchedule).
export type Loan = {
	id: string;
	bank_name: string;
	loan_type: string;
	principal_minor: number;
	monthly_rate_bps: number;
	term_months: number;
	first_due_on: IsoDate;
	installment_minor: number;
	payment_account_id: string | null;
	payment_account_name: string | null;
	archived_at: string | null;
	row_version: number;
	created_at: string;
	schedule: LoanRow[];
	paid: number;
	remaining_principal_minor: number;
	remaining_total_minor: number;
	total_payment_minor: number;
	total_interest_minor: number;
	next: LoanRow | null;
};

export type LoanList = { loans: Loan[]; remaining_principal_minor: number; monthly_minor: number };

export type LoanDetail = { loan: Loan; payments: Transaction[] };

// "Para iste" and the hand-over of the money (F4-08, ADR-058).
export type MoneyRequestResult = { agreement_id: string; display_name: string | null };

export type DeliveryState = {
	required: boolean;
	reported_at: string | null;
	confirmed_at: string | null;
	my_role: PartyRole;
	status: AgreementStatus;
	row_version: number;
};

// "Hesabı böl" (F4-11, ADR-061): each share is a loan record from the payer; state comes from it.
export type SplitMemberState =
	| "payer"
	| "open"
	| "requested"
	| "invited"
	| "accepted"
	| "reported"
	| "paid"
	| "disputed"
	| "declined";

export type SplitMember = {
	id: string;
	display_name: string;
	share_minor: number;
	is_owner: boolean;
	is_me: boolean;
	state: SplitMemberState;
	joined_via: "paramnet_id" | "link" | "qr" | null;
	requested_at: string | null;
	// Only the payer and that member see the record behind a share.
	agreement_id: string | null;
	paid_minor: number;
	reported_payment: { id: string; amount_minor: number; reported_at: string } | null;
	paid_at: string | null;
};

export type SplitEvent = {
	type:
		| "join_requested"
		| "join_approved"
		| "join_rejected"
		| "member_assigned"
		| "accepted"
		| "rejected"
		| "countered"
		| "payment_reported"
		| "payment_confirmed"
		| "payment_rejected";
	name: string | null;
	at: string;
	via: string | null;
};

export type SplitDetail = {
	id: string;
	title: string;
	total_minor: number;
	spent_on: IsoDate;
	mode: SplitMode;
	is_owner: boolean;
	owner_name: string;
	// The payer's only: what the QR code and the link carry.
	join_code: string | null;
	join_expires_at: string | null;
	collected_minor: number;
	members: SplitMember[];
	events: SplitEvent[];
	row_version: number;
};

export type SplitSummary = {
	id: string;
	title: string;
	total_minor: number;
	spent_on: IsoDate;
	is_owner: boolean;
	owner_name: string;
	member_count: number;
	my_share_minor: number | null;
};

export type SplitSeat = { id: string; display_name: string; share_minor: number };

export type SplitInvite =
	| { status: "not_found" | "expired" }
	| { status: "owner" | "member"; split_id: string }
	| {
			status: "open";
			title: string;
			total_minor: number;
			spent_on: IsoDate;
			owner_name: string;
			member_count: number;
			seats: SplitSeat[];
	  };
