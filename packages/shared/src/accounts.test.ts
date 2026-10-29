import { describe, expect, it } from "vitest";

import vectors from "../test-vectors/accounts.json";
import {
	CASH_AMOUNT_MAX_MINOR,
	accountInputSchema,
	adjustmentDelta,
	deriveCash,
	isCategoryFor,
	transactionInputSchema,
	transactionRef,
} from "./accounts";
import { TRANSACTION_KINDS, type TransactionKind } from "./enums";

const ACCOUNT_ID = "6f0c2b1e-4b4a-4d55-9d0e-0b8a8f6b5c11";
const OTHER_ID = "7a1d3c2f-5c5b-4e66-8e1f-1c9b9a7c6d22";

function isKind(value: string): value is TransactionKind {
	return (TRANSACTION_KINDS as readonly string[]).includes(value);
}

describe("isCategoryFor", () => {
	it.each(vectors.categories)("$name", ({ kind, category, expected }) => {
		if (!isKind(kind)) {
			throw new Error(`unknown kind ${kind}`);
		}
		expect(isCategoryFor(kind, category)).toBe(expected);
	});
});

describe("deriveCash", () => {
	it.each(vectors.balances)("$name", ({ accounts, transactions, month, expected }) => {
		const result = deriveCash(
			accounts,
			transactions.map((tx) => {
				if (!isKind(tx.kind)) {
					throw new Error(`unknown kind ${tx.kind}`);
				}
				return { ...tx, kind: tx.kind };
			}),
			month,
		);
		expect(result).toEqual(expected);
	});
});

describe("adjustmentDelta", () => {
	it("is the difference from the current balance", () => {
		expect(adjustmentDelta(198500, 200000)).toBe(1500);
		expect(adjustmentDelta(198500, 0)).toBe(-198500);
		expect(adjustmentDelta(-500, 500)).toBe(1000);
	});
});

describe("transactionRef", () => {
	it("shows the first eight characters of the id", () => {
		expect(transactionRef("3f9a1c2b-0000-4000-8000-000000000000")).toBe("TRX-3F9A1C2B");
	});
});

describe("accountInputSchema", () => {
	const valid = {
		kind: "bank",
		name: "  Maaş Hesabı ",
		bank_name: "İş Bankası",
		opening_balance_minor: 125000,
		include_in_total: true,
	};

	it("trims names and keeps a negative opening balance", () => {
		expect(accountInputSchema.parse({ ...valid, opening_balance_minor: -5000 })).toEqual({
			...valid,
			name: "Maaş Hesabı",
			opening_balance_minor: -5000,
		});
	});

	it("turns an empty bank name into null", () => {
		expect(accountInputSchema.parse({ ...valid, bank_name: " " }).bank_name).toBeNull();
	});

	it("rejects what the server rejects", () => {
		const issue = (input: unknown) =>
			accountInputSchema.safeParse(input).error?.issues[0]?.message;
		expect(issue({ ...valid, name: "" })).toBe("required");
		expect(issue({ ...valid, name: "x".repeat(41) })).toBe("too_long");
		expect(issue({ ...valid, kind: "crypto" })).toBe("invalid_option");
		expect(issue({ ...valid, opening_balance_minor: 1.5 })).toBe("invalid_amount");
		expect(issue({ ...valid, opening_balance_minor: CASH_AMOUNT_MAX_MINOR + 1 })).toBe(
			"invalid_amount",
		);
		expect(issue({ ...valid, iban: "TR00" })).toBeDefined();
	});
});

describe("transactionInputSchema", () => {
	const expense = {
		kind: "expense",
		account_id: ACCOUNT_ID,
		to_account_id: null,
		amount_minor: 128460,
		category: "groceries",
		title: "Migros",
		note: " ",
		occurred_on: "2026-10-11",
	};

	it("accepts an expense and empties a blank note", () => {
		expect(transactionInputSchema.parse(expense)).toEqual({
			...expense,
			note: null,
			card_id: null,
			to_card_id: null,
			installments: 1,
		});
	});

	it("puts a card purchase on the card, in instalments if asked (ADR-055)", () => {
		const onCard = { ...expense, account_id: null, card_id: OTHER_ID, installments: 3 };
		expect(transactionInputSchema.parse(onCard)).toMatchObject({
			card_id: OTHER_ID,
			installments: 3,
		});
		const issue = (input: unknown) =>
			transactionInputSchema.safeParse(input).error?.issues[0]?.message;
		expect(issue({ ...expense, installments: 3 })).toBe("invalid_installments");
		expect(issue({ ...expense, card_id: OTHER_ID })).toBe("invalid_source");
		expect(issue({ ...expense, account_id: null })).toBe("invalid_source");
		expect(
			issue({
				...expense,
				kind: "transfer",
				category: null,
				title: null,
				to_card_id: OTHER_ID,
			}),
		).toBeUndefined();
		expect(
			issue({
				...expense,
				kind: "transfer",
				category: null,
				to_card_id: OTHER_ID,
				to_account_id: OTHER_ID,
			}),
		).toBe("invalid_transfer");
	});

	it("accepts a transfer without a category", () => {
		const transfer = {
			...expense,
			kind: "transfer",
			to_account_id: OTHER_ID,
			category: null,
			title: null,
		};
		expect(transactionInputSchema.parse(transfer)).toEqual({
			...transfer,
			note: null,
			card_id: null,
			to_card_id: null,
			installments: 1,
		});
	});

	it("rejects wrong combinations", () => {
		const issue = (input: unknown) =>
			transactionInputSchema.safeParse(input).error?.issues[0]?.message;
		expect(issue({ ...expense, amount_minor: 0 })).toBe("invalid_amount");
		expect(issue({ ...expense, category: "salary" })).toBe("invalid_category");
		expect(issue({ ...expense, category: null })).toBe("invalid_category");
		expect(issue({ ...expense, to_account_id: OTHER_ID })).toBe("invalid_transfer");
		expect(issue({ ...expense, kind: "transfer", category: null })).toBe("invalid_transfer");
		expect(
			issue({ ...expense, kind: "transfer", category: null, to_account_id: ACCOUNT_ID }),
		).toBe("same_account");
		expect(issue({ ...expense, kind: "adjustment" })).toBe("invalid_option");
		expect(issue({ ...expense, occurred_on: "2026-13-01" })).toBe("invalid_date");
	});
});
