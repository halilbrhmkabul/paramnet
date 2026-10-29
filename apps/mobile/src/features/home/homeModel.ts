import { formatDateTR, formatDateTimeTR, type IsoDate } from "@paramnet/shared";

import type { Transaction } from "@/api/types";
import type { FinanceEvent } from "@/features/calendar/financeModel";
import { upperTR } from "@/features/cash/cashModel";
import { fill, tr } from "@/i18n/tr";

// Design 03 "Günaydın,": by the hour in Istanbul.
export function greetingFor(now: Date): string {
	const hour = Number(formatDateTimeTR(now.toISOString()).slice(-5, -3));
	if (hour >= 5 && hour < 12) return tr.home.greetings.morning;
	if (hour >= 12 && hour < 18) return tr.home.greetings.day;
	if (hour >= 18 && hour < 22) return tr.home.greetings.evening;
	return tr.home.greetings.night;
}

// "10 Eki": the year is implied on the home screen.
export function shortDay(date: IsoDate): string {
	return formatDateTR(date, "short").split(" ").slice(0, 2).join(" ");
}

// Design 03 ".dt": "14" over "EKİ".
export function dateTile(date: IsoDate): { day: string; month: string } {
	const [day = "", month = ""] = formatDateTR(date, "short").split(" ");
	return { day, month: upperTR(month) };
}

// "Bugün 09:12 güncellendi" under Toplam Nakit.
export function updatedLine(updatedAt: string, today: IsoDate): string {
	const stamp = formatDateTimeTR(updatedAt);
	const [date = "", time = ""] = stamp.split(", ");
	return date === formatDateTR(today, "short")
		? fill(tr.accounts.updatedToday, { time })
		: fill(tr.accounts.updatedOn, { date: date.split(" ").slice(0, 2).join(" ") });
}

// "Yaklaşan Ödemeler": money I still have to pay, late items first, then by date.
export function upcomingPayments(
	events: readonly FinanceEvent[],
	overdue: readonly FinanceEvent[],
	count: number,
): FinanceEvent[] {
	const seen = new Set<string>();
	const coming = [...events].sort((a, b) => a.date.localeCompare(b.date));
	return [...overdue, ...coming]
		.filter((e) => {
			if (e.flow !== "out" || e.amount_minor === null || seen.has(e.key)) return false;
			seen.add(e.key);
			return true;
		})
		.slice(0, count);
}

export function recentTransactions(items: readonly Transaction[], count: number): Transaction[] {
	return items
		.filter((t) => t.deleted_at === null)
		.sort(
			(a, b) =>
				b.occurred_on.localeCompare(a.occurred_on) ||
				b.created_at.localeCompare(a.created_at),
		)
		.slice(0, count);
}
