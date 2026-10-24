import { z } from "zod";

import { CASH_AMOUNT_MAX_MINOR } from "./accounts";
import { addDays, addMonthsClamped, type IsoDate } from "./dates";
import { requiredText, optionalText } from "./schemas";

// ADR-055: credit cards the user tracks by hand (design 07, 08, 09, 32). No card number, CVV or
// password; no interest (simulation is F4-07). Same arithmetic in SQL (test-vectors/cards.json).
export const CARD_COLORS = ["navy", "graphite", "midnight", "bordeaux"] as const;
export type CardColor = (typeof CARD_COLORS)[number];

export const CARD_NAME_MAX = 40;
export const MAX_CARD_INSTALLMENTS = 36;
// Up to the 28th, so every month has the day.
export const MAX_CARD_DAY = 28;

function dayField() {
	return z
		.number({ error: "invalid_day" })
		.refine((v) => Number.isSafeInteger(v) && v >= 1 && v <= MAX_CARD_DAY, {
			error: "invalid_day",
		});
}

export const cardInputSchema = z.strictObject({
	bank_name: requiredText(CARD_NAME_MAX),
	card_name: optionalText(CARD_NAME_MAX),
	last4: z.string({ error: "invalid_last4" }).regex(/^\d{4}$/, { error: "invalid_last4" }),
	color: z.enum(CARD_COLORS, { error: "invalid_option" }),
	limit_minor: z
		.number({ error: "invalid_amount" })
		.refine((v) => Number.isSafeInteger(v) && v > 0 && v <= CASH_AMOUNT_MAX_MINOR, {
			error: "invalid_amount",
		}),
	// What is owed when the card is added; it counts as already on the statement.
	opening_debt_minor: z
		.number({ error: "invalid_amount" })
		.refine((v) => Number.isSafeInteger(v) && v >= 0 && v <= CASH_AMOUNT_MAX_MINOR, {
			error: "invalid_amount",
		}),
	statement_day: dayField(),
	due_offset_days: dayField(),
	min_payment_rate: z
		.number({ error: "invalid_rate" })
		.refine((v) => Number.isSafeInteger(v) && v >= 1 && v <= 100, { error: "invalid_rate" }),
});

export type CardInput = z.output<typeof cardInputSchema>;

// The usual bank rule, offered as a starting value the user can change (design 32).
export function suggestedMinimumRate(limitMinor: number): number {
	return limitMinor > 5_000_000 ? 40 : 20;
}

// Equal parts; the kuruş left over goes on the first part.
export function installmentParts(amountMinor: number, count: number): number[] {
	const part = Math.floor(amountMinor / count);
	return Array.from({ length: count }, (_, i) =>
		i === 0 ? amountMinor - part * (count - 1) : part,
	);
}

export function cutsAround(today: IsoDate, statementDay: number): { last: IsoDate; next: IsoDate } {
	const thisMonth = `${today.slice(0, 8)}${String(statementDay).padStart(2, "0")}`;
	const last = Number(today.slice(8, 10)) >= statementDay ? thisMonth : previousMonth(thisMonth);
	return { last, next: addMonthsClamped(last, 1) };
}

