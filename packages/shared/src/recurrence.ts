import { z } from "zod";

import {
	CASH_AMOUNT_MAX_MINOR,
	TRANSACTION_CATEGORIES,
	TRANSACTION_TITLE_MAX,
	isCategoryFor,
} from "./accounts";
import { addDays, addMonthsClamped, type IsoDate } from "./dates";
import { isoDateSchema, requiredText, uuidSchema } from "./schemas";

// ADR-054: repeating income and expense (design 38). Same date rule in SQL (test-vectors/recurrence.json).
export const RECURRENCE_FREQUENCIES = ["weekly", "monthly", "yearly"] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

// Enough for a weekly rule over seven years; a longer gap means the rule was forgotten, not owed.
const MAX_DATES = 400;

// The n-th date counts from the start, never from the previous date: 31 Jan → 28 Feb → 31 Mar.
function occurrence(start: IsoDate, frequency: RecurrenceFrequency, n: number): IsoDate {
	if (frequency === "weekly") {
		return addDays(start, 7 * n);
	}
	return addMonthsClamped(start, frequency === "monthly" ? n : 12 * n);
}

// The first index whose date is on or after `from` (0 when the rule starts later).
function firstIndex(start: IsoDate, frequency: RecurrenceFrequency, from: IsoDate): number {
	if (from <= start) {
		return 0;
	}
	const [sy, sm, sd] = start.split("-").map(Number) as [number, number, number];
	const [fy, fm, fd] = from.split("-").map(Number) as [number, number, number];
	let n: number;
	if (frequency === "weekly") {
		const days = (Date.UTC(fy, fm - 1, fd) - Date.UTC(sy, sm - 1, sd)) / 86_400_000;
		n = Math.floor(days / 7);
	} else {
		const months = (fy - sy) * 12 + (fm - sm);
		n = frequency === "monthly" ? months : Math.floor(months / 12);
	}
	n = Math.max(0, n - 1);
	while (occurrence(start, frequency, n) < from) {
		n += 1;
	}
	return n;
}

export function nextOccurrences(
	start: IsoDate,
	frequency: RecurrenceFrequency,
	from: IsoDate,
	count: number,
): IsoDate[] {
	const first = firstIndex(start, frequency, from);
	return Array.from({ length: Math.min(count, MAX_DATES) }, (_, i) =>
		occurrence(start, frequency, first + i),
	);
}

// Every date in [from, to], both ends included.
export function occurrencesBetween(
	start: IsoDate,
	frequency: RecurrenceFrequency,
	from: IsoDate,
	to: IsoDate,
): IsoDate[] {
	const dates: IsoDate[] = [];
	for (let n = firstIndex(start, frequency, from); dates.length < MAX_DATES; n += 1) {
		const date = occurrence(start, frequency, n);
		if (date > to) {
			break;
		}
		dates.push(date);
	}
	return dates;
}

export const recurringInputSchema = z
	.strictObject({
		kind: z.enum(["expense", "income"], { error: "invalid_option" }),
		name: requiredText(TRANSACTION_TITLE_MAX),
		amount_minor: z
			.number({ error: "invalid_amount" })
			.refine((v) => Number.isSafeInteger(v) && v > 0 && v <= CASH_AMOUNT_MAX_MINOR, {
				error: "invalid_amount",
			}),
		category: z.enum(TRANSACTION_CATEGORIES, { error: "invalid_category" }),
		account_id: uuidSchema,
		frequency: z.enum(RECURRENCE_FREQUENCIES, { error: "invalid_option" }),
		start_on: isoDateSchema,
		// On: each date waits as "planned" until confirmed; off: it is recorded on the day.
		confirm_each: z.boolean({ error: "invalid_option" }),
	})
	.superRefine((input, ctx) => {
		if (!isCategoryFor(input.kind, input.category)) {
			ctx.addIssue({ code: "custom", message: "invalid_category", path: ["category"] });
		}
	});

export type RecurringInput = z.output<typeof recurringInputSchema>;

// Design 39: amber from 80% of the limit, red once over it.
export type BudgetLevel = "ok" | "near" | "over";

export function budgetLevel(spentMinor: number, limitMinor: number): BudgetLevel {
	if (spentMinor > limitMinor) {
		return "over";
	}
	return spentMinor * 5 >= limitMinor * 4 ? "near" : "ok";
}
