import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
	allocatePayment,
	outstanding,
	type AllocationInstallment,
	type PaymentLike,
} from "./allocation";

const installments = fc
	.array(
		fc.integer({ min: 1, max: 10_000_000 }).chain((amount) =>
			fc.record({
				amount_minor: fc.constant(amount),
				paid_minor: fc.oneof(
					fc.constant(0),
					fc.constant(amount),
					fc.integer({ min: 0, max: amount }),
				),
			}),
		),
		{ minLength: 1, maxLength: 40 },
	)
	.map((rows): AllocationInstallment[] => rows.map((row, i) => ({ seq: i + 1, ...row })));

function remaining(rows: readonly AllocationInstallment[]): number {
	return rows.reduce((total, row) => total + row.amount_minor - row.paid_minor, 0);
}

describe("allocatePayment properties", () => {
	it("allocations add up to the payment and never overfill an installment", () => {
		fc.assert(
			fc.property(installments, fc.double({ min: 0, max: 1, noNaN: true }), (rows, share) => {
				const left = remaining(rows);
				fc.pre(left > 0);
				const amount = Math.max(1, Math.floor(left * share));
				const result = allocatePayment(rows, amount);
				if (!result.ok) {
					throw new Error(result.error);
				}
				expect(result.allocations.reduce((total, a) => total + a.amount_minor, 0)).toBe(
					amount,
				);
				for (const allocation of result.allocations) {
					const row = rows.find((r) => r.seq === allocation.seq);
					expect(allocation.amount_minor).toBeGreaterThan(0);
					expect((row?.paid_minor ?? 0) + allocation.amount_minor).toBeLessThanOrEqual(
						row?.amount_minor ?? 0,
					);
				}
			}),
		);
	});

	it("is FIFO: an installment receives money only after every earlier one is full", () => {
		fc.assert(
			fc.property(installments, fc.integer({ min: 1, max: 400_000_000 }), (rows, wanted) => {
				const amount = Math.min(wanted, remaining(rows));
				fc.pre(amount > 0);
				const result = allocatePayment(rows, amount);
				if (!result.ok) {
					throw new Error(result.error);
				}
				const added = new Map(result.allocations.map((a) => [a.seq, a.amount_minor]));
				const after = rows.map((row) => row.paid_minor + (added.get(row.seq) ?? 0));
				const lastTouched = Math.max(...result.allocations.map((a) => a.seq));
				rows.forEach((row, i) => {
					if (row.seq < lastTouched) {
						expect(after[i]).toBe(row.amount_minor);
					}
				});
			}),
		);
	});

	it("rejects any amount above the remaining balance", () => {
		fc.assert(
			fc.property(installments, fc.integer({ min: 1, max: 1_000_000 }), (rows, extra) => {
				expect(allocatePayment(rows, remaining(rows) + extra)).toEqual({
					ok: false,
					error: "amount_exceeds_outstanding",
				});
			}),
		);
	});
});

describe("outstanding properties", () => {
	it("BR-04: never negative and equals principal minus confirmed payments", () => {
		const statuses = ["confirmed", "reported", "rejected", "withdrawn", "voided"] as const;
		const kinds = ["payment", "down_payment", "discount"] as const;
		fc.assert(
			fc.property(
				fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
				fc.array(
					fc.record({
						share: fc.double({ min: 0, max: 1, noNaN: true }),
						kind: fc.constantFrom(...kinds),
						status: fc.constantFrom(...statuses),
					}),
					{ maxLength: 20 },
				),
				(principal, drafts) => {
					// Confirmed amounts are drawn from what is still owed, as the server guarantees.
					let left = principal;
					const payments: PaymentLike[] = drafts.map(({ share, kind, status }) => {
						const amount = Math.max(1, Math.floor(left * share));
						if (status === "confirmed" && left > 0) {
							const confirmed = Math.min(amount, left);
							left -= confirmed;
							return { amount_minor: confirmed, kind, status };
						}
						return {
							amount_minor: amount,
							kind,
							status: status === "confirmed" ? "reported" : status,
						};
					});
					const result = outstanding({ principal_minor: principal }, payments);
					expect(result).toBe(left);
					expect(result).toBeGreaterThanOrEqual(0);
				},
			),
		);
	});
});