function previousMonth(date: IsoDate): IsoDate {
	const [y, m, d] = date.split("-").map(Number) as [number, number, number];
	const year = m === 1 ? y - 1 : y;
	const month = m === 1 ? 12 : m - 1;
	return `${String(year)}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export type CardTerms = {
	limit_minor: number;
	opening_debt_minor: number;
	statement_day: number;
	due_offset_days: number;
	min_payment_rate: number;
	// Statements before this day (when the card was added) are not listed.
	since: IsoDate;
};

// expense: spending (installments ≥ 1); income: a refund; transfer: a payment to the card.
export type CardTransaction = {
	id: string;
	kind: "expense" | "income" | "transfer";
	amount_minor: number;
	occurred_on: IsoDate;
	installments: number;
};

export type StatementStatus = "paid" | "partial" | "unpaid";

export type CardState = {
	last_cut: IsoDate;
	next_cut: IsoDate;
	due_date: IsoDate;
	statement_minor: number;
	paid_since_minor: number;
	statement_remaining_minor: number;
	minimum_minor: number;
	minimum_remaining_minor: number;
	period_spent_minor: number;
	total_debt_minor: number;
	used_minor: number;
	available_minor: number;
	overdue: boolean;
	history: { cut: IsoDate; amount_minor: number; paid_minor: number; status: StatementStatus }[];
	installments: { id: string; part_minor: number; count: number; billed: number }[];
};

type Part = { date: IsoDate; amount: number };

function partsOf(tx: CardTransaction): Part[] {
	return installmentParts(tx.amount_minor, tx.installments).map((amount, k) => ({
		date: addMonthsClamped(tx.occurred_on, k),
		amount,
	}));
}

// A statement is everything billed up to its cut minus what was paid or refunded by then.
export function deriveCardState(
	card: CardTerms,
	transactions: readonly CardTransaction[],
	today: IsoDate,
): CardState {
	const parts = transactions.filter((t) => t.kind === "expense").flatMap(partsOf);
	const credits = transactions.filter((t) => t.kind !== "expense");
	const payments = transactions.filter((t) => t.kind === "transfer");
	const sum = (items: readonly { amount: number }[]) => items.reduce((s, i) => s + i.amount, 0);
	const creditsUpTo = (date: IsoDate) =>
		credits.filter((c) => c.occurred_on <= date).reduce((s, c) => s + c.amount_minor, 0);
	const closing = (cut: IsoDate) =>
		Math.max(
			0,
			card.opening_debt_minor + sum(parts.filter((p) => p.date <= cut)) - creditsUpTo(cut),
		);
	const paidIn = (after: IsoDate, until: IsoDate) =>
		payments
			.filter((p) => p.occurred_on > after && p.occurred_on <= until)
			.reduce((s, p) => s + p.amount_minor, 0);

	const { last, next } = cutsAround(today, card.statement_day);
	const statement = closing(last);
	const paidSince = paidIn(last, today);
	const remaining = Math.max(0, statement - paidSince);
	const minimum = Math.min(statement, Math.ceil((statement * card.min_payment_rate) / 100));
	const due = addDays(last, card.due_offset_days);
	const allCredits = credits.reduce((s, c) => s + c.amount_minor, 0);
	const used = Math.max(
		0,
		card.opening_debt_minor +
			transactions
				.filter((t) => t.kind === "expense")
				.reduce((s, t) => s + t.amount_minor, 0) -
			allCredits,
	);

	const history: CardState["history"] = [];
	let later = last;
	for (let k = 1; k <= 3; k += 1) {
		const cut = previousMonthCut(last, k);
		const amount = closing(cut);
		const paid = paidIn(cut, later);
		later = cut;
		if (amount === 0 || cut < card.since) {
			continue;
		}
		history.push({
			cut,
			amount_minor: amount,
			paid_minor: paid,
			status: paid >= amount ? "paid" : paid > 0 ? "partial" : "unpaid",
		});
	}

	return {
		last_cut: last,
		next_cut: next,
		due_date: due,
		statement_minor: statement,
		paid_since_minor: paidSince,
		statement_remaining_minor: remaining,
		minimum_minor: minimum,
		minimum_remaining_minor: Math.max(0, minimum - paidSince),
		period_spent_minor: sum(parts.filter((p) => p.date > last && p.date <= next)),
		total_debt_minor: Math.max(
			0,
			card.opening_debt_minor + sum(parts.filter((p) => p.date <= next)) - allCredits,
		),
		used_minor: used,
		available_minor: card.limit_minor - used,
		overdue: today > due && remaining > 0,
		history,
		installments: transactions
			.filter((t) => t.kind === "expense" && t.installments > 1)
			.map((t) => {
				const own = partsOf(t);
				return {
					id: t.id,
					part_minor: own[1]?.amount ?? t.amount_minor,
					count: t.installments,
					billed: own.filter((p) => p.date <= last).length,
				};
			})
			.filter((i) => i.billed < i.count),
	};
}

function previousMonthCut(cut: IsoDate, back: number): IsoDate {
	let date = cut;
	for (let i = 0; i < back; i += 1) {
		date = previousMonth(date);
	}
	return date;
}
