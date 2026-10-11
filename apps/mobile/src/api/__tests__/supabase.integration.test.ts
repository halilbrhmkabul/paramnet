import {
	addDays,
	addMonthsClamped,
	monthOf,
	todayInIstanbul,
	type CreateAgreementInput,
} from "@paramnet/shared";
import { createClient } from "@supabase/supabase-js";

import { createSupabaseAuthApi } from "../auth/supabaseAuth";
import { ApiError } from "../errors";
import { createSupabaseAgreementsApi } from "../supabase/supabaseAgreements";

// Runs only against a local Supabase (`pnpm supabase start`):
//   PARAMNET_SUPABASE_URL=http://127.0.0.1:54321 PARAMNET_SUPABASE_KEY=<publishable> pnpm --filter mobile test:integration
// process.env is untyped in CI (no generated expo-env types), so narrow explicitly.
const rawUrl: unknown = process.env.PARAMNET_SUPABASE_URL;
const rawKey: unknown = process.env.PARAMNET_SUPABASE_KEY;
const url = typeof rawUrl === "string" ? rawUrl : undefined;
const key = typeof rawKey === "string" ? rawKey : undefined;
const describeLocal = url !== undefined && key !== undefined ? describe : describe.skip;

describeLocal("Supabase adapters against local Supabase (F1-17)", () => {
	const client = createClient(url ?? "", key ?? "", {
		auth: { persistSession: false, autoRefreshToken: false },
	});
	const auth = createSupabaseAuthApi(client);
	const api = createSupabaseAgreementsApi(client);
	const today = todayInIstanbul();
	const first = addMonthsClamped(today, 1);
	const label = `Entegrasyon ${String(Date.now())}`;

	it("signs in with the local test number and completes the profile", async () => {
		await auth.requestOtp("+905550000003").catch((error: unknown) => {
			// A rerun within 60 s hits the resend limit; the earlier code is still valid.
			if (!(error instanceof ApiError && error.code === "rate_limited")) {
				throw error;
			}
		});
		await expect(auth.verifyOtp("+905550000003", "000000")).rejects.toEqual(
			new ApiError("otp_invalid"),
		);
		const user = await auth.verifyOtp("+905550000003", "123456");
		expect(user.phone_e164).toBe("+905550000003");
		expect(await auth.updateProfile("Entegrasyon")).toMatchObject({
			display_name: "Entegrasyon",
		});
		// The client keeps the session in memory, so restore() finds it with the new profile.
		expect(await auth.restore()).toMatchObject({
			phone_e164: "+905550000003",
			display_name: "Entegrasyon",
		});
	}, 20000);

	it("creates, reads, pays and lists through the RPCs", async () => {
		const input: CreateAgreementInput = {
			kind: "installment_purchase",
			creator_role: "debtor",
			title: "Mobilya",
			description: null,
			started_on: today,
			counterparty: { contact: { display_name: label, phone_e164: null, kind: "merchant" } },
			terms: {
				principal_minor: 2800000,
				down_payment_minor: 800000,
				notes: null,
				plan: [0, 1, 2, 3, 4].map((k) => ({
					seq: k + 1,
					due_date: addMonthsClamped(first, k),
					amount_minor: 400000,
				})),
			},
		};
		const idem = crypto.randomUUID();
		const { agreement_id, replayed } = await api.createAgreement(input, idem);
		expect(replayed).toBe(false);
		expect(await api.createAgreement(input, idem)).toEqual({ agreement_id, replayed: true });

		const detail = await api.getAgreement(agreement_id);
		expect(detail).toMatchObject({
			title: "Mobilya",
			status: "personal",
			my_role: "debtor",
			outstanding_minor: 2000000,
			down_payment_minor: 800000,
			started_on: today,
			counterparty: { display_name: label, kind: "merchant", phone_e164: null },
		});
		expect(detail.installments.map((i) => [i.due_date, i.state.status])).toEqual(
			[0, 1, 2, 3, 4].map((k) => [addMonthsClamped(first, k), "upcoming"]),
		);

		await expect(
			api.recordPayment(
				agreement_id,
				{ amount_minor: 2000001, paid_on: today, method: "cash", note: null },
				detail.row_version,
				crypto.randomUUID(),
			),
		).rejects.toEqual(new ApiError("amount_exceeds_outstanding"));
		await api.recordPayment(
			agreement_id,
			{ amount_minor: 500000, paid_on: today, method: "transfer", note: "İlk ödeme" },
			detail.row_version,
			crypto.randomUUID(),
		);
		await expect(
			api.recordPayment(
				agreement_id,
				{ amount_minor: 1, paid_on: today, method: "cash", note: null },
				detail.row_version,
				crypto.randomUUID(),
			),
		).rejects.toEqual(new ApiError("conflict"));

		const after = await api.getAgreement(agreement_id);
		expect(after.outstanding_minor).toBe(1500000);
		expect(after.installments.map((i) => i.paid_minor)).toEqual([400000, 100000, 0, 0, 0]);
		expect(after.events.map((e) => e.type)).toEqual(["created", "payment_recorded"]);

		const contacts = await api.listContacts();
		const contact = contacts.find((c) => c.display_name === label);
		expect(contact?.net_minor).toBe(-1500000);
		expect((await api.getContact(contact?.id ?? "")).agreements.map((a) => a.id)).toEqual([
			agreement_id,
		]);

		const dashboard = await api.getDashboard();
		expect(dashboard.has_agreements).toBe(true);
		const calendar = await api.getCalendar(monthOf(first));
		expect(calendar.days[first]?.some((item) => item.agreement_id === agreement_id)).toBe(true);
		expect(addDays(first, 0)).toBe(first);
	}, 20000);

	it("hides a record from someone else", async () => {
		await expect(api.getAgreement("99999999-9999-4999-8999-999999999999")).rejects.toEqual(
			new ApiError("not_found"),
		);
	});
});
