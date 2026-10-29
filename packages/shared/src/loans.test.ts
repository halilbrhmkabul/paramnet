import { describe, expect, it } from "vitest";

import vectors from "../test-vectors/loans.json";
import {
	annuityPayment,
	formatRateBps,
	loanInputSchema,
	loanSchedule,
	loanSummary,
	parseRateBps,
} from "./loans";

describe("annuityPayment (ADR-056)", () => {
	it.each(vectors.payments)("$name", ({ principal, bps, term, expected }) => {
		expect(annuityPayment(principal, bps, term)).toBe(expected);
	});
});

describe("loanSchedule", () => {
	it.each(vectors.schedules)(
		"$name",
		({ principal, bps, term, first_due, installment, expected }) => {
			const rows = loanSchedule(principal, bps, term, first_due, installment);
			expect(rows).toEqual(expected);
			expect(rows.reduce((s, r) => s + r.principal_minor, 0)).toBe(principal);
		},
	);

	it("repays the design's 120.000 TL over 24 months to the kuruş", () => {
		const payment = annuityPayment(12000000, 339, 24);
		const rows = loanSchedule(12000000, 339, 24, "2026-02-28", payment);
		expect(rows.at(-1)?.balance_minor).toBe(0);
		expect(rows[7]?.balance_minor).toBe(9007768);
	});
});

describe("loanSummary", () => {
	const rows = loanSchedule(1000000, 200, 3, "2026-11-15", 350000);

	it("follows the recorded installments", () => {
		expect(loanSummary(rows, 1000000, 0)).toMatchObject({
			paid: 0,
			remaining_principal_minor: 1000000,
			remaining_count: 3,
			next: { seq: 1 },
			last_due: "2027-01-15",
			total_interest_minor: 40068,
		});
		expect(loanSummary(rows, 1000000, 2)).toMatchObject({
			paid: 2,
			remaining_principal_minor: 333400,
			remaining_total_minor: 340068,
			next: { seq: 3 },
		});
		expect(loanSummary(rows, 1000000, 9)).toMatchObject({
			paid: 3,
			remaining_principal_minor: 0,
			next: null,
		});
	});
});

describe("loanInputSchema", () => {
	const valid = {
		bank_name: "Ziraat Bankası",
		loan_type: "Taşıt kredisi",
		principal_minor: 25000000,
		monthly_rate_bps: 299,
		term_months: 24,
		first_due_on: "2026-11-15",
		installment_minor: 1474596,
		payment_account_id: null,
	};

	it("accepts a loan", () => {
		expect(loanInputSchema.parse(valid)).toEqual(valid);
	});

	it("rejects what the server rejects", () => {
		const issue = (input: unknown) =>
			loanInputSchema.safeParse(input).error?.issues[0]?.message;
		expect(issue({ ...valid, monthly_rate_bps: 2001 })).toBe("invalid_rate");
		expect(issue({ ...valid, monthly_rate_bps: 2.5 })).toBe("invalid_rate");
		expect(issue({ ...valid, term_months: 121 })).toBe("invalid_term");
		expect(issue({ ...valid, principal_minor: 0 })).toBe("invalid_amount");
		expect(issue({ ...valid, loan_type: "" })).toBe("required");
	});
});

describe("rate text", () => {
	it("reads and writes a monthly rate in hundredths of a percent", () => {
		expect(parseRateBps("2,99")).toBe(299);
		expect(parseRateBps("3.5")).toBe(350);
		expect(parseRateBps("0")).toBe(0);
		expect(parseRateBps("2,999")).toBeNull();
		expect(parseRateBps("abc")).toBeNull();
		expect(formatRateBps(339)).toBe("%3,39");
		expect(formatRateBps(5)).toBe("%0,05");
	});
});
