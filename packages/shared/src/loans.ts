import { z } from "zod";

import { CASH_AMOUNT_MAX_MINOR } from "./accounts";
import { addMonthsClamped, type IsoDate } from "./dates";
import { isoDateSchema, requiredText, uuidSchema } from "./schemas";

// ADR-056: the user's own bank loans (design 28, 34). Interest is computed only to show the plan
// (ADR-045); nothing here touches an agreement. Money stays integer kuruş: BigInt for the annuity.
// Same arithmetic in SQL (test-vectors/loans.json).
export const MAX_LOAN_TERM = 120;
// Monthly rate in hundredths of a percent: 339 = %3,39.
export const MAX_LOAN_RATE_BPS = 2000;

export const loanInputSchema = z.strictObject({
	bank_name: requiredText(40),
	loan_type: requiredText(40),
	principal_minor: z
		.number({ error: "invalid_amount" })
		.refine((v) => Number.isSafeInteger(v) && v > 0 && v <= CASH_AMOUNT_MAX_MINOR, {
			error: "invalid_amount",
		}),
	monthly_rate_bps: z
		.number({ error: "invalid_rate" })
		.refine((v) => Number.isSafeInteger(v) && v >= 0 && v <= MAX_LOAN_RATE_BPS, {
			error: "invalid_rate",
		}),
	term_months: z
		.number({ error: "invalid_term" })
		.refine((v) => Number.isSafeInteger(v) && v >= 1 && v <= MAX_LOAN_TERM, {
			error: "invalid_term",
		}),
	first_due_on: isoDateSchema,
	// The bank's figure when it differs from ours; the last installment absorbs the difference.
	installment_minor: z
		.number({ error: "invalid_amount" })
		.refine((v) => Number.isSafeInteger(v) && v > 0 && v <= CASH_AMOUNT_MAX_MINOR, {
			error: "invalid_amount",
		}),
	payment_account_id: uuidSchema.nullable(),
});

export type LoanInput = z.output<typeof loanInputSchema>;

// Half up to the kuruş: (2a + b) / 2b.
function roundDiv(numerator: bigint, denominator: bigint): bigint {
	return (numerator * 2n + denominator) / (2n * denominator);
}

// The equal monthly payment P·r / (1 − (1 + r)^−n), exactly, with r = bps / 10000.
export function annuityPayment(
	principalMinor: number,
	rateBps: number,
	termMonths: number,
): number {
	const p = BigInt(principalMinor);
	const n = BigInt(termMonths);
	if (rateBps === 0) {
		return Number(roundDiv(p, n));
	}
	const a = (10000n + BigInt(rateBps)) ** n;
	const b = 10000n ** n;
	return Number(roundDiv(p * BigInt(rateBps) * a, 10000n * (a - b)));
}

export type LoanRow = {
	seq: number;
	due_date: IsoDate;
	payment_minor: number;
	principal_minor: number;
	interest_minor: number;
	balance_minor: number;
};

// Each month: interest on what is left, the rest of the payment repays principal; the last row clears it.
export function loanSchedule(
	principalMinor: number,
	rateBps: number,
	termMonths: number,
	firstDue: IsoDate,
	installmentMinor: number,
): LoanRow[] {
	let balance = BigInt(principalMinor);
	const rows: LoanRow[] = [];
	for (let k = 1; k <= termMonths; k += 1) {
		const interest = roundDiv(balance * BigInt(rateBps), 10000n);
		let principal = BigInt(installmentMinor) - interest;
		if (principal < 0n) {
			principal = 0n;
		}
		if (k === termMonths || principal > balance) {
			principal = balance;
		}
		balance -= principal;
		rows.push({
			seq: k,
			due_date: addMonthsClamped(firstDue, k - 1),
			payment_minor: Number(principal + interest),
			principal_minor: Number(principal),
			interest_minor: Number(interest),
			balance_minor: Number(balance),
		});
	}
	return rows;
}

export type LoanSummary = {
	paid: number;
	remaining_principal_minor: number;
	remaining_total_minor: number;
	remaining_count: number;
	total_payment_minor: number;
	total_interest_minor: number;
	next: LoanRow | null;
	last_due: IsoDate | null;
};

// After `paid` installments have been recorded.
export function loanSummary(
	rows: readonly LoanRow[],
	principalMinor: number,
	paid: number,
): LoanSummary {
	const done = Math.min(paid, rows.length);
	const left = rows.slice(done);
	const total = rows.reduce((s, r) => s + r.payment_minor, 0);
	return {
		paid: done,
		remaining_principal_minor:
			done === 0 ? principalMinor : (rows[done - 1]?.balance_minor ?? 0),
		remaining_total_minor: left.reduce((s, r) => s + r.payment_minor, 0),
		remaining_count: left.length,
		total_payment_minor: total,
		total_interest_minor: total - principalMinor,
		next: left[0] ?? null,
		last_due: rows.at(-1)?.due_date ?? null,
	};
}

// "2,99" → 299; at most two decimals, nothing else (the form's rate field).
export function parseRateBps(text: string): number | null {
	const match = /^(\d{1,2})(?:[.,](\d{1,2}))?$/.exec(text.trim());
	if (match === null) {
		return null;
	}
	const whole = Number(match[1]);
	const fraction = Number((match[2] ?? "").padEnd(2, "0"));
	return whole * 100 + fraction;
}

// 339 → "%3,39".
export function formatRateBps(bps: number): string {
	return `%${String(Math.floor(bps / 100))},${String(bps % 100).padStart(2, "0")}`;
}
