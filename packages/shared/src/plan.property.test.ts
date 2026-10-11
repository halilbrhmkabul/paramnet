import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { addDays } from "./dates";
import {
	MAX_INSTALLMENTS,
	PLAN_PERIODS,
	generatePlan,
	validatePlan,
	type PlanInstallment,
	type PlanResult,
} from "./plan";

const MIN_DAY = Date.UTC(2000, 0, 1);
const MAX_DAY = Date.UTC(2099, 11, 31);
const DAY_MS = 24 * 60 * 60 * 1000;

const isoDate = fc
	.integer({ min: 0, max: (MAX_DAY - MIN_DAY) / DAY_MS })
	.map((offset) => new Date(MIN_DAY + offset * DAY_MS).toISOString().slice(0, 10));

// Plans are generated from the remaining amount, so draw that first and derive a valid down payment.
const planInput = fc
	.record({
		remaining: fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
		count: fc.integer({ min: 1, max: MAX_INSTALLMENTS }),
		downPaymentShare: fc.double({ min: 0, max: 1, noNaN: true }),
		period: fc.constantFrom(...PLAN_PERIODS),
		firstDueDate: isoDate,
	})
	.filter(({ remaining, count }) => remaining >= count)
	.map(({ remaining, count, downPaymentShare, period, firstDueDate }) => {
		const downPayment = Math.floor((Number.MAX_SAFE_INTEGER - remaining) * downPaymentShare);
		return { principal: remaining + downPayment, downPayment, count, period, firstDueDate };
	});

function planOf(result: PlanResult): PlanInstallment[] {
	if (!result.ok) {
		throw new Error(`expected a plan, got ${result.error}`);
	}
	return result.plan;
}

function sum(plan: readonly { amount_minor: number }[]): number {
	return plan.reduce((total, row) => total + row.amount_minor, 0);
}

function daysInMonth(isoDay: string): number {
	const [year, month] = isoDay.split("-").map(Number);
	return new Date(Date.UTC(year ?? 0, month ?? 0, 0)).getUTCDate();
}

describe("generatePlan properties", () => {
	it("BR-03: installments + down payment always equal the principal", () => {
		fc.assert(
			fc.property(planInput, (input) => {
				const plan = planOf(generatePlan(input));
				expect(sum(plan) + input.downPayment).toBe(input.principal);
				expect(Number.isSafeInteger(sum(plan))).toBe(true);
			}),
		);
	});

	it("every amount is a positive integer and only the last one carries the rounding", () => {
		fc.assert(
			fc.property(planInput, (input) => {
				const plan = planOf(generatePlan(input));
				const base = plan[0]?.amount_minor ?? 0;
				for (const row of plan) {
					expect(Number.isSafeInteger(row.amount_minor)).toBe(true);
					expect(row.amount_minor).toBeGreaterThan(0);
				}
				for (const row of plan.slice(0, -1)) {
					expect(row.amount_minor).toBe(base);
				}
				const last = plan.at(-1)?.amount_minor ?? 0;
				expect(last - base).toBeGreaterThanOrEqual(0);
				expect(last - base).toBeLessThan(input.count);
			}),
		);
	});

	it("has count rows numbered 1..n with strictly ascending dates from the first due date", () => {
		fc.assert(
			fc.property(planInput, (input) => {
				const plan = planOf(generatePlan(input));
				expect(plan.map((row) => row.seq)).toEqual(
					Array.from({ length: input.count }, (_, i) => i + 1),
				);
				expect(plan[0]?.due_date).toBe(input.firstDueDate);
				for (let i = 1; i < plan.length; i++) {
					expect((plan[i]?.due_date ?? "") > (plan[i - 1]?.due_date ?? "")).toBe(true);
				}
			}),
		);
	});

	it("weekly and biweekly steps are exact day offsets from the first due date", () => {
		fc.assert(
			fc.property(
				planInput.filter((input) => input.period !== "monthly"),
				(input) => {
					const step = input.period === "weekly" ? 7 : 14;
					const plan = planOf(generatePlan(input));
					plan.forEach((row, k) => {
						expect(row.due_date).toBe(addDays(input.firstDueDate, step * k));
					});
				},
			),
		);
	});

	it("monthly due day is min(first due day, last day of that month) and never drifts", () => {
		fc.assert(
			fc.property(
				planInput.map((input) => ({ ...input, period: "monthly" as const })),
				(input) => {
					const firstDay = Number(input.firstDueDate.slice(8));
					const plan = planOf(generatePlan(input));
					for (const row of plan) {
						const dueDate = row.due_date ?? "";
						expect(Number(dueDate.slice(8))).toBe(
							Math.min(firstDay, daysInMonth(dueDate)),
						);
					}
				},
			),
		);
	});

	it("rejects any count above the remaining amount", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 1, max: MAX_INSTALLMENTS - 1 }),
				fc.integer({ min: 1, max: MAX_INSTALLMENTS }),
				(remaining, extra) => {
					const count = Math.min(remaining + extra, MAX_INSTALLMENTS);
					fc.pre(count > remaining);
					expect(
						generatePlan({
							principal: remaining,
							downPayment: 0,
							count,
							period: "monthly",
							firstDueDate: "2026-11-10",
						}),
					).toEqual({ ok: false, error: "count_exceeds_remaining" });
				},
			),
		);
	});
});

