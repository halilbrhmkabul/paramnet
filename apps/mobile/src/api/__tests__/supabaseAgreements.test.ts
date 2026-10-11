import type { CreateAgreementInput } from "@paramnet/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "../errors";
import { createSupabaseAgreementsApi } from "../supabase/supabaseAgreements";

function fakeClient(result: { data: unknown; error: unknown }) {
	const calls: { fn: string; args: unknown }[] = [];
	const client = {
		rpc: (fn: string, args?: unknown) => {
			calls.push({ fn, args });
			return Promise.resolve(result);
		},
	};
	return { client: client as unknown as SupabaseClient, calls };
}

const input: CreateAgreementInput = {
	kind: "loan",
	creator_role: "creditor",
	title: "Borç",
	description: null,
	started_on: null,
	counterparty: { contact_id: "00000000-0000-4000-8000-0000000000a1" },
	terms: {
		principal_minor: 1000,
		down_payment_minor: 0,
		notes: null,
		plan: [{ seq: 1, due_date: null, amount_minor: 1000 }],
	},
};

describe("Supabase AgreementsApi", () => {
	it.each([
		[
			"getDashboard",
			(api: ReturnType<typeof createSupabaseAgreementsApi>) => api.getDashboard(),
			"get_dashboard",
			undefined,
		],
		[
			"listContacts",
			(api: ReturnType<typeof createSupabaseAgreementsApi>) => api.listContacts(),
			"list_contacts_with_balance",
			undefined,
		],
		[
			"getContact",
			(api: ReturnType<typeof createSupabaseAgreementsApi>) => api.getContact("c1"),
			"get_contact_detail",
			{ p_id: "c1" },
		],
		[
			"getAgreement",
			(api: ReturnType<typeof createSupabaseAgreementsApi>) => api.getAgreement("a1"),
			"get_agreement_detail",
			{ p_id: "a1" },
		],
		[
			"getCalendar",
			(api: ReturnType<typeof createSupabaseAgreementsApi>) => api.getCalendar("2026-10-01"),
			"get_calendar",
			{ p_month: "2026-10-01" },
		],
		[
			"createAgreement",
			(api: ReturnType<typeof createSupabaseAgreementsApi>) =>
				api.createAgreement(input, "k1"),
			"create_agreement",
			{ input, idem_key: "k1" },
		],
		[
			"recordPayment",
			(api: ReturnType<typeof createSupabaseAgreementsApi>) =>
				api.recordPayment(
					"a1",
					{ amount_minor: 100, paid_on: "2026-10-11", method: "cash", note: null },
					3,
					"k2",
				),
			"record_payment",
			{
				p_agreement_id: "a1",
				p_input: { amount_minor: 100, paid_on: "2026-10-11", method: "cash", note: null },
				p_row_version: 3,
				p_idempotency_key: "k2",
			},
		],
	] as const)("%s calls %s and returns its JSON", async (_, call, fn, args) => {
		const { client, calls } = fakeClient({ data: { ok: true }, error: null });
		await expect(call(createSupabaseAgreementsApi(client))).resolves.toEqual({ ok: true });
		expect(calls).toEqual([{ fn, args }]);
	});

	it("maps RPC error codes", async () => {
		const { client } = fakeClient({
			data: null,
			error: { code: "P0001", message: "conflict" },
		});
		await expect(createSupabaseAgreementsApi(client).getDashboard()).rejects.toEqual(
			new ApiError("conflict"),
		);
		const network = fakeClient({ data: null, error: new TypeError("Network request failed") });
		await expect(createSupabaseAgreementsApi(network.client).getDashboard()).rejects.toEqual(
			new ApiError("network"),
		);
	});
});
