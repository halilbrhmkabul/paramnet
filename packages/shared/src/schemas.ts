import { z } from "zod";

import { isIsoDate } from "./dates";
import { AGREEMENT_KINDS, CONTACT_KINDS, PARTY_ROLES, PAYMENT_METHODS } from "./enums";
import { isMinorAmount } from "./money";
import { validatePlan } from "./plan";

// Issue messages are stable codes, not text: the mobile app maps them to tr.ts (ADR-014).
export const TITLE_MAX = 80;
export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 500;
export const NOTE_MAX = 500;
export const TERMS_NOTES_MAX = 1000;

// Invites are confirmed by SMS (spec 11: +90 only), so only Turkish mobile numbers (5xx) are valid.
const PHONE_SEPARATORS = /[\s\-().]/g;
const PHONE_PATTERNS = [/^\+90(5\d{9})$/, /^90(5\d{9})$/, /^0(5\d{9})$/, /^(5\d{9})$/];

export function normalizePhoneTR(input: string): string | null {
	const compact = input.replace(PHONE_SEPARATORS, "");
	for (const pattern of PHONE_PATTERNS) {
		const match = pattern.exec(compact);
		if (match?.[1] !== undefined) {
			return `+90${match[1]}`;
		}
	}
	return null;
}

export const phoneE164Schema = z.string({ error: "invalid_phone" }).transform((value, ctx) => {
	const phone = normalizePhoneTR(value);
	if (phone === null) {
		ctx.addIssue({ code: "custom", message: "invalid_phone" });
		return z.NEVER;
	}
	return phone;
});

// Forms send "" for an untouched optional field; treat it like a missing phone.
const optionalPhoneSchema = z
	.string({ error: "invalid_phone" })
	.nullish()
	.transform((value, ctx) => {
		if (value === null || value === undefined || value.trim() === "") {
			return null;
		}
		const phone = normalizePhoneTR(value);
		if (phone === null) {
			ctx.addIssue({ code: "custom", message: "invalid_phone" });
			return z.NEVER;
		}
		return phone;
	});

export const positiveMinorSchema = z
	.number({ error: "invalid_amount" })
	.refine((value) => isMinorAmount(value) && value > 0, { error: "invalid_amount" });

export const nonNegativeMinorSchema = z
	.number({ error: "invalid_amount" })
	.refine(isMinorAmount, { error: "invalid_amount" });

export const isoDateSchema = z
	.string({ error: "invalid_date" })
	.refine(isIsoDate, { error: "invalid_date" });

export const uuidSchema = z.uuid({ error: "invalid_id" });

function requiredText(max: number) {
	return z
		.string({ error: "required" })
		.trim()
		.min(1, { error: "required" })
		.max(max, { error: "too_long" })
		.transform((value) => value.normalize("NFC"));
}

// NFC so that the same visible text always hashes the same (iOS and Android keyboards may differ).
function optionalText(max: number) {
	return z
		.string({ error: "invalid_text" })
		.nullish()
		.transform((value, ctx) => {
			const text = (value ?? "").trim().normalize("NFC");
			if (text.length > max) {
				ctx.addIssue({ code: "custom", message: "too_long" });
				return z.NEVER;
			}
			return text === "" ? null : text;
		});
}

const planRowSchema = z.strictObject({
	seq: z
		.number({ error: "invalid_seq" })
		.int({ error: "invalid_seq" })
		.min(1, { error: "invalid_seq" }),
	due_date: isoDateSchema.nullable(),
	amount_minor: positiveMinorSchema,
});

// Strict: every stored key is covered by terms_hash, so unknown keys must not slip through.
export const termsSchema = z
	.strictObject({
		principal_minor: positiveMinorSchema,
		down_payment_minor: nonNegativeMinorSchema,
		plan: z.array(planRowSchema),
		notes: optionalText(TERMS_NOTES_MAX),
	})
	.superRefine((terms, ctx) => {
		const badSeq = terms.plan.findIndex((row, index) => row.seq !== index + 1);
		if (badSeq !== -1) {
			ctx.addIssue({ code: "custom", message: "invalid_seq", path: ["plan", badSeq, "seq"] });
			return;
		}
		// BR-03 lives in one place: the same checks as the plan editor.
		const result = validatePlan({
			principal: terms.principal_minor,
			downPayment: terms.down_payment_minor,
			installments: terms.plan,
		});
		if (!result.ok) {
			const path = result.index === undefined ? ["plan"] : ["plan", result.index];
			ctx.addIssue({ code: "custom", message: result.error, path });
		}
	});

export type Terms = z.output<typeof termsSchema>;

export const contactInputSchema = z.strictObject({
	display_name: requiredText(NAME_MAX),
	phone_e164: optionalPhoneSchema,
	kind: z.enum(CONTACT_KINDS, { error: "invalid_option" }).default("person"),
});

export type ContactInput = z.output<typeof contactInputSchema>;

export const createAgreementInputSchema = z.strictObject({
	kind: z.enum(AGREEMENT_KINDS, { error: "invalid_option" }),
	creator_role: z.enum(PARTY_ROLES, { error: "invalid_option" }),
	title: requiredText(TITLE_MAX),
	description: optionalText(DESCRIPTION_MAX),
	counterparty: z.union(
		[
			z.strictObject({ contact_id: uuidSchema }),
			z.strictObject({ contact: contactInputSchema }),
		],
		{ error: "invalid_counterparty" },
	),
	terms: termsSchema,
});

export type CreateAgreementInput = z.output<typeof createAgreementInputSchema>;

export const paymentInputSchema = z.strictObject({
	amount_minor: positiveMinorSchema,
	paid_on: isoDateSchema,
	method: z.enum(PAYMENT_METHODS, { error: "invalid_option" }),
	note: optionalText(NOTE_MAX),
});

export type PaymentInput = z.output<typeof paymentInputSchema>;

// Read model from get_agreement_detail; status is derived (installmentStatus), never stored.
export const installmentSchema = z
	.object({
		id: uuidSchema,
		seq: z.number().int().min(1),
		due_date: isoDateSchema.nullable(),
		amount_minor: positiveMinorSchema,
		paid_minor: nonNegativeMinorSchema,
	})
	.refine((row) => row.paid_minor <= row.amount_minor, {
		error: "paid_exceeds_amount",
		path: ["paid_minor"],
	});

export type Installment = z.output<typeof installmentSchema>;
