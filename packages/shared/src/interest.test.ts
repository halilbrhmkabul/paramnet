import { describe, expect, it } from "vitest";

import { cardInterestEstimate, earlyPayoff } from "./interest";

describe("cardInterestEstimate (ADR-057)", () => {
	it("follows design 10: 7.470 TL left, %3,75, 31 days, KKDF and BSMV %15", () => {
		expect(cardInterestEstimate(747000, 375, 31)).toEqual({
			interest_minor: 28946,
			kkdf_minor: 4342,
			bsmv_minor: 4342,
			total_minor: 37630,
		});
	});

	it("is zero when the statement is paid", () => {
		expect(cardInterestEstimate(0, 375, 31).total_minor).toBe(0);
	});

	it("takes other tax rates", () => {
		expect(cardInterestEstimate(1000000, 300, 30, 0, 1000)).toEqual({
			interest_minor: 30000,
			kkdf_minor: 0,
			bsmv_minor: 3000,
			total_minor: 33000,
		});
	});
});

describe("earlyPayoff", () => {
	it("charges 1% with up to 36 months left, 2% beyond", () => {
		expect(earlyPayoff(9007768, 16, 11818672)).toEqual({
			fee_bps: 100,
			fee_minor: 90078,
			total_minor: 9097846,
			saved_minor: 2720826,
		});
		expect(earlyPayoff(1000000, 37, 1500000).fee_minor).toBe(20000);
	});
});
