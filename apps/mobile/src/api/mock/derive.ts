import {
	installmentStatus,
	monthOf,
	outstanding,
	reportedTotal,
	type IsoDate,
} from "@paramnet/shared";

import type { AgreementDetail, AgreementSummary, DueItem, InstallmentView } from "../types";
import type { MockAgreement, MockContact } from "./store";

// Cancelled and rejected plans no longer count towards balances or reminders.
export function isOpen(agreement: MockAgreement): boolean {
	return (
		agreement.status !== "cancelled" &&
		agreement.status !== "rejected" &&
		agreement.status !== "settled"
	);
}

function installmentViews(agreement: MockAgreement, today: IsoDate): InstallmentView[] {
	return agreement.installments.map((row) => ({ ...row, state: installmentStatus(row, today) }));
}

export function toSummary(
	agreement: MockAgreement,
	contact: MockContact,
	today: IsoDate,
): AgreementSummary {
	const installments = installmentViews(agreement, today);
	const next = installments.find((row) => row.state.status !== "paid");
	return {
		id: agreement.id,
		kind: agreement.kind,
		title: agreement.title,
		status: agreement.status,
		my_role: agreement.my_role,
		is_creator: agreement.is_creator,
		counterparty: {
			contact_id: contact.id,
			display_name: contact.display_name,
			kind: contact.kind,
			phone_e164: contact.phone_e164,
		},
		principal_minor: agreement.principal_minor,
		outstanding_minor: outstanding(agreement, agreement.payments),
		reported_minor: reportedTotal(agreement.payments),
		installment_count: installments.length,
		paid_installment_count: installments.filter((row) => row.state.status === "paid").length,
		next_installment:
			next === undefined
				? null
				: {
						seq: next.seq,
						due_date: next.due_date,
						due_minor: next.amount_minor - next.paid_minor,
						state: next.state,
					},
		row_version: agreement.row_version,
	};
}

export function toDetail(
	agreement: MockAgreement,
	contact: MockContact,
	today: IsoDate,
): AgreementDetail {
	return {
		...toSummary(agreement, contact, today),
		description: agreement.description,
		started_on: agreement.started_on,
		pending_by_me: agreement.pending_proposal === null ? null : true,
		notes: agreement.notes,
		down_payment_minor: agreement.down_payment_minor,
		created_at: agreement.created_at,
		installments: installmentViews(agreement, today),
		// Newest payment date first, then newest record (same order as get_agreement_detail).
		payments: [...agreement.payments].sort((a, b) =>
			a.paid_on !== b.paid_on
				? a.paid_on < b.paid_on
					? 1
					: -1
				: a.created_at < b.created_at
					? 1
					: -1,
		),
		events: [...agreement.events],
	};
}

// Unpaid installments that have a due date, across open agreements.
export function dueItems(
	agreements: MockAgreement[],
	contacts: MockContact[],
	today: IsoDate,
): DueItem[] {
	const items: DueItem[] = [];
	for (const agreement of agreements.filter(isOpen)) {
		const contact = contacts.find((c) => c.id === agreement.contact_id);
		for (const row of installmentViews(agreement, today)) {
			if (row.due_date === null || row.state.status === "paid") {
				continue;
			}
			items.push({
				agreement_id: agreement.id,
				title: agreement.title,
				counterparty_name: contact?.display_name ?? "",
				my_role: agreement.my_role,
				seq: row.seq,
				installment_count: agreement.installments.length,
				due_date: row.due_date,
				due_minor: row.amount_minor - row.paid_minor,
				state: row.state,
			});
		}
	}
	return items.sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0));
}

export function inMonth(date: IsoDate, month: IsoDate): boolean {
	return monthOf(date) === monthOf(month);
}
