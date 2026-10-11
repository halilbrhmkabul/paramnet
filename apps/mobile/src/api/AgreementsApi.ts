import type { IsoDate } from "@paramnet/shared";

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
}
