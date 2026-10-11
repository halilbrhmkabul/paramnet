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

	it("routes a decision by whose turn it is (F2-06)", async () => {
		const terms = {
			principal_minor: 1000,
			down_payment_minor: 0,
			notes: null,
			plan: [{ seq: 1, due_date: null, amount_minor: 1000 }],
		};
		const asCounterparty = fakeClient({ data: { status: "active", version: 1 }, error: null });
		await createSupabaseAgreementsApi(asCounterparty.client).decide(
			"a1",
			"counterparty",
			1,
			"h",
			"accept",
			null,
		);
		expect(asCounterparty.calls).toEqual([
			{
				fn: "decide_agreement",
				args: {
					p_id: "a1",
					p_version: 1,
					p_terms_hash: "h",
					p_decision: "accept",
					p_counter_terms: null,
				},
			},
		]);
		const asCreator = fakeClient({ data: { status: "pending", version: 3 }, error: null });
		await createSupabaseAgreementsApi(asCreator.client).decide(
			"a1",
			"creator",
			2,
			"h",
			"counter",
			terms,
		);
		expect(asCreator.calls[0]?.fn).toBe("decide_counter");
		expect(asCreator.calls[0]?.args).toMatchObject({ p_counter_terms: terms });
	});

	it.each([
		[
			"shareAgreement",
			(api: ReturnType<typeof createSupabaseAgreementsApi>) =>
				api.shareAgreement("a1", "+905550000002", 2),
			"share_agreement",
			{ p_id: "a1", p_phone: "+905550000002", p_row_version: 2 },
		],
		[
			"withdrawShare",
			(api: ReturnType<typeof createSupabaseAgreementsApi>) => api.withdrawShare("a1"),
			"withdraw_share",
			{ p_id: "a1" },
		],
		[
			"makePersonal",
			(api: ReturnType<typeof createSupabaseAgreementsApi>) => api.makePersonal("a1"),
			"make_personal",
			{ p_id: "a1" },
		],
		[
			"resolveInvite",
			(api: ReturnType<typeof createSupabaseAgreementsApi>) => api.resolveInvite("tok"),
			"resolve_invite",
			{ p_token: "tok" },
		],
		[
			"getPendingDecision",
			(api: ReturnType<typeof createSupabaseAgreementsApi>) => api.getPendingDecision("a1"),
			"get_pending_decision",
			{ p_id: "a1" },
		],
		[
			"listRequests",
			(api: ReturnType<typeof createSupabaseAgreementsApi>) => api.listRequests(),
			"list_requests",
			undefined,
		],
	] as const)("%s calls %s", async (_, call, fn, args) => {
		const { client, calls } = fakeClient({ data: [], error: null });
		await call(createSupabaseAgreementsApi(client));
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
