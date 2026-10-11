import { describe, expect, it } from "vitest";
import type { z } from "zod";

import {
	contactInputSchema,
	createAgreementInputSchema,
	displayNameSchema,
	formatPhoneTR,
	installmentSchema,
	isoDateSchema,
	normalizePhoneTR,
	paymentInputSchema,
	phoneE164Schema,
	positiveMinorSchema,
	termsSchema,
} from "./schemas";

function codes(result: z.ZodSafeParseResult<unknown>): string[] {
	return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

function paths(result: z.ZodSafeParseResult<unknown>): string[] {
	return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
}

const furnitureTerms = {
	principal_minor: 2800000,
	down_payment_minor: 800000,
	plan: [
		{ seq: 1, due_date: "2026-11-10", amount_minor: 400000 },
		{ seq: 2, due_date: "2026-12-10", amount_minor: 400000 },
		{ seq: 3, due_date: "2027-01-10", amount_minor: 400000 },
		{ seq: 4, due_date: "2027-02-10", amount_minor: 400000 },
		{ seq: 5, due_date: "2027-03-10", amount_minor: 400000 },
	],
	notes: null,
};

describe("normalizePhoneTR / phoneE164Schema", () => {
	it.each([
		"+905551234567",
		"905551234567",
		"05551234567",
		"5551234567",
		"0 (555) 123 45 67",
		"+90 555-123-45-67",
	])("normalises %s", (input) => {
		expect(normalizePhoneTR(input)).toBe("+905551234567");
		expect(phoneE164Schema.parse(input)).toBe("+905551234567");
	});

	it.each(["", "555123456", "+902121234567", "+15551234567", "05551234567a", "+9055512345678"])(
		"rejects %s",
		(input) => {
			expect(normalizePhoneTR(input)).toBeNull();
			expect(codes(phoneE164Schema.safeParse(input))).toEqual(["invalid_phone"]);
		},
	);
});

describe("primitive schemas", () => {
	it("positive amount is a positive safe integer", () => {
		expect(positiveMinorSchema.safeParse(1).success).toBe(true);
		expect(codes(positiveMinorSchema.safeParse(0))).toEqual(["invalid_amount"]);
		expect(codes(positiveMinorSchema.safeParse(1.5))).toEqual(["invalid_amount"]);
		expect(codes(positiveMinorSchema.safeParse(Number.MAX_SAFE_INTEGER + 1))).toEqual([
			"invalid_amount",
		]);
	});

	it("ISO date must be a real calendar day", () => {
		expect(isoDateSchema.safeParse("2028-02-29").success).toBe(true);
		expect(codes(isoDateSchema.safeParse("2027-02-29"))).toEqual(["invalid_date"]);
	});
});

describe("termsSchema", () => {
	it("accepts the spec furniture terms", () => {
		expect(termsSchema.parse(furnitureTerms)).toEqual(furnitureTerms);
	});

	it("normalises notes: trimmed, NFC, empty becomes null", () => {
		expect(termsSchema.parse({ ...furnitureTerms, notes: "   " }).notes).toBeNull();
		expect(termsSchema.parse({ ...furnitureTerms, notes: " Mobilya " }).notes).toBe("Mobilya");
		expect(termsSchema.parse({ ...furnitureTerms, notes: "Çay" }).notes).toBe("Çay");
	});

	it("BR-03: rejects a plan that does not add up, with the plan error code", () => {
		const result = termsSchema.safeParse({
			...furnitureTerms,
			plan: furnitureTerms.plan.map((row, i) =>
				i === 4 ? { ...row, amount_minor: 1 } : row,
			),
		});
		expect(codes(result)).toEqual(["sum_mismatch"]);
		expect(paths(result)).toEqual(["plan"]);
	});

	it("points at the failing plan row", () => {
		const result = termsSchema.safeParse({
			...furnitureTerms,
			plan: furnitureTerms.plan.map((row, i) =>
				i === 2 ? { ...row, due_date: "2026-01-01" } : row,
			),
		});
		expect(codes(result)).toEqual(["dates_not_ascending"]);
		expect(paths(result)).toEqual(["plan.2"]);
	});

	it("requires seq to be 1..n in order", () => {
		const result = termsSchema.safeParse({
			...furnitureTerms,
			plan: furnitureTerms.plan.map((row, i) => (i === 1 ? { ...row, seq: 7 } : row)),
		});
		expect(codes(result)).toEqual(["invalid_seq"]);
		expect(paths(result)).toEqual(["plan.1.seq"]);
	});

	it("rejects unknown keys so the hash covers everything stored", () => {
		expect(termsSchema.safeParse({ ...furnitureTerms, interest: 1 }).success).toBe(false);
	});

	it("rejects notes over 1000 characters", () => {
		expect(
			codes(termsSchema.safeParse({ ...furnitureTerms, notes: "a".repeat(1001) })),
		).toEqual(["too_long"]);
	});
});

describe("contactInputSchema", () => {
	it("trims the name, normalises the phone and defaults kind", () => {
		expect(
			contactInputSchema.parse({ display_name: " Ahmet ", phone_e164: "0555 123 45 67" }),
		).toEqual({
			display_name: "Ahmet",
			phone_e164: "+905551234567",
			kind: "person",
		});
	});

	it("allows a contact without a phone (personal mode only)", () => {
		expect(
			contactInputSchema.parse({ display_name: "Yıldız Mobilya", kind: "merchant" }),
		).toEqual({
			display_name: "Yıldız Mobilya",
			phone_e164: null,
			kind: "merchant",
		});
	});

	it.each([
		[{ display_name: "  " }, "required"],
		[{ display_name: "a".repeat(81) }, "too_long"],
	])("rejects a bad name", (input, code) => {
		expect(codes(contactInputSchema.safeParse(input))).toEqual([code]);
	});
});

describe("createAgreementInputSchema", () => {
	const base = {
		kind: "installment_purchase",
		creator_role: "debtor",
		title: "Mobilya",
		counterparty: { contact: { display_name: "Yıldız Mobilya", kind: "merchant" } },
		terms: furnitureTerms,
	};

	it("accepts a new contact and defaults the description", () => {
		const parsed = createAgreementInputSchema.parse(base);
		expect(parsed.description).toBeNull();
		expect(parsed.counterparty).toEqual({
			contact: { display_name: "Yıldız Mobilya", phone_e164: null, kind: "merchant" },
		});
	});

	it("accepts an existing contact id", () => {
		const parsed = createAgreementInputSchema.parse({
			...base,
			counterparty: { contact_id: "7d3c4f0e-8f6a-4e8b-9a51-2b2f1c8d9e10" },
		});
		expect(parsed.counterparty).toEqual({ contact_id: "7d3c4f0e-8f6a-4e8b-9a51-2b2f1c8d9e10" });
	});

	it("rejects an unknown role and an empty title", () => {
		const result = createAgreementInputSchema.safeParse({
			...base,
			creator_role: "owner",
			title: "",
		});
		expect(paths(result).sort()).toEqual(["creator_role", "title"]);
	});
});

describe("paymentInputSchema", () => {
	it("accepts a payment and nulls an empty note", () => {
		expect(
			paymentInputSchema.parse({
				amount_minor: 400000,
				paid_on: "2026-11-10",
				method: "cash",
				note: "",
			}),
		).toEqual({ amount_minor: 400000, paid_on: "2026-11-10", method: "cash", note: null });
	});

	it("rejects an unknown method and a zero amount", () => {
		const result = paymentInputSchema.safeParse({
			amount_minor: 0,
			paid_on: "2026-11-10",
			method: "crypto",
		});
		expect(paths(result).sort()).toEqual(["amount_minor", "method"]);
	});
});

describe("installmentSchema", () => {
	it("rejects paid above amount", () => {
		const result = installmentSchema.safeParse({
			id: "7d3c4f0e-8f6a-4e8b-9a51-2b2f1c8d9e10",
			seq: 1,
			due_date: null,
			amount_minor: 100,
			paid_minor: 101,
		});
		expect(codes(result)).toEqual(["paid_exceeds_amount"]);
	});
});

describe("displayNameSchema", () => {
	it("trims and requires 1..80 characters", () => {
		expect(displayNameSchema.parse("  Halil  ")).toBe("Halil");
		expect(codes(displayNameSchema.safeParse("   "))).toEqual(["required"]);
		expect(codes(displayNameSchema.safeParse("a".repeat(81)))).toEqual(["too_long"]);
	});
});

describe("formatPhoneTR", () => {
	it("groups a Turkish mobile for display", () => {
		expect(formatPhoneTR("+905550000001")).toBe("+90 555 000 00 01");
		expect(formatPhoneTR("+15551234567")).toBe("+15551234567");
	});
});
