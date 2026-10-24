import { describe, expect, it } from "vitest";

import { PIN_LENGTH, pinProblem } from "./pin";

describe("pinProblem", () => {
	it("accepts six digits that are not a pattern", () => {
		for (const pin of ["482915", "102938", "550913", "121314"]) {
			expect(pinProblem(pin)).toBeNull();
		}
		expect(PIN_LENGTH).toBe(6);
	});

	it("needs exactly six digits", () => {
		for (const pin of ["", "48291", "4829150", "48291a", " 48291", "４８２９１５"]) {
			expect(pinProblem(pin)).toBe("pin_format");
		}
	});

	it("rejects a repeated digit and straight runs", () => {
		for (const pin of [
			"000000",
			"111111",
			"999999",
			"012345",
			"123456",
			"456789",
			"987654",
			"654321",
			"543210",
		]) {
			expect(pinProblem(pin)).toBe("pin_weak");
		}
	});
});
