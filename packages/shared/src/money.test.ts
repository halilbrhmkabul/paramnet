import { describe, expect, it } from "vitest";

import {
	addMinor,
	formatSignedTRY,
	formatTRY,
	isMinorAmount,
	parseTRY,
	subtractMinor,
} from "./money";

describe("isMinorAmount", () => {
	it.each([0, 1, 12000_00, Number.MAX_SAFE_INTEGER])("accepts %d", (value) => {
		expect(isMinorAmount(value)).toBe(true);
	});

	it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
		"rejects %d",
		(value) => {
			expect(isMinorAmount(value)).toBe(false);
		},
	);
});

describe("addMinor / subtractMinor", () => {
	it("adds and subtracts integer minor units", () => {
		expect(addMinor(12000_00, 50)).toBe(12000_50);
		expect(subtractMinor(12000_50, 50)).toBe(12000_00);
		expect(subtractMinor(100, 100)).toBe(0);
	});

	it("rejects a negative result", () => {
		expect(() => subtractMinor(100, 101)).toThrow(RangeError);
	});

	it("rejects overflow beyond the safe integer range", () => {
		expect(() => addMinor(Number.MAX_SAFE_INTEGER, 1)).toThrow(RangeError);
	});

	it("rejects invalid operands", () => {
		expect(() => addMinor(-1, 1)).toThrow(RangeError);
		expect(() => addMinor(1.5, 1)).toThrow(RangeError);
		expect(() => subtractMinor(10, Number.NaN)).toThrow(RangeError);
	});
});

describe("formatTRY", () => {
	it.each([
		[0, "0,00 TL"],
		[5, "0,05 TL"],
		[99, "0,99 TL"],
		[100, "1,00 TL"],
		[123456, "1.234,56 TL"],
		[12000_00, "12.000,00 TL"],
		[100000_00, "100.000,00 TL"],
		[1000000_00, "1.000.000,00 TL"],
		[Number.MAX_SAFE_INTEGER, "90.071.992.547.409,91 TL"],
	])("formats %d as %s", (minor, expected) => {
		expect(formatTRY(minor)).toBe(expected);
	});

	it("formats negative differences with a leading minus", () => {
		expect(formatTRY(-5)).toBe("-0,05 TL");
		expect(formatTRY(-123456)).toBe("-1.234,56 TL");
	});

	it.each([0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
		"rejects non-integer or unsafe %d",
		(value) => {
			expect(() => formatTRY(value)).toThrow(RangeError);
		},
	);
});

describe("parseTRY", () => {
	it.each([
		["12.000,50", 12000_50],
		["12000", 12000_00],
		["12,5", 12_50],
		["12,50", 12_50],
		["12.500", 12500_00],
		["  12.000,50  ", 12000_50],
		["12.000,00 TL", 12000_00],
		["12TL", 12_00],
		["0", 0],
		["0,00", 0],
		["0,05", 5],
		["1.000.000", 1000000_00],
		["90.071.992.547.409,91", Number.MAX_SAFE_INTEGER],
	])("accepts %j → %d", (text, expected) => {
		expect(parseTRY(text)).toEqual({ ok: true, value: expected });
	});

	it.each([
		["", "empty"],
		["   ", "empty"],
		["TL", "empty"],
		["-5", "negative"],
		["-12,50", "negative"],
		["12,505", "too_many_decimals"],
		["12.5", "invalid_format"],
		["1.2345", "invalid_format"],
		["1.2.3", "invalid_format"],
		["12 000", "invalid_format"],
		["12,", "invalid_format"],
		[",5", "invalid_format"],
		["012", "invalid_format"],
		["+5", "invalid_format"],
		["1e5", "invalid_format"],
		["0x10", "invalid_format"],
		["Infinity", "invalid_format"],
		["₺12", "invalid_format"],
		["12,5,0", "invalid_format"],
		["90.071.992.547.409,92", "out_of_range"],
		["9.007.199.254.740.991", "out_of_range"],
	])("rejects %j with %s", (text, error) => {
		expect(parseTRY(text)).toEqual({ ok: false, error });
	});

	it("round-trips formatTRY output", () => {
		for (const minor of [
			0,
			1,
			99,
			100,
			101,
			12000_00,
			12000_50,
			999999_99,
			Number.MAX_SAFE_INTEGER,
		]) {
			expect(parseTRY(formatTRY(minor))).toEqual({ ok: true, value: minor });
		}
	});
});

describe("formatSignedTRY", () => {
	it("puts the sign in front, whatever the stored sign", () => {
		expect(formatSignedTRY(800000, "plus")).toBe("+8.000,00 TL");
		expect(formatSignedTRY(84230, "minus")).toBe("\u2212842,30 TL");
		expect(formatSignedTRY(-1500, "none")).toBe("15,00 TL");
	});
});
