import type { CreateAgreementInput, IsoDate, PaymentInput } from "@paramnet/shared";

import type {
	AgreementDetail,
	CalendarMonth,
	ContactDetail,
	AnalyticsEvent,
	ContactSummary,
	Dashboard,
	Decision,
	InviteResolution,
	PendingDecision,
	RequestItem,
	ShareResult,
	TermsView,
} from "./types";

// Screens only see this interface; mock and Supabase adapters both implement it (EXPO_PUBLIC_API_MODE).
export interface AgreementsApi {
	getDashboard(): Promise<Dashboard>;
	listContacts(): Promise<ContactSummary[]>;
	getContact(id: string): Promise<ContactDetail>;
	getAgreement(id: string): Promise<AgreementDetail>;
	getCalendar(month: IsoDate): Promise<CalendarMonth>;
	// The key is generated once per draft and reused on retry (BR-09).
	createAgreement(
		input: CreateAgreementInput,
		idempotencyKey: string,
	): Promise<{ agreement_id: string; replayed: boolean }>;
	// record_payment: row_version guards concurrent edits; the key makes retries safe.
	recordPayment(
		agreementId: string,
		input: PaymentInput,
		rowVersion: number,
		idempotencyKey: string,
	): Promise<{ payment_id: string; replayed: boolean }>;
	// Sharing (F2-06).
	shareAgreement(id: string, phone: string, rowVersion: number): Promise<ShareResult>;
	withdrawShare(id: string): Promise<void>;
	makePersonal(id: string): Promise<void>;
	resolveInvite(token: string): Promise<InviteResolution>;
	getPendingDecision(id: string): Promise<PendingDecision>;
	decide(
		id: string,
		actor: PendingDecision["actor"],
		version: number,
		termsHash: string,
		decision: Decision,
		counterTerms: TermsView | null,
	): Promise<{ status: string; version: number }>;
	listRequests(): Promise<RequestItem[]>;
	// Payments on a shared agreement (F2-07).
	decidePayment(
		paymentId: string,
		decision: "confirm" | "reject",
	): Promise<{ status: string; replayed: boolean }>;
	withdrawPayment(paymentId: string): Promise<void>;
	// Amendments (F2-08).
	proposeAmendment(
		id: string,
		terms: TermsView,
		reason: string | null,
		rowVersion: number,
	): Promise<{ status: string; version: number }>;
	withdrawAmendment(id: string): Promise<void>;
	// Disputes, mutual cancellation and forgiveness (F2-09).
	openDispute(
		id: string,
		reason: string,
		paymentId: string | null,
		rowVersion: number,
	): Promise<{ status: string }>;
	resolveDispute(id: string): Promise<void>;
	requestCancel(id: string, rowVersion: number): Promise<void>;
	decideCancel(
		id: string,
		decision: "accept" | "reject",
	): Promise<{ status: string; replayed: boolean }>;
	// amountMinor null forgives everything that is left; the key makes retries safe (BR-09).
	forgiveRemaining(
		id: string,
		amountMinor: number | null,
		rowVersion: number,
		idempotencyKey: string,
	): Promise<{ payment_id: string; replayed: boolean; settled: boolean }>;
	// Analytics (F3-02): best effort, never throws.
	trackEvent(event: AnalyticsEvent): Promise<void>;
}
