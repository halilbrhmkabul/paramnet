import { describe, expect, it } from "vitest";

import { counterFromForm } from "../counter";

const base = { principal_minor: 300000, down_payment_minor: 0, notes: "Elden" };

function form(entries: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(entries)) {
		data.set(key, value);
	}
	return data;
}

describe("counterFromForm", () => {
	it("builds terms from the edited rows, keeping total, down payment and notes", () => {
		expect(
			counterFromForm(
				base,
				form({
					rows: "3",
					"due_date.1": "2026-11-10",
					"amount.1": "1.000",
					"due_date.2": "2026-12-10",
					"amount.2": "1.000,00",
					"due_date.3": "2027-01-10",
					"amount.3": "1000",
				}),
			),
		).toEqual({
			ok: true,
			terms: {
				...base,
				plan: [
					{ seq: 1, due_date: "2026-11-10", amount_minor: 100000 },
					{ seq: 2, due_date: "2026-12-10", amount_minor: 100000 },
					{ seq: 3, due_date: "2027-01-10", amount_minor: 100000 },
				],
			},
		});
	});

	it("reports the plan rule that fails (BR-03, dates)", () => {
		expect(
			counterFromForm(
				base,
				form({ rows: "1", "due_date.1": "2026-11-10", "amount.1": "2.000" }),
			),
		).toEqual({ ok: false, error: "sum_mismatch" });
		expect(
			counterFromForm(
				base,
				form({
					rows: "2",
					"due_date.1": "2026-12-10",
					"amount.1": "1.500",
					"due_date.2": "2026-11-10",
					"amount.2": "1.500",
				}),
			),
		).toEqual({ ok: false, error: "dates_not_ascending" });
		expect(
			counterFromForm(
				base,
				form({ rows: "1", "due_date.1": "2026-11-10", "amount.1": "abc" }),
			),
		).toEqual({
			ok: false,
			error: "invalid_amount",
		});
		expect(counterFromForm(base, form({ rows: "500" }))).toEqual({
			ok: false,
			error: "invalid_count",
		});
	});
});
