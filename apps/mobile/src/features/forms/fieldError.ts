import { tr } from "@/i18n/tr";

// Zod issue messages from @paramnet/shared are codes (ADR-014); this is the only place they become text.
const MESSAGES: Partial<Record<string, string>> = {
	required: tr.form.required,
	too_long: tr.form.tooLong,
	invalid_phone: tr.phone.errorInvalid,
	contact_required: tr.form.contactRequired,
	invalid_amount: tr.form.amountRequired,
	invalid_principal: tr.form.amountRequired,
	invalid_down_payment: tr.form.amountRequired,
	invalid_date: tr.form.invalidDate,
	invalid_due_date: tr.form.invalidDate,
	due_date_required: tr.form.dateRequired,
	invalid_count: tr.form.invalidCount,
	down_payment_too_large: tr.form.downPaymentTooLarge,
	count_exceeds_remaining: tr.form.countExceedsRemaining,
	dates_not_ascending: tr.form.datesNotAscending,
	non_positive_installment: tr.form.nonPositiveInstallment,
	sum_mismatch: tr.form.sumMismatch,
};

export function messageForCode(code: string): string {
	return MESSAGES[code] ?? tr.error.validation;
}
