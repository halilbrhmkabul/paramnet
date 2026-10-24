import { dailyAllowance, dayWithSuffix, monthClock, percentOf, scheduleLine } from "../planModel";

describe("dayWithSuffix", () => {
	it.each([
		[1, "1’i"],
		[2, "2’si"],
		[3, "3’ü"],
		[6, "6’sı"],
		[9, "9’u"],
		[10, "10’u"],
		[20, "20’si"],
		[30, "30’u"],
		[31, "31’i"],
	])("%d → %s", (day, text) => {
		expect(dayWithSuffix(day)).toBe(text);
	});
});

describe("scheduleLine (design 38)", () => {
	it("says when and where", () => {
		const base = { account_name: "Maaş Hesabı" };
		expect(scheduleLine({ ...base, frequency: "monthly", start_on: "2026-10-01" })).toBe(
			"Her ayın 1’i · Maaş Hesabı",
		);
		expect(scheduleLine({ ...base, frequency: "weekly", start_on: "2026-10-19" })).toBe(
			"Her hafta Pazartesi · Maaş Hesabı",
		);
		expect(scheduleLine({ ...base, frequency: "yearly", start_on: "2026-10-20" })).toBe(
			"Her yıl 20 Ekim · Maaş Hesabı",
		);
	});
});

describe("monthClock and dailyAllowance (design 39)", () => {
	it("counts today as a day left", () => {
		expect(monthClock("2026-10-12", "2026-10-01")).toEqual({
			daysLeft: 20,
			elapsedPercent: 35,
		});
		expect(monthClock("2026-10-01", "2026-10-01")).toEqual({ daysLeft: 31, elapsedPercent: 0 });
		expect(monthClock("2026-11-02", "2026-10-01")).toEqual({
			daysLeft: 0,
			elapsedPercent: 100,
		});
		expect(monthClock("2026-09-30", "2026-10-01")).toEqual({ daysLeft: 31, elapsedPercent: 0 });
	});

	it("shares what is left over the days left", () => {
		expect(dailyAllowance(3600000, 2187540, 19)).toBe(74340);
		expect(dailyAllowance(100, 200, 5)).toBe(0);
		expect(dailyAllowance(100, 0, 0)).toBe(0);
		expect(percentOf(2187540, 3600000)).toBe(61);
		expect(percentOf(1, 0)).toBe(0);
	});
});
