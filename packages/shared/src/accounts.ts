import { z } from "zod";

import { monthOf, type IsoDate } from "./dates";
import { ACCOUNT_KINDS, type TransactionKind } from "./enums";
import { NOTE_MAX, isoDateSchema, optionalText, requiredText, uuidSchema } from "./schemas";

// ADR-053: own accounts and cash records. Manual entries only; nothing here moves money.
export const ACCOUNT_NAME_MAX = 40;
export const BANK_NAME_MAX = 40;
export const TRANSACTION_TITLE_MAX = 80;
export const MAX_ACCOUNTS = 50;
// 100 billion TL keeps every sum of balances far below Number.MAX_SAFE_INTEGER.
export const CASH_AMOUNT_MAX_MINOR = 10_000_000_000_000;

// Codes, not labels: the app maps them to tr.ts. Same lists in SQL (test-vectors/accounts.json).
export const EXPENSE_CATEGORIES = [
	"food",
	"groceries",
	"transport",
	"bills",
	"rent",
	"health",
	"clothing",
	"other",
] as const;
export const INCOME_CATEGORIES = [
	"salary",
	"freelance",
	"rental_income",
	"refund",
	"other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type TransactionCategory = ExpenseCategory | IncomeCategory;

export function isCategoryFor(kind: TransactionKind, category: string): boolean {
	if (kind === "expense") {
		return (EXPENSE_CATEGORIES as readonly string[]).includes(category);
	}
	if (kind === "income") {
		return (INCOME_CATEGORIES as readonly string[]).includes(category);
	}
	return false;
}

function isCashAmount(value: number): boolean {
	return Number.isSafeInteger(value) && Math.abs(value) <= CASH_AMOUNT_MAX_MINOR;
}

export const accountInputSchema = z.strictObject({
	kind: z.enum(ACCOUNT_KINDS, { error: "invalid_option" }),
	name: requiredText(ACCOUNT_NAME_MAX),
	bank_name: optionalText(BANK_NAME_MAX),
	// A negative opening balance is an overdrawn account; it is a starting point, not income.
	opening_balance_minor: z
		.number({ error: "invalid_amount" })
		.refine(isCashAmount, { error: "invalid_amount" }),
	include_in_total: z.boolean({ error: "invalid_option" }),
});

export type AccountInput = z.output<typeof accountInputSchema>;

// Adjustments come only from "Bakiye düzelt" (adjust_account_balance), never from this form.
export const transactionInputSchema = z
	.strictObject({
		kind: z.enum(["expense", "income", "transfer"], { error: "invalid_option" }),
		account_id: uuidSchema,
		to_account_id: uuidSchema.nullable(),
		amount_minor: z
			.number({ error: "invalid_amount" })
			.refine((value) => isCashAmount(value) && value > 0, { error: "invalid_amount" }),
		category: z.string({ error: "invalid_category" }).nullable(),
		title: optionalText(TRANSACTION_TITLE_MAX),
		note: optionalText(NOTE_MAX),
		occurred_on: isoDateSchema,
	})
	.superRefine((input, ctx) => {
		if (input.kind === "transfer") {
			if (input.to_account_id === null || input.category !== null) {
				ctx.addIssue({
					code: "custom",
					message: "invalid_transfer",
					path: ["to_account_id"],
				});
			} else if (input.to_account_id === input.account_id) {
				ctx.addIssue({ code: "custom", message: "same_account", path: ["to_account_id"] });
			}
			return;
		}
		if (input.category === null || !isCategoryFor(input.kind, input.category)) {
			ctx.addIssue({ code: "custom", message: "invalid_category", path: ["category"] });
			return;
		}
		if (input.to_account_id !== null) {
			ctx.addIssue({ code: "custom", message: "invalid_transfer", path: ["to_account_id"] });
		}
	});

export type TransactionInput = z.output<typeof transactionInputSchema>;

export type CashAccount = {
	id: string;
	opening_balance_minor: number;
	include_in_total: boolean;
	archived: boolean;
};

export type CashTransaction = {
	kind: TransactionKind;
	account_id: string;
	to_account_id: string | null;
	// Signed only for adjustments; every other kind is positive.
	amount_minor: number;
	occurred_on: IsoDate;
	deleted: boolean;
};

export type CashSummary = {
	balances: Record<string, number>;
	total_cash_minor: number;
	income_minor: number;
	expense_minor: number;
};

function effectOn(tx: CashTransaction, accountId: string): number {
	if (tx.kind === "transfer") {
		return (
			(tx.to_account_id === accountId ? tx.amount_minor : 0) -
			(tx.account_id === accountId ? tx.amount_minor : 0)
		);
	}
	if (tx.account_id !== accountId) {
		return 0;
	}
	return tx.kind === "expense" ? -tx.amount_minor : tx.amount_minor;
}

// Balances are never stored (ADR-053): opening balance plus every live record. Transfers and
// adjustments move the balance but are neither income nor expense; the month sums all accounts.
export function deriveCash(
	accounts: readonly CashAccount[],
	transactions: readonly CashTransaction[],
	month: IsoDate,
): CashSummary {
	const live = transactions.filter((tx) => !tx.deleted);
	const balances: Record<string, number> = {};
	let total = 0;
	for (const account of accounts) {
		const balance = live.reduce(
			(sum, tx) => sum + effectOn(tx, account.id),
			account.opening_balance_minor,
		);
		balances[account.id] = balance;
		if (account.include_in_total && !account.archived) {
			total += balance;
		}
	}
	const inMonth = live.filter((tx) => monthOf(tx.occurred_on) === month);
	const sumOf = (kind: TransactionKind) =>
		inMonth.filter((tx) => tx.kind === kind).reduce((sum, tx) => sum + tx.amount_minor, 0);
	return {
		balances,
		total_cash_minor: total,
		income_minor: sumOf("income"),
		expense_minor: sumOf("expense"),
	};
}

export function adjustmentDelta(currentMinor: number, targetMinor: number): number {
	return targetMinor - currentMinor;
}

// "Kayıt no" on the detail screen (design 37); the id itself stays the reference.
export function transactionRef(id: string): string {
	return `TRX-${id.slice(0, 8).toUpperCase()}`;
}
