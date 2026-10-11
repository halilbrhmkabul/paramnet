import type { CreateAgreementInput, IsoDate, PaymentInput } from "@paramnet/shared";

import type {
	AgreementDetail,
	CalendarMonth,
	ContactDetail,
	ContactSummary,
	Dashboard,
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
}
