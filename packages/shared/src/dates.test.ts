import { describe, expect, it } from "vitest";

import {
	addDays,
	addMonthsClamped,
	daysBetween,
	daysOfMonth,
	formatDateTR,
	formatDateTimeTR,
	isIsoDate,
	isoWeekday,
	monthOf,
	shiftMonth,
	todayInIstanbul,
} from "./dates";

describe("isIsoDate", () => {
	it.each(["2026-10-11", "2028-02-29", "2000-02-29", "2026-12-31", "2026-01-01"])(
		"accepts %s",
		(value) => {
			expect(isIsoDate(value)).toBe(true);
		},
	);

	it.each([
		"2026-02-29",
		"2100-02-29",
		"2026-02-30",
		"2026-04-31",
		"2026-13-01",
		"2026-00-10",
		"2026-10-00",
		"2026-1-5",
		"26-10-11",
		"2026-10-11T00:00:00Z",
		" 2026-10-11",
		"",
	])("rejects %j", (value) => {
		expect(isIsoDate(value)).toBe(false);
	});
});

describe("addMonthsClamped", () => {
	it.each([
		["2026-01-31", 1, "2026-02-28"],
		["2028-01-31", 1, "2028-02-29"],
		["2026-01-31", 2, "2026-03-31"],
		["2026-01-31", 3, "2026-04-30"],
		["2026-01-31", 4, "2026-05-31"],
		["2026-12-31", 1, "2027-01-31"],
		["2026-11-10", 3, "2027-02-10"],
		["2028-02-29", 12, "2029-02-28"],
		["2028-02-29", 48, "2032-02-29"],
		["2099-01-31", 13, "2100-02-28"],
		["1999-01-31", 13, "2000-02-29"],
		["2026-03-15", 0, "2026-03-15"],
		["2026-01-30", 1, "2026-02-28"],
		["2026-05-31", 1, "2026-06-30"],
	])("%s + %d months → %s", (date, months, expected) => {
		expect(addMonthsClamped(date, months)).toBe(expected);
	});

	it("matches the spec plan example (first due 10 Nov 2026, monthly)", () => {
		const dates = [0, 1, 2, 3, 4].map((k) => addMonthsClamped("2026-11-10", k));
		expect(dates).toEqual([
			"2026-11-10",
			"2026-12-10",
			"2027-01-10",
			"2027-02-10",
			"2027-03-10",
		]);
	});

	it("rejects invalid dates and month counts", () => {
		expect(() => addMonthsClamped("2026-02-30", 1)).toThrow(RangeError);
		expect(() => addMonthsClamped("2026-01-31", -1)).toThrow(RangeError);
		expect(() => addMonthsClamped("2026-01-31", 1.5)).toThrow(RangeError);
	});
});

describe("addDays", () => {
	it.each([
		["2026-10-11", 0, "2026-10-11"],
		["2026-10-11", 7, "2026-10-18"],
		["2026-10-25", 14, "2026-11-08"],
		["2026-12-25", 7, "2027-01-01"],
		["2028-02-28", 1, "2028-02-29"],
		["2026-02-28", 1, "2026-03-01"],
		["2026-03-01", -1, "2026-02-28"],
	])("%s + %d days → %s", (date, days, expected) => {
		expect(addDays(date, days)).toBe(expected);
	});

	it("rejects invalid input", () => {
		expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
		expect(() => addDays("2026-02-01", 0.5)).toThrow(RangeError);
	});
});

describe("todayInIstanbul", () => {
	it.each([
		["2026-10-11T20:59:59.999Z", "2026-10-11"],
		["2026-10-11T21:00:00.000Z", "2026-10-12"],
		["2026-12-31T20:59:59.999Z", "2026-12-31"],
		["2026-12-31T21:00:00.000Z", "2027-01-01"],
		["2028-02-28T21:00:00.000Z", "2028-02-29"],
		["2026-03-29T00:30:00.000Z", "2026-03-29"],
	])("%s → %s", (instant, expected) => {
		expect(todayInIstanbul(new Date(instant))).toBe(expected);
	});

	it("agrees with the IANA Europe/Istanbul zone (fixed +03:00 guard)", () => {
		const ianaDay = new Intl.DateTimeFormat("en-CA", {
			timeZone: "Europe/Istanbul",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		});
		const start = Date.UTC(2026, 0, 1);
		const end = Date.UTC(2031, 0, 1);
		// Every 7h17m sweeps all hours of the day across the range, incl. both sides of midnight.
		const step = (7 * 60 + 17) * 60 * 1000;
		for (let t = start; t < end; t += step) {
			const now = new Date(t);
			expect(todayInIstanbul(now)).toBe(ianaDay.format(now));
		}
	});

	it("rejects an invalid Date", () => {
		expect(() => todayInIstanbul(new Date(Number.NaN))).toThrow(RangeError);
	});
});

describe("formatDateTR", () => {
	it.each([
		["2026-11-10", "short", "10 Kas 2026"],
		["2026-11-10", "long", "10 Kasım 2026"],
		["2027-01-01", "short", "1 Oca 2027"],
		["2028-02-29", "long", "29 Şubat 2028"],
		["2026-08-31", "short", "31 Ağu 2026"],
		["2026-08-31", "dayMonth", "31 Ağustos"],
	] as const)("formats %s as %s", (date, style, expected) => {
		expect(formatDateTR(date, style)).toBe(expected);
	});

	it("rejects an invalid date", () => {
		expect(() => formatDateTR("2026-02-30", "short")).toThrow(RangeError);
	});
});

describe("monthOf / daysOfMonth", () => {
	it("returns the first day of the month and lists every day", () => {
		expect(monthOf("2028-02-17")).toBe("2028-02-01");
		expect(daysOfMonth("2028-02-01")).toHaveLength(29);
		expect(daysOfMonth("2027-02-01").at(-1)).toBe("2027-02-28");
	});

	it("isoWeekday is Monday = 1 … Sunday = 7", () => {
		expect(isoWeekday("2026-10-11")).toBe(7);
		expect(isoWeekday("2026-10-12")).toBe(1);
	});
});

describe("formatDateTimeTR", () => {
	it("shows an event timestamp in Istanbul time", () => {
		expect(formatDateTimeTR("2026-11-09T21:30:00.000Z")).toBe("10 Kas 2026, 00:30");
		expect(formatDateTimeTR("2026-10-11T09:05:00Z")).toBe("11 Eki 2026, 12:05");
	});

	it("rejects an invalid timestamp", () => {
		expect(() => formatDateTimeTR("yesterday")).toThrow(RangeError);
	});
});

describe("shiftMonth", () => {
	it("moves to the first day of another month in both directions", () => {
		expect(shiftMonth("2026-10-11", 1)).toBe("2026-11-01");
		expect(shiftMonth("2026-01-31", -1)).toBe("2025-12-01");
		expect(shiftMonth("2026-03-15", -14)).toBe("2025-01-01");
	});
});

describe("daysBetween", () => {
	it("counts calendar days across months and years", () => {
		expect(daysBetween("2026-10-12", "2026-10-19")).toBe(7);
		expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
		expect(daysBetween("2026-10-19", "2026-10-12")).toBe(-7);
		expect(daysBetween("2026-10-12", "2026-10-12")).toBe(0);
	});
});
