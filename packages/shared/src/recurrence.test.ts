import { describe, expect, it } from "vitest";

import vectors from "../test-vectors/recurrence.json";
import {
	RECURRENCE_FREQUENCIES,
	budgetLevel,
	nextOccurrences,
	occurrencesBetween,
	recurringInputSchema,
	type RecurrenceFrequency,
} from "./recurrence";

function frequency(value: string): RecurrenceFrequency {
	const found = RECURRENCE_FREQUENCIES.find((f) => f === value);
	if (found === undefined) {
		throw new Error(`unknown frequency ${value}`);
	}
	return found;
}

describe("nextOccurrences (ADR-054)", () => {
	it.each(vectors.next)("$name", ({ start, frequency: f, from, count, expected }) => {
		expect(nextOccurrences(start, frequency(f), from, count)).toEqual(expected);
	});
});

describe("occurrencesBetween", () => {
	it.each(vectors.between)("$name", ({ start, frequency: f, from, to, expected }) => {
		expect(occurrencesBetween(start, frequency(f), from, to)).toEqual(expected);
	});

	it("stops at a sane number of dates", () => {
		expect(occurrencesBetween("2000-01-01", "weekly", "2000-01-01", "2030-01-01")).toHaveLength(
			400,
		);
	});
});

describe("budgetLevel", () => {
	it("warns from 80% and flags going over", () => {
		expect(budgetLevel(0, 100000)).toBe("ok");
		expect(budgetLevel(79999, 100000)).toBe("ok");
		expect(budgetLevel(80000, 100000)).toBe("near");
		expect(budgetLevel(100000, 100000)).toBe("near");
		expect(budgetLevel(100001, 100000)).toBe("over");
	});
});

describe("recurringInputSchema", () => {
	const valid = {
		kind: "expense",
		name: " Spor salonu ",
		amount_minor: 120000,
		category: "health",
		account_id: "6f0c2b1e-4b4a-4d55-9d0e-0b8a8f6b5c11",
		frequency: "monthly",
		start_on: "2026-10-20",
		confirm_each: true,
	};

	it("trims the name", () => {
		expect(recurringInputSchema.parse(valid).name).toBe("Spor salonu");
	});

	it("rejects what the server rejects", () => {
		const issue = (input: unknown) =>
			recurringInputSchema.safeParse(input).error?.issues[0]?.message;
		expect(issue({ ...valid, name: "" })).toBe("required");
		expect(issue({ ...valid, amount_minor: 0 })).toBe("invalid_amount");
		expect(issue({ ...valid, category: "salary" })).toBe("invalid_category");
		expect(issue({ ...valid, kind: "transfer" })).toBe("invalid_option");
		expect(issue({ ...valid, frequency: "daily" })).toBe("invalid_option");
	});
});
