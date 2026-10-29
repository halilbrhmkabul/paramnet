import type { CreateAgreementInput } from "@paramnet/shared";

import { ApiError } from "../errors";
import { createMockApi } from "../mock/mockApi";
import { SEED_IDS } from "../mock/seed";

const now = () => new Date("2026-10-11T09:00:00Z");

const furniture: CreateAgreementInput = {
	kind: "installment_purchase",
	creator_role: "debtor",
	title: "Mobilya",
	description: null,
	started_on: null,
	counterparty: { contact: { display_name: "Kaya Mobilya", phone_e164: null, kind: "merchant" } },
	terms: {
		principal_minor: 2800000,
		down_payment_minor: 800000,
		notes: null,
		plan: [
			{ seq: 1, due_date: "2026-11-10", amount_minor: 400000 },
			{ seq: 2, due_date: "2026-12-10", amount_minor: 400000 },
			{ seq: 3, due_date: "2027-01-10", amount_minor: 400000 },
			{ seq: 4, due_date: "2027-02-10", amount_minor: 400000 },
			{ seq: 5, due_date: "2027-03-10", amount_minor: 400000 },
		],
	},
};

describe("mock createAgreement", () => {
	it("creates a personal agreement with its plan, a confirmed down payment and a new contact", async () => {
		const api = createMockApi({ now, seed: "empty", latencyMs: 0 });
		const { agreement_id, replayed } = await api.createAgreement(
			{ ...furniture, started_on: "2026-10-01" },
			"11111111-1111-4111-8111-111111111111",
		);
		expect(replayed).toBe(false);

		const detail = await api.getAgreement(agreement_id);
		expect(detail).toMatchObject({
			status: "personal",
			my_role: "debtor",
			title: "Mobilya",
			started_on: "2026-10-01",
			principal_minor: 2800000,
			outstanding_minor: 2000000,
			down_payment_minor: 800000,
			counterparty: { display_name: "Kaya Mobilya", kind: "merchant" },
		});
		expect(detail.installments.map((i) => i.due_date)).toEqual([
			"2026-11-10",
			"2026-12-10",
			"2027-01-10",
			"2027-02-10",
			"2027-03-10",
		]);
		expect(detail.payments).toEqual([
			expect.objectContaining({
				kind: "down_payment",
				status: "confirmed",
				amount_minor: 800000,
				paid_on: "2026-10-01",
			}),
		]);
		expect((await api.listContacts()).map((c) => c.display_name)).toEqual(["Kaya Mobilya"]);
	});

	it("replays the same idempotency key without creating a second record", async () => {
		const api = createMockApi({ now, seed: "empty", latencyMs: 0 });
		const key = "22222222-2222-4222-8222-222222222222";
		const first = await api.createAgreement(furniture, key);
		const second = await api.createAgreement(furniture, key);
		expect(second).toEqual({ agreement_id: first.agreement_id, replayed: true });
		expect((await api.getDashboard()).payable_minor).toBe(2000000);
	});

	it("uses an existing contact by id", async () => {
		const api = createMockApi({ now, seed: "demo", latencyMs: 0 });
		const { agreement_id } = await api.createAgreement(
			{ ...furniture, counterparty: { contact_id: SEED_IDS.ahmet } },
			"33333333-3333-4333-8333-333333333333",
		);
		expect((await api.getAgreement(agreement_id)).counterparty.display_name).toBe(
			"Ahmet Yılmaz",
		);
	});

	it("rejects an unknown contact and invalid terms", async () => {
		const api = createMockApi({ now, seed: "empty", latencyMs: 0 });
		await expect(
			api.createAgreement(
				{
					...furniture,
					counterparty: { contact_id: "99999999-9999-4999-8999-999999999999" },
				},
				"44444444-4444-4444-8444-444444444444",
			),
		).rejects.toEqual(new ApiError("not_found"));
		await expect(
			api.createAgreement(
				{ ...furniture, terms: { ...furniture.terms, principal_minor: 1 } },
				"55555555-5555-4555-8555-555555555555",
			),
		).rejects.toEqual(new ApiError("validation_error"));
	});

	// ADR-059: rows already behind the owner are saved as paid, each on its own due date.
	it("records the first rows as paid on their due dates and the down payment on the purchase date", async () => {
		const api = createMockApi({ now, seed: "empty", latencyMs: 0 });
		const past: CreateAgreementInput = {
			...furniture,
			started_on: "2026-07-15",
			terms: {
				...furniture.terms,
				plan: [
					{ seq: 1, due_date: "2026-08-15", amount_minor: 1000000 },
					{ seq: 2, due_date: "2026-09-15", amount_minor: 500000 },
					{ seq: 3, due_date: "2026-11-15", amount_minor: 500000 },
				],
			},
		};
		const { agreement_id } = await api.createAgreement(
			past,
			"66666666-6666-4666-8666-666666666666",
			2,
		);
		const detail = await api.getAgreement(agreement_id);
		expect(detail.outstanding_minor).toBe(500000);
		expect(detail.payments.map((p) => [p.kind, p.paid_on, p.amount_minor])).toEqual(
			expect.arrayContaining([
				["down_payment", "2026-07-15", 800000],
				["payment", "2026-08-15", 1000000],
				["payment", "2026-09-15", 500000],
			]),
		);
		const again = await api.createAgreement(past, "66666666-6666-4666-8666-666666666666", 2);
		expect(again.replayed).toBe(true);
		expect((await api.getAgreement(agreement_id)).payments).toHaveLength(3);
	});

	it("refuses to mark a row that is not due yet as paid", async () => {
		const api = createMockApi({ now, seed: "empty", latencyMs: 0 });
		await expect(
			api.createAgreement(furniture, "77777777-7777-4777-8777-777777777777", 1),
		).rejects.toEqual(new ApiError("validation_error"));
		expect(await api.listAgreements()).toHaveLength(0);
	});
});
