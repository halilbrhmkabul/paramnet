import { daysBetween, type IsoDate } from "@paramnet/shared";

// Design 24 and 25 mark the next row amber when it is this close.
export const SOON_DAYS = 7;

type Row = { due_date: string | null; amount_minor: number };

// Design 23 "Hesaplanan taksit": generatePlan puts the kuruş remainder on the last row only.
export function planSplit(plan: readonly Row[]): {
	count: number;
	base: number;
	last: number;
	total: number;
} {
	const first = plan[0]?.amount_minor ?? 0;
	return {
		count: plan.length,
		base: first,
		last: plan[plan.length - 1]?.amount_minor ?? first,
		total: plan.reduce((sum, row) => sum + row.amount_minor, 0),
	};
}

// Rows are in date order, so the past ones are a prefix; only they can be saved as paid (ADR-059).
export function pastDueCount(plan: readonly Row[], today: IsoDate): number {
	let count = 0;
	for (const row of plan) {
		if (row.due_date === null || row.due_date >= today) {
			break;
		}
		count += 1;
	}
	return count;
}

// Payments are allocated FIFO, so the paid rows are always "the first n".
export function togglePaidCount(current: number, seq: number, checked: boolean): number {
	return checked ? Math.max(current, seq) : Math.min(current, seq - 1);
}

export type RowTiming =
	{ kind: "past" } | { kind: "today" } | { kind: "soon"; days: number } | { kind: "planned" };

export function rowTiming(dueDate: string | null, today: IsoDate): RowTiming {
	if (dueDate === null) {
		return { kind: "planned" };
	}
	const days = daysBetween(today, dueDate);
	if (days < 0) {
		return { kind: "past" };
	}
	if (days === 0) {
		return { kind: "today" };
	}
	return days <= SOON_DAYS ? { kind: "soon", days } : { kind: "planned" };
}

export function nextOpenIndex(
	installments: readonly { amount_minor: number; paid_minor: number }[],
): number {
	return installments.findIndex((row) => row.paid_minor < row.amount_minor);
}

type PaymentRow = {
	amount_minor: number;
	paid_on: string;
	kind: "payment" | "down_payment" | "discount";
	status: string;
	created_at: string;
};

// Design 25 "15 Ağu'da ödendi". The server allocates confirmed payments (not the down payment) to the
// rows FIFO in recording order, so replaying that order finds the payment that filled each row.
export function paidOnDates(
	installments: readonly { amount_minor: number; paid_minor: number }[],
	payments: readonly PaymentRow[],
): (string | null)[] {
	const applied = payments
		.filter((p) => p.status === "confirmed" && p.kind !== "down_payment")
		.sort((a, b) => a.created_at.localeCompare(b.created_at));
	const dates: (string | null)[] = [];
	let need = 0;
	let paid = 0;
	let index = 0;
	for (const row of installments) {
		need += row.amount_minor;
		if (row.paid_minor < row.amount_minor) {
			dates.push(null);
			continue;
		}
		while (paid < need && index < applied.length) {
			paid += applied[index]?.amount_minor ?? 0;
			index += 1;
		}
		dates.push(paid >= need ? (applied[index - 1]?.paid_on ?? null) : null);
	}
	return dates;
}
