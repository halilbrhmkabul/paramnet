import { daysBetween, formatDateTR, type IsoDate } from "@paramnet/shared";

import type { Card } from "@/api/types";
import { upperTR } from "@/features/cash/cashModel";
import { fill, tr } from "@/i18n/tr";

// Design 07 ".bd": days until the payment date, or that it passed / is done.
export function dueBadge(
	card: Card,
	today: IsoDate,
): { label: string; tone: "neutral" | "warning" | "overdue" | "success" } {
	const { due_date, statement_remaining_minor, overdue } = card.state;
	if (statement_remaining_minor === 0) {
		return { label: tr.cards.paid, tone: "success" };
	}
	if (overdue) {
		return { label: tr.cards.overdue, tone: "overdue" };
	}
	const days = daysBetween(today, due_date);
	if (days === 0) {
		return { label: tr.cards.dueToday, tone: "warning" };
	}
	return {
		label: fill(tr.cards.daysLeft, { count: String(days) }),
		tone: days <= 3 ? "warning" : "neutral",
	};
}

export function usedPercent(card: Card): number {
	return card.limit_minor <= 0
		? 0
		: Math.round(((card.limit_minor - card.state.available_minor) / card.limit_minor) * 100);
}

// "KESİM 9 EKİM" on the card face.
export function cutLabel(card: Card): string {
	return fill(tr.cards.cut, { date: upperTR(formatDateTR(card.state.last_cut, "dayMonth")) });
}
