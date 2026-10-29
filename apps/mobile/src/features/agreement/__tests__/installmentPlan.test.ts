import {
	nextOpenIndex,
	paidOnDates,
	pastDueCount,
	planSplit,
	rowTiming,
	togglePaidCount,
} from "../installmentPlan";

const rows = [
	{ seq: 1, due_date: "2026-08-15", amount_minor: 333333 },
	{ seq: 2, due_date: "2026-09-15", amount_minor: 333333 },
	{ seq: 3, due_date: "2026-10-15", amount_minor: 333333 },
	{ seq: 4, due_date: "2026-11-15", amount_minor: 333333 },
	{ seq: 5, due_date: "2026-12-15", amount_minor: 333333 },
	{ seq: 6, due_date: "2027-01-15", amount_minor: 333335 },
];

describe("planSplit", () => {
	it("design 23: five equal rows and a last one that carries the kuruş", () => {
		expect(planSplit(rows)).toEqual({ count: 6, base: 333333, last: 333335, total: 2000000 });
	});
	it("a single row is its own base and last", () => {
		expect(planSplit([{ due_date: null, amount_minor: 500 }])).toEqual({
			count: 1,
			base: 500,
			last: 500,
			total: 500,
		});
	});
});

describe("pastDueCount", () => {
	it("counts the leading rows dated before today", () => {
		expect(pastDueCount(rows, "2026-10-12")).toBe(2);
		expect(pastDueCount(rows, "2026-09-15")).toBe(1);
		expect(pastDueCount(rows, "2026-08-01")).toBe(0);
	});
	it("an open-ended row is never past", () => {
		expect(pastDueCount([{ due_date: null, amount_minor: 1 }], "2026-10-12")).toBe(0);
	});
});

describe("togglePaidCount", () => {
	// FIFO allocation: only "the first n" can be paid, so ticking a row ticks every row before it.
	it("ticking a row pays it and every earlier row", () => {
		expect(togglePaidCount(0, 2, true)).toBe(2);
	});
	it("unticking a row unpays it and every later row", () => {
		expect(togglePaidCount(2, 1, false)).toBe(0);
		expect(togglePaidCount(2, 2, false)).toBe(1);
	});
});

describe("rowTiming", () => {
	it("past, today, soon (within 7 days) and planned", () => {
		expect(rowTiming("2026-09-15", "2026-10-12")).toEqual({ kind: "past" });
		expect(rowTiming("2026-10-12", "2026-10-12")).toEqual({ kind: "today" });
		expect(rowTiming("2026-10-15", "2026-10-12")).toEqual({ kind: "soon", days: 3 });
		expect(rowTiming("2026-10-19", "2026-10-12")).toEqual({ kind: "soon", days: 7 });
		expect(rowTiming("2026-10-20", "2026-10-12")).toEqual({ kind: "planned" });
		expect(rowTiming(null, "2026-10-12")).toEqual({ kind: "planned" });
	});
});

describe("nextOpenIndex", () => {
	it("is the first row not fully paid", () => {
		expect(
			nextOpenIndex([
				{ amount_minor: 10, paid_minor: 10 },
				{ amount_minor: 10, paid_minor: 4 },
				{ amount_minor: 10, paid_minor: 0 },
			]),
		).toBe(1);
	});
	it("is -1 when everything is paid", () => {
		expect(nextOpenIndex([{ amount_minor: 10, paid_minor: 10 }])).toBe(-1);
	});
});

describe("paidOnDates", () => {
	// Payments are allocated FIFO in the order they were recorded; a row is paid on the day it filled up.
	it("dates each fully paid row with the payment that completed it", () => {
		expect(
			paidOnDates(
				[
					{ amount_minor: 100, paid_minor: 100 },
					{ amount_minor: 100, paid_minor: 100 },
					{ amount_minor: 100, paid_minor: 50 },
				],
				[
					{
						amount_minor: 500,
						paid_on: "2026-07-15",
						kind: "down_payment",
						status: "confirmed",
						created_at: "2026-07-15T09:00:00Z",
					},
					{
						amount_minor: 150,
						paid_on: "2026-08-14",
						kind: "payment",
						status: "confirmed",
						created_at: "2026-08-14T09:00:00Z",
					},
					{
						amount_minor: 20,
						paid_on: "2026-09-01",
						kind: "payment",
						status: "reported",
						created_at: "2026-09-01T09:00:00Z",
					},
					{
						amount_minor: 100,
						paid_on: "2026-09-14",
						kind: "payment",
						status: "confirmed",
						created_at: "2026-09-14T09:00:00Z",
					},
				],
			),
		).toEqual(["2026-08-14", "2026-09-14", null]);
	});
	// create_agreement_with_paid writes several payments in one transaction: same created_at, and the list
	// may come back newest first. Due-date order is the recording order then.
	it("breaks a created_at tie by payment date", () => {
		expect(
			paidOnDates(
				[
					{ amount_minor: 100, paid_minor: 100 },
					{ amount_minor: 100, paid_minor: 100 },
				],
				[
					{
						amount_minor: 100,
						paid_on: "2026-09-15",
						kind: "payment",
						status: "confirmed",
						created_at: "2026-10-29T09:00:00Z",
					},
					{
						amount_minor: 100,
						paid_on: "2026-08-15",
						kind: "payment",
						status: "confirmed",
						created_at: "2026-10-29T09:00:00Z",
					},
				],
			),
		).toEqual(["2026-08-15", "2026-09-15"]);
	});
});
