import type { SupabaseClient } from "@supabase/supabase-js";

import type { AgreementsApi } from "../AgreementsApi";
import { toApiError } from "./toApiError";

// The read RPCs already return the view models in src/api/types.ts (ADR-022); writes return small
// result objects. Shapes are guarded by the pgTAP tests (050_read_rpcs, 040_personal_rpcs).
export function createSupabaseAgreementsApi(client: SupabaseClient): AgreementsApi {
	async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
		const response: { data: unknown; error: unknown } = await client.rpc(fn, args);
		if (response.error !== null) {
			throw toApiError(response.error);
		}
		return response.data as T;
	}

	return {
		getDashboard: () => call("get_dashboard"),
		listContacts: () => call("list_contacts_with_balance"),
		getContact: (id) => call("get_contact_detail", { p_id: id }),
		getAgreement: (id) => call("get_agreement_detail", { p_id: id }),
		getCalendar: (month) => call("get_calendar", { p_month: month }),
		createAgreement: (input, idempotencyKey) =>
			call("create_agreement", { input, idem_key: idempotencyKey }),
		recordPayment: (agreementId, input, rowVersion, idempotencyKey) =>
			call("record_payment", {
				p_agreement_id: agreementId,
				p_input: input,
				p_row_version: rowVersion,
				p_idempotency_key: idempotencyKey,
			}),
	};
}
