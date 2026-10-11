import {
	createAgreementInputSchema,
	outstanding,
	paymentInputSchema,
	todayInIstanbul,
	type IsoDate,
} from "@paramnet/shared";

import type { AgreementsApi } from "../AgreementsApi";
import { ApiError } from "../errors";
import type { CalendarMonth, ContactSummary, DueItem } from "../types";
import { dueItems, inMonth, isOpen, toDetail, toSummary } from "./derive";
import { seedState, type MockSeed } from "./seed";
import { applyPayment, insertAgreement, type MockContact, type MockState } from "./store";
import { clock } from "@/lib/clock";

export type MockApiOptions = {
	now?: () => Date;
	seed?: MockSeed;
	// Simulated network delay so loading states are visible in the prototype.
	latencyMs?: number;
};

const UPCOMING_LIMIT = 5;

export function createMockApi({
	now = () => clock.now(),
	seed = "demo",
	latencyMs = 300,
}: MockApiOptions = {}) {
	const today = (): IsoDate => todayInIstanbul(now());
	const state: MockState = seedState(seed, today());
	const createdByKey = new Map<string, string>();
	const paymentByKey = new Map<string, string>();
	let sequence = 0;
	const nextId = () => {
		sequence += 1;
		return `00000000-0000-4000-9000-${String(sequence).padStart(12, "0")}`;
	};

	async function respond<T>(produce: () => T): Promise<T> {
		if (latencyMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, latencyMs));
		}
		// Callers must never mutate the in-memory store through returned objects.
		return JSON.parse(JSON.stringify(produce())) as T;
	}

	function contactOf(id: string): MockContact {
		const contact = state.contacts.find((c) => c.id === id);
		if (contact === undefined) {
			throw new ApiError("not_found");
		}
		return contact;
	}

	function contactSummary(contact: MockContact): ContactSummary {
		const mine = state.agreements.filter((a) => a.contact_id === contact.id && isOpen(a));
		const net = mine.reduce((total, a) => {
			const left = toSummary(a, contact, today()).outstanding_minor;
			return total + (a.my_role === "creditor" ? left : -left);
		}, 0);
		return { ...contact, net_minor: net, open_agreement_count: mine.length };
	}

	const api: AgreementsApi = {
		getDashboard: () =>
			respond(() => {
				const day = today();
				const open = state.agreements.filter(isOpen);
				const items = dueItems(state.agreements, state.contacts, day);
				const sumFor = (role: "creditor" | "debtor") =>
					open
						.filter((a) => a.my_role === role)
						.reduce(
							(total, a) =>
								total +
								toSummary(a, contactOf(a.contact_id), day).outstanding_minor,
							0,
						);
				const thisMonth = (role: "creditor" | "debtor") =>
					items
						.filter((item) => item.my_role === role && inMonth(item.due_date, day))
						.reduce((total, item) => total + item.due_minor, 0);
				return {
					receivable_minor: sumFor("creditor"),
					payable_minor: sumFor("debtor"),
					due_this_month_minor: thisMonth("debtor"),
					collect_this_month_minor: thisMonth("creditor"),
					overdue: items.filter((item) => item.state.status === "overdue"),
					upcoming: items.filter((item) => item.due_date >= day).slice(0, UPCOMING_LIMIT),
					// Personal mode has nothing waiting for the other party (Faz 2).
					pending_count: 0,
					has_agreements: state.agreements.length > 0,
				};
			}),

		listContacts: () =>
			respond(() =>
				state.contacts
					.map(contactSummary)
					.sort((a, b) => a.display_name.localeCompare(b.display_name, "tr")),
			),

		getContact: (id) =>
			respond(() => {
				const contact = contactOf(id);
				return {
					...contactSummary(contact),
					agreements: state.agreements
						.filter((a) => a.contact_id === id)
						.map((a) => toSummary(a, contact, today())),
				};
			}),

		getAgreement: (id) =>
			respond(() => {
				const agreement = state.agreements.find((a) => a.id === id);
				if (agreement === undefined) {
					throw new ApiError("not_found");
				}
				return toDetail(agreement, contactOf(agreement.contact_id), today());
			}),

		getCalendar: (month) =>
			respond((): CalendarMonth => {
				const days: Partial<Record<IsoDate, DueItem[]>> = {};
				for (const agreement of state.agreements.filter(isOpen)) {
					const contact = contactOf(agreement.contact_id);
					const summary = toSummary(agreement, contact, today());
					for (const row of toDetail(agreement, contact, today()).installments) {
						if (row.due_date === null || !inMonth(row.due_date, month)) {
							continue;
						}
						(days[row.due_date] ??= []).push({
							agreement_id: agreement.id,
							title: agreement.title,
							counterparty_name: contact.display_name,
							my_role: agreement.my_role,
							seq: row.seq,
							installment_count: summary.installment_count,
							due_date: row.due_date,
							due_minor: row.amount_minor - row.paid_minor,
							state: row.state,
						});
					}
				}
				return { month, days };
			}),

		createAgreement: (input, idempotencyKey) =>
			respond(() => {
				const existing = createdByKey.get(idempotencyKey);
				if (existing !== undefined) {
					return { agreement_id: existing, replayed: true };
				}
				// The server re-validates everything the client sent (create_agreement RPC).
				const parsed = createAgreementInputSchema.safeParse(input);
				if (!parsed.success) {
					throw new ApiError("validation_error");
				}
				const { counterparty, terms, ...fields } = parsed.data;
				let contactId: string;
				if ("contact_id" in counterparty) {
					contactId = contactOf(counterparty.contact_id).id;
				} else {
					contactId = nextId();
					state.contacts.push({ id: contactId, ...counterparty.contact });
				}
				const id = nextId();
				insertAgreement(state, {
					id,
					kind: fields.kind,
					title: fields.title,
					description: fields.description,
					started_on: fields.started_on,
					notes: terms.notes,
					my_role: fields.creator_role,
					contact_id: contactId,
					principal_minor: terms.principal_minor,
					down_payment_minor: terms.down_payment_minor,
					down_payment_on: today(),
					created_at: now().toISOString(),
					plan: terms.plan,
				});
				createdByKey.set(idempotencyKey, id);
				return { agreement_id: id, replayed: false };
			}),

		recordPayment: (agreementId, input, rowVersion, idempotencyKey) =>
			respond(() => {
				const existing = paymentByKey.get(idempotencyKey);
				if (existing !== undefined) {
					return { payment_id: existing, replayed: true };
				}
				const agreement = state.agreements.find((a) => a.id === agreementId);
				if (agreement === undefined) {
					throw new ApiError("not_found");
				}
				const parsed = paymentInputSchema.safeParse(input);
				if (!parsed.success) {
					throw new ApiError("validation_error");
				}
				// BR-14: closed agreements take no new payments.
				if (agreement.status !== "personal" && agreement.status !== "active") {
					throw new ApiError("invalid_transition");
				}
				if (agreement.row_version !== rowVersion) {
					throw new ApiError("conflict");
				}
				if (parsed.data.amount_minor > outstanding(agreement, agreement.payments)) {
					throw new ApiError("amount_exceeds_outstanding");
				}
				const id = nextId();
				applyPayment(agreement, {
					id,
					...parsed.data,
					kind: "payment",
					status: "confirmed",
					created_at: now().toISOString(),
				});
				paymentByKey.set(idempotencyKey, id);
				return { payment_id: id, replayed: false };
			}),
	};

	return Object.assign(api, {
		// Test/prototype helper: lets screens show "today" consistently with the mock clock.
		today,
		state,
	});
}

export type MockApi = ReturnType<typeof createMockApi>;
