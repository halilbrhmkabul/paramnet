import { describe, expect, it } from "vitest";

import vectors from "../test-vectors/plan.json";
import {
	MAX_INSTALLMENTS,
	PLAN_PERIODS,
	generatePlan,
	validatePlan,
	type PlanPeriod,
} from "./plan";

function toPeriod(value: string): PlanPeriod {
	const period = PLAN_PERIODS.find((candidate) => candidate === value);
	if (period === undefined) {
		throw new Error(`unknown period in test vector: ${value}`);
	}
	return period;
}

describe("generatePlan — shared test vectors", () => {
	it.each(vectors.generate.map((vector) => [vector.name, vector] as const))("%s", (_, vector) => {
		const { input } = vector;
		const result = generatePlan({
			principal: input.principal,
			downPayment: input.down_payment,
			count: input.count,
			period: toPeriod(input.period),
			firstDueDate: input.first_due_date,
		});
		expect(result).toEqual(vector.expected);
	});
});

describe("validatePlan — shared test vectors", () => {
	it.each(vectors.validate.map((vector) => [vector.name, vector] as const))("%s", (_, vector) => {
		const { input } = vector;
		const result = validatePlan({
			principal: input.principal,
			downPayment: input.down_payment,
			installments: input.installments,
		});
		expect(result).toEqual(vector.expected);
	});
});

describe("generatePlan", () => {
	it("accepts exactly the maximum installment count", () => {
		const result = generatePlan({
			principal: MAX_INSTALLMENTS * 100,
			downPayment: 0,
			count: MAX_INSTALLMENTS,
			period: "monthly",
			firstDueDate: "2026-11-10",
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.plan).toHaveLength(MAX_INSTALLMENTS);
			expect(result.plan.at(-1)).toEqual({
				seq: 120,
				due_date: "2036-10-10",
				amount_minor: 100,
			});
		}
	});

	it.each([
		[
			"principal above the safe integer range",
			{ principal: Number.MAX_SAFE_INTEGER + 1 },
			"invalid_principal",
		],
		["negative principal", { principal: -100 }, "invalid_principal"],
		["fractional down payment", { downPayment: 0.5 }, "invalid_down_payment"],
		["fractional count", { count: 1.5 }, "invalid_count"],
		["malformed first due date", { firstDueDate: "10.11.2026" }, "invalid_due_date"],
	] as const)("rejects %s", (_, override, error) => {
		const result = generatePlan({
			principal: 1000,
			downPayment: 0,
			count: 2,
			period: "monthly",
			firstDueDate: "2026-11-10",
			...override,
		});
		expect(result).toEqual({ ok: false, error });
	});

	it("reports the first failing check: amounts before count before date", () => {
		expect(
			generatePlan({
				principal: 0,
				downPayment: -1,
				count: 0,
				period: "monthly",
				firstDueDate: "x",
			}),
		).toEqual({ ok: false, error: "invalid_principal" });
		expect(
			generatePlan({
				principal: 100,
				downPayment: 100,
				count: 0,
				period: "monthly",
				firstDueDate: "x",
			}),
		).toEqual({ ok: false, error: "down_payment_too_large" });
		expect(
			generatePlan({
				principal: 100,
				downPayment: 0,
				count: 101,
				period: "monthly",
				firstDueDate: "x",
			}),
		).toEqual({ ok: false, error: "count_exceeds_remaining" });
	});

	it("checks a provided due date even for a one-off plan", () => {
		expect(
			generatePlan({
				principal: 100,
				downPayment: 0,
				count: 1,
				period: "monthly",
				firstDueDate: "2026-13-01",
			}),
		).toEqual({ ok: false, error: "invalid_due_date" });
	});
});

describe("validatePlan", () => {
	it("rejects more rows than the installment limit", () => {
		const installments = Array.from({ length: MAX_INSTALLMENTS + 1 }, () => ({
			due_date: "2026-11-10",
			amount_minor: 1,
		}));
		expect(
			validatePlan({ principal: MAX_INSTALLMENTS + 1, downPayment: 0, installments }),
		).toEqual({
			ok: false,
			error: "invalid_count",
		});
	});

	it("reports the earliest failing row", () => {
		expect(
			validatePlan({
				principal: 300,
				downPayment: 0,
				installments: [
					{ due_date: "2026-11-10", amount_minor: 100 },
					{ due_date: "2026-11-09", amount_minor: 100 },
					{ due_date: "2026-11-11", amount_minor: -1 },
				],
			}),
		).toEqual({ ok: false, error: "dates_not_ascending", index: 1 });
	});

	it("does not mutate the input rows", () => {
		const installments = [{ due_date: "2026-11-10", amount_minor: 300 }];
		const snapshot = structuredClone(installments);
		validatePlan({ principal: 300, downPayment: 0, installments });
		expect(installments).toEqual(snapshot);
	});
});
