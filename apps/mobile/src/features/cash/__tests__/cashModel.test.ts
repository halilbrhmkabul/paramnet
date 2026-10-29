import type { Transaction, TransactionEvent } from "@/api/types";
import { tr } from "@/i18n/tr";

import {
	amountOf,
	dayLabel,
	filterTransactions,
	groupByDay,
	keypadText,
	lastEditLine,
	monogram,
	pressKey,
	signOf,
	titleOf,
} from "../cashModel";

function tx(over: Partial<Transaction>): Transaction {
	return {
		id: "00000001-0000-4000-8000-000000000000",
		kind: "expense",
		account_id: "a",
		account_name: "Maaş Hesabı",
		to_account_id: null,
		to_account_name: null,
		card_id: null,
		card_name: null,
		to_card_id: null,
		to_card_name: null,
		installments: 1,
		amount_minor: 84230,
		category: "bills",
		title: null,
		note: null,
		occurred_on: "2026-10-08",
		deleted_at: null,
		row_version: 1,
		created_at: "2026-10-08T10:00:00Z",
		updated_at: "2026-10-08T10:00:00Z",
		...over,
	};
}

describe("pressKey (design 22 keypad)", () => {
	it("types digits, one comma and two decimals", () => {
		let text = "";
		for (const key of ["3", "5", "0", ",", "4", "5", "9"]) {
			text = pressKey(text, key);
		}
		expect(text).toBe("350,45");
		expect(amountOf(text)).toBe(35045);
		expect(pressKey("350,45", ",")).toBe("350,45");
	});

	it("starts an edit from the stored amount", () => {
		expect(keypadText(84230)).toBe("842,30");
		expect(keypadText(125000)).toBe("1250");
		expect(keypadText(5)).toBe("0,05");
		expect(amountOf(keypadText(84230))).toBe(84230);
	});

	it("deletes, drops a leading zero and caps the length", () => {
		expect(pressKey("35", "del")).toBe("3");
		expect(pressKey("3", "del")).toBe("");
		expect(pressKey("0", "7")).toBe("7");
		expect(pressKey("", ",")).toBe("0,");
		expect(pressKey("12345678901", "3")).toBe("12345678901");
		expect(amountOf("")).toBeNull();
		expect(amountOf("0")).toBe(0);
	});
});

describe("row texts", () => {
	it("titles a record by what the user wrote, then its category or accounts", () => {
		expect(titleOf(tx({ title: "Migros" }))).toBe("Migros");
		expect(titleOf(tx({}))).toBe(tr.categories.expense.bills);
		expect(titleOf(tx({ kind: "income", category: "salary" }))).toBe(
			tr.categories.income.salary,
		);
		expect(
			titleOf(
				tx({
					kind: "transfer",
					category: null,
					to_account_id: "b",
					to_account_name: "Birikim",
				}),
			),
		).toBe("Maaş Hesabı → Birikim");
		expect(titleOf(tx({ kind: "adjustment", category: null }))).toBe(
			tr.txHistory.adjustmentTitle,
		);
	});

	it("signs income, expense and adjustments; a transfer has no sign", () => {
		expect(signOf(tx({ kind: "income" }))).toBe("plus");
		expect(signOf(tx({}))).toBe("minus");
		expect(signOf(tx({ kind: "transfer" }))).toBe("none");
		expect(signOf(tx({ kind: "adjustment", amount_minor: -500 }))).toBe("minus");
		expect(signOf(tx({ kind: "adjustment", amount_minor: 500 }))).toBe("plus");
	});

	it("makes a two-letter mark in Turkish case", () => {
		expect(monogram("Migros")).toBe("Mİ");
		expect(monogram("İnternet ve telefon")).toBe("İV");
		expect(monogram("şok")).toBe("ŞO");
	});

	it("labels a day with its weekday", () => {
		expect(dayLabel("2026-10-11")).toBe("11 Ekim, Pazar");
	});
});

describe("filterTransactions and groupByDay", () => {
	const items = [
		tx({ id: "1", kind: "income", category: "salary", occurred_on: "2026-10-10" }),
		tx({ id: "2", title: "Migros", category: "groceries", occurred_on: "2026-10-10" }),
		tx({
			id: "3",
			kind: "transfer",
			category: null,
			to_account_id: "b",
			to_account_name: "Birikim",
			occurred_on: "2026-10-05",
		}),
		tx({ id: "4", kind: "adjustment", category: null, occurred_on: "2026-10-05" }),
	];

	it("filters by kind and searches title, category and account", () => {
		expect(filterTransactions(items, "income", "").map((t) => t.id)).toEqual(["1"]);
		expect(filterTransactions(items, "transfer", "").map((t) => t.id)).toEqual(["3"]);
		expect(filterTransactions(items, "all", "migros").map((t) => t.id)).toEqual(["2"]);
		expect(filterTransactions(items, "all", "market").map((t) => t.id)).toEqual(["2"]);
		expect(filterTransactions(items, "all", "BİRİKİM").map((t) => t.id)).toEqual(["3"]);
	});

	it("groups in the order given", () => {
		expect(groupByDay(items).map((g) => [g.date, g.items.length])).toEqual([
			["2026-10-10", 2],
			["2026-10-05", 2],
		]);
	});
});

describe("lastEditLine", () => {
	const created: TransactionEvent = {
		type: "created",
		changes: {},
		created_at: "2026-10-11T17:16:00Z",
	};

	it("is empty before any edit", () => {
		expect(lastEditLine([created], "expense")).toBeNull();
	});

	it("names a category change with its labels and other changes by field", () => {
		expect(
			lastEditLine(
				[
					created,
					{
						type: "updated",
						changes: { category: ["other", "groceries"] },
						created_at: "2026-10-11T17:18:00Z",
					},
				],
				"expense",
			),
		).toBe("Son düzenleme · kategori “Diğer” → “Market”, 11 Eki 2026, 20:18");
		expect(
			lastEditLine(
				[
					created,
					{
						type: "updated",
						changes: { amount_minor: [1, 2], note: [null, "x"] },
						created_at: "2026-10-11T17:18:00Z",
					},
				],
				"expense",
			),
		).toBe("Son düzenleme · tutar, not değişti, 11 Eki 2026, 20:18");
	});
});
