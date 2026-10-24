import { daysOfMonth, formatDateTR, isoWeekday, type IsoDate } from "@paramnet/shared";

import type { RecurringRule } from "@/api/types";
import { fill, tr } from "@/i18n/tr";

// Turkish dative-free ordinal suffix for "ayın 1’i, 3’ü, 6’sı, 9’u, 10’u, 20’si".
const LAST_DIGIT = ["", "i", "si", "ü", "ü", "i", "sı", "si", "i", "u"] as const;
const TENS = ["", "u", "si", "u"] as const;

export function dayWithSuffix(day: number): string {
	const suffix = day % 10 === 0 ? TENS[day / 10] : LAST_DIGIT[day % 10];
	return `${String(day)}’${suffix ?? ""}`;
}

// Design 38 ".t2": "Her ayın 1’i · Maaş Hesabı".
export function scheduleLine(
	rule: Pick<RecurringRule, "frequency" | "start_on" | "account_name">,
): string {
	let when: string;
	if (rule.frequency === "weekly") {
		when = fill(tr.recurring.weekly, {
			weekday: tr.txHistory.weekdays[isoWeekday(rule.start_on) - 1] ?? "",
		});
	} else if (rule.frequency === "monthly") {
		when = fill(tr.recurring.monthly, {
			day: dayWithSuffix(Number(rule.start_on.slice(8, 10))),
		});
	} else {
		when = fill(tr.recurring.yearly, { date: formatDateTR(rule.start_on, "dayMonth") });
	}
	return `${when} · ${rule.account_name}`;
}

export type MonthClock = { daysLeft: number; elapsedPercent: number };

// Design 39 "19 gün kaldı", "Bugün · %39": today counts as a day still to spend.
export function monthClock(today: IsoDate, month: IsoDate): MonthClock {
	const days = daysOfMonth(month);
	const total = days.length;
	if (today < month) {
		return { daysLeft: total, elapsedPercent: 0 };
	}
	const index = days.indexOf(today);
	if (index === -1) {
		return { daysLeft: 0, elapsedPercent: 100 };
	}
	return { daysLeft: total - index, elapsedPercent: Math.round((index / total) * 100) };
}

// What is left of the month's budget per remaining day, in whole kuruş (never negative).
export function dailyAllowance(limitMinor: number, spentMinor: number, daysLeft: number): number {
	if (daysLeft <= 0 || spentMinor >= limitMinor) {
		return 0;
	}
	return Math.floor((limitMinor - spentMinor) / daysLeft);
}

export function percentOf(part: number, whole: number): number {
	return whole <= 0 ? 0 : Math.round((part / whole) * 100);
}

// A bar's width; React Native types percentages as `${number}%`.
export function barWidth(percent: number): `${number}%` {
	return `${String(Math.min(100, Math.max(0, percent)))}%` as `${number}%`;
}
