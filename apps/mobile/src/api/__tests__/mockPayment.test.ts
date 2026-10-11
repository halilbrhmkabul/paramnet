import { ApiError } from "../errors";
import { createMockApi } from "../mock/mockApi";
import { SEED_IDS } from "../mock/seed";

const now = () => new Date("2026-10-11T09:00:00Z");
const key = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function setup() {
	return createMockApi({ now, seed: "demo", latencyMs: 0 });
}

describe("mock recordPayment (personal mode)", () => {
	it("confirms the payment and allocates it FIFO", async () => {
		const api = setup();
		const before = await api.getAgreement(SEED_IDS.ahmetLoan);
		const result = await api.recordPayment(
			SEED_IDS.ahmetLoan,
			{ amount_minor: 300000, paid_on: "2026-10-11", method: "cash", note: null },
			before.row_version,
			key(1),
		);
		expect(result.replayed).toBe(false);
		const after = await api.getAgreement(SEED_IDS.ahmetLoan);
		expect(after.outstanding_minor).toBe(350000);
		expect(after.installments.map((i) => i.paid_minor)).toEqual([400000, 400000, 50000]);
		expect(after.row_version).toBe(before.row_version + 1);
		expect(after.events.at(-1)).toMatchObject({
			type: "payment_recorded",
			amount_minor: 300000,
		});
	});

	it("settles the agreement when the balance reaches zero", async () => {
		const api = setup();
		const before = await api.getAgreement(SEED_IDS.ahmetLoan);
		await api.recordPayment(
			SEED_IDS.ahmetLoan,
			{ amount_minor: 650000, paid_on: "2026-10-11", method: "transfer", note: "Son" },
			before.row_version,
			key(2),
		);
		const after = await api.getAgreement(SEED_IDS.ahmetLoan);
		expect(after.status).toBe("settled");
		expect(after.outstanding_minor).toBe(0);
		expect(after.events.at(-1)?.type).toBe("settled");
	});

	it("is idempotent per key", async () => {
		const api = setup();
		const { row_version } = await api.getAgreement(SEED_IDS.ahmetLoan);
		const input = {
			amount_minor: 1000,
			paid_on: "2026-10-11",
			method: "cash",
			note: null,
		} as const;
		const first = await api.recordPayment(SEED_IDS.ahmetLoan, input, row_version, key(3));
		const second = await api.recordPayment(SEED_IDS.ahmetLoan, input, row_version, key(3));
		expect(second).toEqual({ payment_id: first.payment_id, replayed: true });
		expect((await api.getAgreement(SEED_IDS.ahmetLoan)).outstanding_minor).toBe(649000);
	});

	it("rejects a stale row_version, an amount above the balance, a settled agreement and bad input", async () => {
		const api = setup();
		const { row_version } = await api.getAgreement(SEED_IDS.ahmetLoan);
		const input = {
			amount_minor: 1000,
			paid_on: "2026-10-11",
			method: "cash",
			note: null,
		} as const;
		await expect(
			api.recordPayment(SEED_IDS.ahmetLoan, input, row_version - 1, key(4)),
		).rejects.toEqual(new ApiError("conflict"));
		await expect(
			api.recordPayment(
				SEED_IDS.ahmetLoan,
				{ ...input, amount_minor: 650001 },
				row_version,
				key(5),
			),
		).rejects.toEqual(new ApiError("amount_exceeds_outstanding"));
		const settled = await api.getAgreement(SEED_IDS.mertLoan);
		await expect(
			api.recordPayment(SEED_IDS.mertLoan, input, settled.row_version, key(6)),
		).rejects.toEqual(new ApiError("invalid_transition"));
		await expect(
			api.recordPayment(
				SEED_IDS.ahmetLoan,
				{ ...input, amount_minor: 0 },
				row_version,
				key(7),
			),
		).rejects.toEqual(new ApiError("validation_error"));
		await expect(
			api.recordPayment("99999999-9999-4999-8999-999999999999", input, 1, key(8)),
		).rejects.toEqual(new ApiError("not_found"));
	});
});
