import { describe, expect, it } from "vitest";

import vectors from "../test-vectors/cards.json";
import {
	cardInputSchema,
	cutsAround,
	deriveCardState,
	installmentParts,
	suggestedMinimumRate,
	type CardTransaction,
} from "./cards";

describe("cutsAround (ADR-055)", () => {
	it.each(vectors.cuts)("$name", ({ today, statement_day, last, next }) => {
		expect(cutsAround(today, statement_day)).toEqual({ last, next });
	});
});

describe("installmentParts", () => {
	it.each(vectors.parts)("$name", ({ amount, count, expected }) => {
		expect(installmentParts(amount, count)).toEqual(expected);
	});
});

describe("deriveCardState", () => {
	it.each(vectors.states)("$name", ({ card, today, transactions, expected }) => {
		expect(deriveCardState(card, transactions as CardTransaction[], today)).toEqual(expected);
	});
});

describe("suggestedMinimumRate", () => {
	it("follows the limit: 20% up to 50.000 TL, 40% above", () => {
		expect(suggestedMinimumRate(5000000)).toBe(20);
		expect(suggestedMinimumRate(5000001)).toBe(40);
	});
});

describe("cardInputSchema", () => {
	const valid = {
		bank_name: "İş Bankası",
		card_name: "Maximum",
		last4: "7302",
		color: "midnight",
		limit_minor: 4000000,
		opening_debt_minor: 0,
		statement_day: 22,
		due_offset_days: 10,
		min_payment_rate: 20,
	};

	it("accepts a card without its full number", () => {
		expect(cardInputSchema.parse(valid)).toEqual(valid);
	});

	it("rejects what the server rejects", () => {
		const issue = (input: unknown) =>
			cardInputSchema.safeParse(input).error?.issues[0]?.message;
		expect(issue({ ...valid, last4: "730" })).toBe("invalid_last4");
		expect(issue({ ...valid, last4: "4111111111111111" })).toBe("invalid_last4");
		expect(issue({ ...valid, statement_day: 29 })).toBe("invalid_day");
		expect(issue({ ...valid, due_offset_days: 0 })).toBe("invalid_day");
		expect(issue({ ...valid, limit_minor: 0 })).toBe("invalid_amount");
		expect(issue({ ...valid, min_payment_rate: 101 })).toBe("invalid_rate");
		expect(issue({ ...valid, color: "gold" })).toBe("invalid_option");
		expect(issue({ ...valid, cvv: "123" })).toBeDefined();
	});
});
