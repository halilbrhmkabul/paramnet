import {
	allocatePayment,
	generatePlan,
	outstanding,
	type AgreementKind,
	type AgreementStatus,
	type ContactKind,
	type IsoDate,
	type PartyRole,
	type PlanPeriod,
} from "@paramnet/shared";

import type { EventView, PaymentView } from "../types";

export type MockContact = {
	id: string;
	display_name: string;
	phone_e164: string | null;
	kind: ContactKind;
};
export type MockInstallment = {
	id: string;
	seq: number;
	due_date: IsoDate | null;
	amount_minor: number;
	paid_minor: number;
};

export type MockAgreement = {
	id: string;
	kind: AgreementKind;
	title: string;
	description: string | null;
	started_on: IsoDate | null;
	notes: string | null;
	my_role: PartyRole;
	// False only for plans someone else shared with me and I accepted.
	is_creator: boolean;
	// My open amendment (the prototype has no other side to propose one).
	pending_proposal: {
		principal_minor: number;
		plan: { seq: number; due_date: IsoDate | null; amount_minor: number }[];
	} | null;
	contact_id: string;
	status: AgreementStatus;
	principal_minor: number;
	down_payment_minor: number;
	row_version: number;
	created_at: string;
	installments: MockInstallment[];
	payments: PaymentView[];
	events: EventView[];
};

// A plan someone else shared with me (S14 in the prototype).
export type MockIncoming = {
	agreement_id: string;
	token: string;
	title: string;
	kind: AgreementKind;
	creator_name: string;
	my_role: PartyRole;
	status: "pending" | "countered" | "rejected";
	principal_minor: number;
	down_payment_minor: number;
	notes: string | null;
	plan: { seq: number; due_date: IsoDate | null; amount_minor: number }[];
};

export type MockState = {
	contacts: MockContact[];
	agreements: MockAgreement[];
	incoming: MockIncoming[];
	// token → agreement id for plans I shared.
	shares: Map<string, string>;
};

export type NewMockAgreement = Omit<
	MockAgreement,
	| "installments"
	| "payments"
	| "events"
	| "status"
	| "row_version"
	| "is_creator"
	| "pending_proposal"
> & {
	status?: AgreementStatus;
	is_creator?: boolean;
	plan: { seq: number; due_date: IsoDate | null; amount_minor: number }[];
	down_payment_on: IsoDate;
};

// Mirrors create_agreement: version 1, installments, confirmed down payment, "created" event.
export function insertAgreement(state: MockState, input: NewMockAgreement): MockAgreement {
	const { plan, down_payment_on, status = "personal", is_creator = true, ...fields } = input;
	const agreement: MockAgreement = {
		...fields,
		status,
		is_creator,
		pending_proposal: null,
		row_version: 1,
		installments: plan.map((row) => ({
			id: `${input.id}-i${String(row.seq)}`,
			...row,
			paid_minor: 0,
		})),
		payments: [],
		events: [
			{
				id: `${input.id}-e0`,
				type: "created",
				at: input.created_at,
				actor: "me",
				amount_minor: null,
			},
		],
	};
	if (input.down_payment_minor > 0) {
		agreement.payments.push({
			id: `${input.id}-down`,
			amount_minor: input.down_payment_minor,
			paid_on: down_payment_on,
			// Same as create_agreement: the method of a down payment is not asked.
			method: "other",
			kind: "down_payment",
			status: "confirmed",
			note: null,
			created_at: input.created_at,
			by_me: true,
		});
	}
	state.agreements.push(agreement);
	return agreement;
}

export function planFor(
	principal: number,
	downPayment: number,
	count: number,
	period: PlanPeriod,
	firstDueDate: IsoDate | null,
): NewMockAgreement["plan"] {
	const result = generatePlan({ principal, downPayment, count, period, firstDueDate });
	if (!result.ok) {
		throw new Error(`invalid mock plan: ${result.error}`);
	}
	return result.plan;
}

// Mirrors record_payment in personal mode: confirmed, FIFO allocation, settles at zero.
export function applyPayment(agreement: MockAgreement, payment: PaymentView): boolean {
	const allocation = allocatePayment(agreement.installments, payment.amount_minor);
	if (!allocation.ok) {
		return false;
	}
	for (const { seq, amount_minor } of allocation.allocations) {
		const installment = agreement.installments.find((row) => row.seq === seq);
		if (installment !== undefined) {
			installment.paid_minor += amount_minor;
		}
	}
	agreement.payments.push(payment);
	agreement.events.push({
		id: `${payment.id}-e`,
		type: "payment_recorded",
		at: payment.created_at,
		actor: "me",
		amount_minor: payment.amount_minor,
	});
	if (outstanding(agreement, agreement.payments) === 0) {
		agreement.status = "settled";
		agreement.events.push({
			id: `${payment.id}-settled`,
			type: "settled",
			at: payment.created_at,
			actor: "system",
			amount_minor: null,
		});
	}
	agreement.row_version += 1;
	return true;
}
