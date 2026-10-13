import { daysBetween, type IsoDate } from "@paramnet/shared";

import { fill, tr } from "@/i18n/tr";

// "19 gün kaldı" / "Bugün" / "3 gün gecikti", counted in Istanbul days from the app clock's today.
export function dueText(due: IsoDate, today: IsoDate): string {
	const days = daysBetween(today, due);
	if (days === 0) {
		return tr.debts.dueToday;
	}
	return days > 0
		? fill(tr.debts.daysLeft, { days: String(days) })
		: fill(tr.debts.daysLate, { days: String(-days) });
}
