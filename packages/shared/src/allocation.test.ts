import { describe, expect, it } from "vitest";

import vectors from "../test-vectors/allocation.json";
import {
	allocatePayment,
	installmentStatus,
	outstanding,
	reportedTotal,
	type PaymentLike,
} from "./allocation";

describe("allocatePayment — shared test vectors", () => {
	it.each(vectors.allocate.map((vector) => [vector.name, vector] as const))("%s", (_, vector) => {
		expect(allocatePayment(vector.input.installments, vector.input.amount)).toEqual(
			vector.expected,
		);
	});
});

describe("allocatePayment", () => {
	it("follows seq order even when rows arrive unsorted", () => {
		expect(
			allocatePayment(
				[
					{ seq: 2, amount_minor: 100, paid_minor: 0 },
					{ seq: 1, amount_minor: 100, paid_minor: 0 },
				],
				150,
			),
		).toEqual({
			ok: true,
			allocations: [
				{ seq: 1, amount_minor: 100 },
				{ seq: 2, amount_minor: 50 },
			],
		});
	});

	it("rejects a payment on a plan without installments", () => {
		expect(allocatePayment([], 1)).toEqual({ ok: false, error: "amount_exceeds_outstanding" });
	});

	it.each([
		["paid above amount", { seq: 1, amount_minor: 100, paid_minor: 101 }],
		["negative paid", { seq: 1, amount_minor: 100, paid_minor: -1 }],
		["zero amount", { seq: 1, amount_minor: 0, paid_minor: 0 }],
	])("throws on a corrupt installment: %s", (_, installment) => {
		expect(() => allocatePayment([installment], 1)).toThrow(RangeError);
	});
});

describe("installmentStatus", () => {
	const today = "2026-11-10";
	const row = (due_date: string | null, paid_minor: number) => ({
		due_date,
		amount_minor: 1000,
		paid_minor,
	});

	it.each([
		["upcoming", row("2026-11-11", 0), { status: "upcoming", partial: false }],
		["due today", row("2026-11-10", 0), { status: "due_today", partial: false }],
		["overdue", row("2026-11-09", 0), { status: "overdue", partial: false }],
		["no due date is upcoming", row(null, 0), { status: "upcoming", partial: false }],
		["partial and overdue", row("2026-11-01", 400), { status: "overdue", partial: true }],
		["partial and upcoming", row("2026-12-01", 999), { status: "upcoming", partial: true }],
		[
			"paid even when the date passed",
			row("2026-11-01", 1000),
			{ status: "paid", partial: false },
		],
		["paid early", row("2027-01-01", 1000), { status: "paid", partial: false }],
	] as const)("%s", (_, installment, expected) => {
		expect(installmentStatus(installment, today)).toEqual(expected);
	});

	it("rejects an invalid today", () => {
		expect(() => installmentStatus(row(null, 0), "2026-13-01")).toThrow(RangeError);
	});
});

describe("outstanding / reportedTotal", () => {
	const payments: PaymentLike[] = [
		{ amount_minor: 800000, kind: "down_payment", status: "confirmed" },
		{ amount_minor: 400000, kind: "payment", status: "confirmed" },
		{ amount_minor: 100000, kind: "discount", status: "confirmed" },
		{ amount_minor: 400000, kind: "payment", status: "reported" },
		{ amount_minor: 50000, kind: "payment", status: "rejected" },
		{ amount_minor: 60000, kind: "payment", status: "withdrawn" },
		{ amount_minor: 70000, kind: "payment", status: "voided" },
	];

	it("BR-04: subtracts only confirmed payments, down payments and discounts", () => {
		expect(outstanding({ principal_minor: 2800000 }, payments)).toBe(1500000);
	});

	it("reports pending (reported) payments separately", () => {
		expect(reportedTotal(payments)).toBe(400000);
	});

	it("is zero when fully paid", () => {
		expect(
			outstanding({ principal_minor: 1000 }, [
				{ amount_minor: 1000, kind: "payment", status: "confirmed" },
			]),
		).toBe(0);
	});

	it("throws when confirmed payments exceed the principal (BR-04 broken upstream)", () => {
		expect(() =>
			outstanding({ principal_minor: 1000 }, [
				{ amount_minor: 1001, kind: "payment", status: "confirmed" },
			]),
		).toThrow(RangeError);
	});
});