describe("validatePlan properties", () => {
	it("accepts every generated plan unchanged", () => {
		fc.assert(
			fc.property(planInput, (input) => {
				const plan = planOf(generatePlan(input));
				const installments = plan.map(({ due_date, amount_minor }) => ({
					due_date,
					amount_minor,
				}));
				expect(
					validatePlan({
						principal: input.principal,
						downPayment: input.downPayment,
						installments,
					}),
				).toEqual({
					ok: true,
					plan,
				});
			}),
		);
	});

	it("BR-03: an accepted custom plan always sums to the remaining amount with ascending dates", () => {
		const rows = fc.array(
			fc.record({ due_date: isoDate, amount_minor: fc.integer({ min: -2, max: 1_000_000 }) }),
			{ minLength: 1, maxLength: 12 },
		);
		fc.assert(
			fc.property(
				rows,
				fc.boolean(),
				fc.integer({ min: 0, max: 1_000_000 }),
				(raw, sorted, downPayment) => {
					const installments = sorted
						? [...raw].sort((a, b) => (a.due_date < b.due_date ? -1 : 1))
						: raw;
					// Half the runs use the exact total so the accepting branch is exercised, not only rejections.
					const principal = sorted ? sum(installments) + downPayment : 1;
					const result = validatePlan({ principal, downPayment, installments });
					if (result.ok) {
						expect(sum(result.plan) + downPayment).toBe(principal);
						for (const row of result.plan) {
							expect(row.amount_minor).toBeGreaterThan(0);
						}
						for (let i = 1; i < result.plan.length; i++) {
							expect(
								(result.plan[i]?.due_date ?? "") >=
									(result.plan[i - 1]?.due_date ?? ""),
							).toBe(true);
						}
					}
				},
			),
		);
	});

	it("rejects a generated plan when one amount is shifted between rows", () => {
		fc.assert(
			fc.property(
				planInput.filter((input) => input.count >= 2),
				fc.nat(),
				fc.integer({ min: 1, max: 1000 }),
				(input, pick, delta) => {
					const plan = planOf(generatePlan(input));
					const index = pick % plan.length;
					const installments = plan.map(({ due_date, amount_minor }, i) => ({
						due_date,
						amount_minor: i === index ? amount_minor + delta : amount_minor,
					}));
					fc.pre(Number.isSafeInteger(sum(plan) + delta));
					expect(
						validatePlan({
							principal: input.principal,
							downPayment: input.downPayment,
							installments,
						}),
					).toEqual({
						ok: false,
						error: "sum_mismatch",
					});
				},
			),
		);
	});
});
