import { isIsoDate, type IsoDate } from "./dates";
import type { PaymentKind, PaymentStatus } from "./enums";
import { isMinorAmount, type MinorAmount } from "./money";

export type AllocationInstallment = {
	seq: number;
	amount_minor: MinorAmount;
	paid_minor: MinorAmount;
};
export type Allocation = { seq: number; amount_minor: MinorAmount };

export type AllocationError = "invalid_amount" | "amount_exceeds_outstanding";
export type AllocationResult =
	{ ok: true; allocations: Allocation[] } | { ok: false; error: AllocationError };

export type InstallmentStatus = "upcoming" | "due_today" | "overdue" | "paid";
// Spec 8.4: "partial" is shown together with the date-based status, so it is a flag, not a fifth state.
export type InstallmentState = { status: InstallmentStatus; partial: boolean };

export type PaymentLike = { amount_minor: MinorAmount; kind: PaymentKind; status: PaymentStatus };

// Installments come from the database, so a broken invariant is a bug, not user input: throw.
function assertInstallment(row: { amount_minor: number; paid_minor: number }): void {
	if (
		!isMinorAmount(row.amount_minor) ||
		row.amount_minor === 0 ||
		!isMinorAmount(row.paid_minor) ||
		row.paid_minor > row.amount_minor
	) {
		throw new RangeError(
			"installment must satisfy 0 <= paid_minor <= amount_minor, amount_minor > 0",
		);
	}
}

// Spec 5.5: FIFO from the oldest unpaid installment; overflow spills forward.
export function allocatePayment(
	installments: readonly AllocationInstallment[],
	amount: number,
): AllocationResult {
	installments.forEach(assertInstallment);
	if (!isMinorAmount(amount) || amount === 0) {
		return { ok: false, error: "invalid_amount" };
	}
	const ordered = [...installments].sort((a, b) => a.seq - b.seq);
	const owed = ordered.reduce((total, row) => total + (row.amount_minor - row.paid_minor), 0);
	if (amount > owed) {
		return { ok: false, error: "amount_exceeds_outstanding" };
	}

	const allocations: Allocation[] = [];
	let left = amount;
	for (const row of ordered) {
		if (left === 0) {
			break;
		}
		const take = Math.min(left, row.amount_minor - row.paid_minor);
		if (take > 0) {
			allocations.push({ seq: row.seq, amount_minor: take });
			left -= take;
		}
	}
	return { ok: true, allocations };
}

export function installmentStatus(
	installment: { due_date: IsoDate | null; amount_minor: MinorAmount; paid_minor: MinorAmount },
	today: IsoDate,
): InstallmentState {
	assertInstallment(installment);
	if (!isIsoDate(today)) {
		throw new RangeError("today must be an ISO date");
	}
	if (installment.paid_minor === installment.amount_minor) {
		return { status: "paid", partial: false };
	}
	const partial = installment.paid_minor > 0;
	const { due_date } = installment;
	if (due_date === null || due_date > today) {
		return { status: "upcoming", partial };
	}
	return { status: due_date === today ? "due_today" : "overdue", partial };
}

function totalWithStatus(payments: readonly PaymentLike[], status: PaymentStatus): number {
	return payments
		.filter((p) => p.status === status)
		.reduce((total, p) => total + p.amount_minor, 0);
}

// BR-04: principal minus confirmed payments, down payments and discounts. Reported ones wait for the creditor.
export function outstanding(
	agreement: { principal_minor: MinorAmount },
	payments: readonly PaymentLike[],
): MinorAmount {
	const left = agreement.principal_minor - totalWithStatus(payments, "confirmed");
	if (!isMinorAmount(left)) {
		throw new RangeError("confirmed payments exceed the principal (BR-04)");
	}
	return left;
}

// Shown next to the balance: "Kalan 12.000 TL · 4.000 TL onay bekliyor".
export function reportedTotal(payments: readonly PaymentLike[]): MinorAmount {
	return totalWithStatus(payments, "reported");
}
