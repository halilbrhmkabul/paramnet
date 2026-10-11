import { addDays, addMonthsClamped, isIsoDate, type IsoDate } from "./dates";
import { isMinorAmount, type MinorAmount } from "./money";

// "Custom" (özel) in the UI is not a generator: the user edits rows and validatePlan checks them (ADR-012).
export const PLAN_PERIODS = ["monthly", "weekly", "biweekly"] as const;
export type PlanPeriod = (typeof PLAN_PERIODS)[number];

// 10 years of monthly installments; a row count the UI and reminders can still handle.
export const MAX_INSTALLMENTS = 120;

// Same shape as `agreement_versions.terms.plan` rows so terms hashing and plpgsql vectors need no mapping.
export type PlanInstallment = { seq: number; due_date: IsoDate | null; amount_minor: MinorAmount };
export type PlanRowInput = { due_date: string | null; amount_minor: number };

export type PlanError =
	| "invalid_principal"
	| "invalid_down_payment"
	| "down_payment_too_large"
	| "invalid_count"
	| "count_exceeds_remaining"
	| "invalid_due_date"
	| "due_date_required"
	| "empty_plan"
	| "non_positive_installment"
	| "sum_mismatch"
	| "dates_not_ascending";

export type PlanResult =
	{ ok: true; plan: PlanInstallment[] } | { ok: false; error: PlanError; index?: number };

export type GeneratePlanInput = {
	principal: number;
	downPayment: number;
	count: number;
	period: PlanPeriod;
	firstDueDate: string | null;
};

export type ValidatePlanInput = {
	principal: number;
	downPayment: number;
	installments: readonly PlanRowInput[];
};

type Failure = Extract<PlanResult, { ok: false }>;

function fail(error: PlanError, index?: number): Failure {
	return index === undefined ? { ok: false, error } : { ok: false, error, index };
}

// Shared by both entry points; returns the remaining amount the installments must cover (BR-03).
function checkAmounts(
	principal: number,
	downPayment: number,
): Failure | { remaining: MinorAmount } {
	if (!isMinorAmount(principal) || principal === 0) {
		return fail("invalid_principal");
	}
	if (!isMinorAmount(downPayment)) {
		return fail("invalid_down_payment");
	}
	// A fully prepaid record would have no installment > 0, so it is not an agreement.
	if (downPayment >= principal) {
		return fail("down_payment_too_large");
	}
	return { remaining: principal - downPayment };
}

function isValidCount(count: number): boolean {
	return Number.isSafeInteger(count) && count >= 1 && count <= MAX_INSTALLMENTS;
}

function dueDateAt(first: IsoDate, period: PlanPeriod, k: number): IsoDate {
	switch (period) {
		case "monthly":
			return addMonthsClamped(first, k);
		case "weekly":
			return addDays(first, 7 * k);
		case "biweekly":
			return addDays(first, 14 * k);
	}
}

export function generatePlan({
	principal,
	downPayment,
	count,
	period,
	firstDueDate,
}: GeneratePlanInput): PlanResult {
	const amounts = checkAmounts(principal, downPayment);
	if ("error" in amounts) {
		return amounts;
	}
	const { remaining } = amounts;
	if (!isValidCount(count)) {
		return fail("invalid_count");
	}
	if (remaining < count) {
		return fail("count_exceeds_remaining");
	}
	if (firstDueDate !== null && !isIsoDate(firstDueDate)) {
		return fail("invalid_due_date");
	}
	if (firstDueDate === null && count > 1) {
		return fail("due_date_required");
	}

	const base = Math.floor(remaining / count);
	const last = remaining - base * (count - 1);
	const plan: PlanInstallment[] = [];
	for (let k = 0; k < count; k++) {
		plan.push({
			seq: k + 1,
			// Every date is offset from the first due date, never from the previous row, so clamps don't drift.
			due_date: firstDueDate === null ? null : dueDateAt(firstDueDate, period, k),
			amount_minor: k === count - 1 ? last : base,
		});
	}
	return { ok: true, plan };
}

export function validatePlan({
	principal,
	downPayment,
	installments,
}: ValidatePlanInput): PlanResult {
	const amounts = checkAmounts(principal, downPayment);
	if ("error" in amounts) {
		return amounts;
	}
	const { remaining } = amounts;
	if (installments.length === 0) {
		return fail("empty_plan");
	}
	if (!isValidCount(installments.length)) {
		return fail("invalid_count");
	}

	const plan: PlanInstallment[] = [];
	let total = 0;
	let previousDate: IsoDate | null = null;
	for (const [index, row] of installments.entries()) {
		if (!isMinorAmount(row.amount_minor) || row.amount_minor === 0) {
			return fail("non_positive_installment", index);
		}
		const dueDate = row.due_date;
		if (dueDate === null) {
			if (installments.length > 1) {
				return fail("due_date_required", index);
			}
		} else {
			if (!isIsoDate(dueDate)) {
				return fail("invalid_due_date", index);
			}
			if (previousDate !== null && dueDate < previousDate) {
				return fail("dates_not_ascending", index);
			}
			previousDate = dueDate;
		}
		total += row.amount_minor;
		plan.push({ seq: index + 1, due_date: dueDate, amount_minor: row.amount_minor });
	}
	// Rows are positive, so a total past the safe range only grows and can never equal remaining.
	if (!Number.isSafeInteger(total) || total !== remaining) {
		return fail("sum_mismatch");
	}
	return { ok: true, plan };
}
