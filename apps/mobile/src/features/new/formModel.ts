import {
	addMonthsClamped,
	generatePlan,
	nonNegativeMinorSchema,
	positiveMinorSchema,
	termsNotesSchema,
	titleSchema,
	type AgreementKind,
	type ContactInput,
	type CreateAgreementInput,
	type IsoDate,
	type PartyRole,
	type PlanError,
	type PlanInstallment,
	type PlanPeriod,
} from "@paramnet/shared";

import { tr } from "@/i18n/tr";

export type NewType = "lent" | "borrowed" | "boughtInstallment" | "soldInstallment";

// Spec 5.2: the four choices map to agreement kind + the creator's role.
export const NEW_TYPES: Record<
	NewType,
	{ kind: AgreementKind; role: PartyRole; purchase: boolean }
> = {
	lent: { kind: "loan", role: "creditor", purchase: false },
	borrowed: { kind: "loan", role: "debtor", purchase: false },
	boughtInstallment: { kind: "installment_purchase", role: "debtor", purchase: true },
	soldInstallment: { kind: "installment_purchase", role: "creditor", purchase: true },
};

export type ContactChoice = { contact_id: string } | { contact: ContactInput };

export type NewFormValues = {
	contact: ContactChoice | null;
	// Name shown in the form for the chosen contact.
	contact_label: string;
	title: string;
	// Loans: when the money changed hands (spec 5.2, ADR-019). Installments: the purchase date, which
	// also dates the down payment (ADR-059).
	started_on: IsoDate | null;
	amount_minor: number | null;
	down_payment_minor: number | null;
	repayment: "once" | "installments";
	count: string;
	period: PlanPeriod;
	first_due_date: IsoDate | null;
	notes: string;
};

export type FormErrors = Partial<Record<keyof NewFormValues, string>>;

// Spec 5.2 / screens.md: monthly, first payment one month from today. Design 23 starts at 6 rows.
export function defaultValues(today: IsoDate, purchase = false): NewFormValues {
	return {
		contact: null,
		contact_label: "",
		title: "",
		started_on: today,
		amount_minor: null,
		down_payment_minor: null,
		repayment: "once",
		count: purchase ? "6" : "3",
		period: "monthly",
		first_due_date: addMonthsClamped(today, 1),
		notes: "",
	};
}

export function usesInstallments(type: NewType, values: NewFormValues): boolean {
	return NEW_TYPES[type].purchase || values.repayment === "installments";
}

function countOf(type: NewType, values: NewFormValues): number {
	return usesInstallments(type, values) ? Number(values.count) : 1;
}

function downPaymentOf(type: NewType, values: NewFormValues): number {
	return NEW_TYPES[type].purchase ? (values.down_payment_minor ?? 0) : 0;
}

const PLAN_ERROR_FIELD: Partial<Record<PlanError, keyof NewFormValues>> = {
	invalid_principal: "amount_minor",
	invalid_down_payment: "down_payment_minor",
	down_payment_too_large: "down_payment_minor",
	invalid_count: "count",
	count_exceeds_remaining: "count",
	invalid_due_date: "first_due_date",
	due_date_required: "first_due_date",
};

// Field errors are codes; the screen turns them into Turkish with messageForCode.
export function validateForm(type: NewType, values: NewFormValues): FormErrors {
	const errors: FormErrors = {};
	if (values.contact === null) {
		errors.contact = "contact_required";
	}
	if (NEW_TYPES[type].purchase) {
		const title = titleSchema.safeParse(values.title);
		if (!title.success) {
			errors.title = title.error.issues[0]?.message;
		}
		if (
			values.down_payment_minor !== null &&
			!nonNegativeMinorSchema.safeParse(values.down_payment_minor).success
		) {
			errors.down_payment_minor = "invalid_amount";
		}
	}
	if (!positiveMinorSchema.safeParse(values.amount_minor).success) {
		errors.amount_minor = "invalid_amount";
	}
	if (usesInstallments(type, values)) {
		const count = Number(values.count);
		if (!/^\d+$/.test(values.count) || count < 1 || count > 120) {
			errors.count = "invalid_count";
		}
	}
	if (!termsNotesSchema.safeParse(values.notes).success) {
		errors.notes = "too_long";
	}
	if (Object.keys(errors).length > 0) {
		return errors;
	}

	const plan = generatePlan({
		principal: values.amount_minor ?? 0,
		downPayment: downPaymentOf(type, values),
		count: countOf(type, values),
		period: values.period,
		firstDueDate: values.first_due_date,
	});
	if (!plan.ok) {
		errors[PLAN_ERROR_FIELD[plan.error] ?? "amount_minor"] = plan.error;
	}
	return errors;
}

export function planFromValues(type: NewType, values: NewFormValues): PlanInstallment[] {
	const result = generatePlan({
		principal: values.amount_minor ?? 0,
		downPayment: downPaymentOf(type, values),
		count: countOf(type, values),
		period: values.period,
		firstDueDate: values.first_due_date,
	});
	if (!result.ok) {
		throw new Error(`planFromValues called with invalid values: ${result.error}`);
	}
	return result.plan;
}

// The live preview on design 23: null while the amounts or dates cannot make a plan yet.
export function tryPlan(type: NewType, values: NewFormValues): PlanInstallment[] | null {
	const result = generatePlan({
		principal: values.amount_minor ?? 0,
		downPayment: downPaymentOf(type, values),
		count: countOf(type, values),
		period: values.period,
		firstDueDate: values.first_due_date,
	});
	return result.ok ? result.plan : null;
}

export function remainingOf(type: NewType, values: NewFormValues): number {
	return (values.amount_minor ?? 0) - downPaymentOf(type, values);
}

export function toCreateInput(
	type: NewType,
	values: NewFormValues,
	plan: PlanInstallment[],
): CreateAgreementInput {
	const config = NEW_TYPES[type];
	if (values.contact === null) {
		throw new Error("toCreateInput called without a contact");
	}
	const notes = values.notes.trim().normalize("NFC");
	return {
		kind: config.kind,
		creator_role: config.role,
		title: config.purchase ? values.title.trim().normalize("NFC") : tr.new.loanTitle,
		description: null,
		started_on: values.started_on,
		counterparty: values.contact,
		terms: {
			principal_minor: values.amount_minor ?? 0,
			down_payment_minor: downPaymentOf(type, values),
			plan,
			notes: notes === "" ? null : notes,
		},
	};
}
