import { describe, expect, it } from "vitest";

import {
	equalShares,
	formatPercentBps,
	parsePercentBps,
	percentShares,
	splitInputSchema,
	sumShares,
} from "./splits";

describe("equalShares (ADR-061)", () => {
	it("splits evenly", () => {
		expect(equalShares(360000, 4)).toEqual([90000, 90000, 90000, 90000]);
	});

	it("gives the kuruş difference to the payer, the first share", () => {
		expect(equalShares(100000, 3)).toEqual([33334, 33333, 33333]);
		expect(sumShares(equalShares(100001, 7))).toBe(100001);
	});

	it("rejects a split with nobody", () => {
		expect(() => equalShares(1000, 0)).toThrow();
	});
});

describe("percentShares", () => {
	it("rounds down and gives the rest to the payer", () => {
		expect(percentShares(100000, [3334, 3333, 3333])).toEqual([33340, 33330, 33330]);
		expect(percentShares(99999, [5000, 5000])).toEqual([50000, 49999]);
	});

	it("needs the percents to make 100", () => {
		expect(percentShares(1000, [5000, 4000])).toBeNull();
	});
});

describe("parsePercentBps / formatPercentBps", () => {
	it.each([
		["25", 2500],
		["33,33", 3333],
		["12.5", 1250],
		["100", 10000],
	])("%s", (text, bps) => {
		expect(parsePercentBps(text)).toBe(bps);
	});

	it.each(["", "abc", "101", "1,234", "-5"])("rejects %s", (text) => {
		expect(parsePercentBps(text)).toBeNull();
	});

	it("formats Turkish style", () => {
		expect(formatPercentBps(3333)).toBe("%33,33");
		expect(formatPercentBps(2500)).toBe("%25");
	});
});

describe("splitInputSchema", () => {
	const input = {
		title: "Akşam yemeği",
		total_minor: 360000,
		spent_on: "2026-10-12",
		mode: "equal",
		owner_share_minor: 120000,
		members: [
			{ display_name: "Ayşe", share_minor: 120000, paramnet_id: "PN-552013" },
			{ display_name: "Can", share_minor: 120000, paramnet_id: null },
		],
	};

	it("accepts shares that add up", () => {
		expect(splitInputSchema.safeParse(input).success).toBe(true);
	});

	it("rejects shares that do not add up", () => {
		const result = splitInputSchema.safeParse({ ...input, owner_share_minor: 100000 });
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toBe("shares_total");
	});

	it("needs somebody else and a positive share each", () => {
		expect(splitInputSchema.safeParse({ ...input, members: [] }).success).toBe(false);
		expect(
			splitInputSchema.safeParse({
				...input,
				owner_share_minor: 240000,
				members: [{ display_name: "Ayşe", share_minor: 0, paramnet_id: null }],
			}).success,
		).toBe(false);
	});
});
