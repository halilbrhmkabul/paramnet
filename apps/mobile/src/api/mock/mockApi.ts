import {
	createAgreementInputSchema,
	normalizeParamnetId,
	normalizePhoneTR,
	outstanding,
	paymentInputSchema,
	todayInIstanbul,
	type IsoDate,
} from "@paramnet/shared";

import type { AgreementsApi } from "../AgreementsApi";
import { ApiError } from "../errors";
import type {
	CalendarMonth,
	DeliveryState,
	ContactSummary,
	DueItem,
	EventType,
	IdShareResult,
	PendingDecision,
	RequestItem,
	TermsView,
} from "../types";
import { dueItems, inMonth, isOpen, toDetail, toSummary } from "./derive";
import { MOCK_DIRECTORY, MOCK_OWN_PARAMNET_ID, seedState, type MockSeed } from "./seed";
import {
	applyPayment,
	insertAgreement,
	type MockAgreement,
	type MockContact,
	type MockState,
} from "./store";
import { clock } from "@/lib/clock";

export type MockApiOptions = {
	now?: () => Date;
	seed?: MockSeed;
	// Agreements whose hand-over is still open (ADR-058), as the server would hold them.
	deliveries?: Record<string, { reported_at?: string | null }>;
	// Simulated network delay so loading states are visible in the prototype.
	latencyMs?: number;
};

const UPCOMING_LIMIT = 5;
const SHARE_TTL_MS = 7 * 24 * 3600 * 1000;

export function createMockApi({
	now = () => clock.now(),
	seed = "demo",
	latencyMs = 300,
	deliveries = {},
}: MockApiOptions = {}) {
	const today = (): IsoDate => todayInIstanbul(now());
	const state: MockState = seedState(seed, today());
	const createdByKey = new Map<string, string>();
	const delivery = new Map<string, { reported_at: string | null; confirmed_at: string | null }>(
		Object.entries(deliveries).map(([id, d]) => [
			id,
			{ reported_at: d.reported_at ?? null, confirmed_at: null },
		]),
	);
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

	function event(agreement: MockAgreement, type: EventType) {
		agreement.row_version += 1;
		agreement.events.push({
			id: `${agreement.id}-${type}-${String(agreement.row_version)}`,
			type,
			at: now().toISOString(),
			actor: "me",
			amount_minor: null,
		});
	}

	function shareableAgreement(id: string, rowVersion: number): MockAgreement {
		const agreement = state.agreements.find((a) => a.id === id && a.is_creator);
		if (agreement === undefined) {
			throw new ApiError("not_found");
		}
		if (agreement.status !== "personal") {
			throw new ApiError("invalid_transition");
		}
		if (agreement.row_version !== rowVersion) {
			throw new ApiError("conflict");
		}
		return agreement;
	}

	function markShared(agreement: MockAgreement): void {
		agreement.status = "pending";
		agreement.row_version += 1;
		agreement.events.push({
			id: `${agreement.id}-shared-${String(agreement.row_version)}`,
			type: "shared",
			at: now().toISOString(),
			actor: "me",
			amount_minor: null,
		});
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
					// Plans shared with me that wait for my answer.
					pending_count:
						state.incoming.filter((item) => item.status === "pending").length +
						state.agreements
							.filter((a) => a.my_role === "creditor")
							.flatMap((a) => a.payments)
							.filter((p) => p.status === "reported" && !p.by_me).length,
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

		listAgreements: () =>
			respond(() =>
				[...state.agreements]
					.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
					.map((a) => toSummary(a, contactOf(a.contact_id), today())),
			),

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

		createAgreement: (input, idempotencyKey, paidCount = 0) =>
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
				// Checked before anything is written: create_agreement_with_paid rolls back as a whole.
				const paidRows = terms.plan.slice(0, paidCount);
				if (
					!Number.isSafeInteger(paidCount) ||
					paidCount < 0 ||
					paidCount > terms.plan.length ||
					paidRows.some((row) => row.due_date === null || row.due_date > today())
				) {
					throw new ApiError("validation_error");
				}
				let contactId: string;
				if ("contact_id" in counterparty) {
					contactId = contactOf(counterparty.contact_id).id;
				} else {
					contactId = nextId();
					state.contacts.push({ id: contactId, ...counterparty.contact });
				}
				const id = nextId();
				const created = insertAgreement(state, {
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
					// Same as create_agreement: the down payment is dated on the purchase when there is one.
					down_payment_on: fields.started_on ?? today(),
					created_at: now().toISOString(),
					plan: terms.plan,
				});
				for (const row of paidRows) {
					if (row.due_date === null) {
						break;
					}
					applyPayment(created, {
						id: nextId(),
						amount_minor: row.amount_minor,
						paid_on: row.due_date,
						method: "cash",
						note: null,
						kind: "payment",
						status: "confirmed",
						created_at: now().toISOString(),
						by_me: true,
					});
				}
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
				if (!["personal", "active", "amendment_pending"].includes(agreement.status)) {
					throw new ApiError("invalid_transition");
				}
				if (agreement.row_version !== rowVersion) {
					throw new ApiError("conflict");
				}
				if (parsed.data.amount_minor > outstanding(agreement, agreement.payments)) {
					throw new ApiError("amount_exceeds_outstanding");
				}
				const id = nextId();
				paymentByKey.set(idempotencyKey, id);
				// Shared agreement, I am the debtor: my word waits for the creditor (BR-08).
				if (agreement.status !== "personal" && agreement.my_role === "debtor") {
					agreement.payments.push({
						id,
						...parsed.data,
						kind: "payment",
						status: "reported",
						created_at: now().toISOString(),
						by_me: true,
					});
					agreement.events.push({
						id: `${id}-e`,
						type: "payment_reported",
						at: now().toISOString(),
						actor: "me",
						amount_minor: parsed.data.amount_minor,
					});
					agreement.row_version += 1;
					return { payment_id: id, replayed: false };
				}
				applyPayment(agreement, {
					id,
					...parsed.data,
					kind: "payment",
					status: "confirmed",
					created_at: now().toISOString(),
					by_me: true,
				});
				return { payment_id: id, replayed: false };
			}),

		// Sharing (F2-06) — the prototype has no other party, so sharing only changes my record.
		shareAgreement: (id, phone, rowVersion) =>
			respond(() => {
				const agreement = shareableAgreement(id, rowVersion);
				if (normalizePhoneTR(phone) === null) {
					throw new ApiError("validation_error");
				}
				const token = `mock-${id}`;
				state.shares.set(token, id);
				markShared(agreement);
				return {
					token,
					expires_at: new Date(now().getTime() + SHARE_TTL_MS).toISOString(),
				};
			}),

		shareAgreementById: (id, paramnetId, rowVersion) =>
			respond((): IdShareResult => {
				const agreement = shareableAgreement(id, rowVersion);
				const target = normalizeParamnetId(paramnetId);
				if (target === null) {
					return { status: "invalid" };
				}
				if (target === MOCK_OWN_PARAMNET_ID) {
					return { status: "self" };
				}
				const name = MOCK_DIRECTORY[target];
				if (name === undefined) {
					return { status: "not_found" };
				}
				markShared(agreement);
				return {
					status: "shared",
					display_name: name,
					expires_at: new Date(now().getTime() + SHARE_TTL_MS).toISOString(),
				};
			}),

		withdrawShare: (id) =>
			respond(() => {
				const agreement = state.agreements.find((a) => a.id === id && a.is_creator);
				if (agreement === undefined) {
					throw new ApiError("not_found");
				}
				if (agreement.status !== "pending" && agreement.status !== "countered") {
					throw new ApiError("invalid_transition");
				}
				agreement.status = "personal";
				agreement.row_version += 1;
				agreement.events.push({
					id: `${id}-withdrawn-${String(agreement.row_version)}`,
					type: "share_withdrawn",
					at: now().toISOString(),
					actor: "me",
					amount_minor: null,
				});
			}),

		makePersonal: (id) =>
			respond(() => {
				const agreement = state.agreements.find((a) => a.id === id && a.is_creator);
				if (agreement?.status !== "rejected") {
					throw new ApiError(
						agreement === undefined ? "not_found" : "invalid_transition",
					);
				}
				agreement.status = "personal";
				agreement.row_version += 1;
			}),

		resolveInvite: (token) =>
			respond(() => {
				const incoming = state.incoming.find((item) => item.token === token);
				if (incoming !== undefined) {
					return incoming.status === "pending"
						? {
								status: "active" as const,
								creator_name: incoming.creator_name,
								mismatch: false,
								agreement_id: incoming.agreement_id,
							}
						: { status: "consumed" as const, creator_name: incoming.creator_name };
				}
				// My own link was sent to the other person's number, not to me.
				return state.shares.has(token)
					? {
							status: "active" as const,
							creator_name: "",
							mismatch: true,
							agreement_id: null,
						}
					: { status: "invalid" as const };
			}),

		getPendingDecision: (id) =>
			respond((): PendingDecision => {
				const incoming = state.incoming.find(
					(item) => item.agreement_id === id && item.status === "pending",
				);
				if (incoming === undefined) {
					throw new ApiError("not_found");
				}
				const terms: TermsView = {
					principal_minor: incoming.principal_minor,
					down_payment_minor: incoming.down_payment_minor,
					notes: incoming.notes,
					plan: incoming.plan,
				};
				return {
					agreement_id: id,
					title: incoming.title,
					actor: "counterparty",
					other_name: incoming.creator_name,
					my_role: incoming.my_role,
					version: 1,
					terms_hash: "mock",
					current: terms,
					proposed: terms,
					can_reject: true,
					reason: null,
					payments: [],
				};
			}),

		decide: (id, _actor, version, termsHash, decision) =>
			respond(() => {
				const incoming = state.incoming.find(
					(item) => item.agreement_id === id && item.status === "pending",
				);
				if (incoming === undefined) {
					throw new ApiError("not_found");
				}
				if (version !== 1 || termsHash !== "mock") {
					throw new ApiError("conflict");
				}
				if (decision === "reject") {
					incoming.status = "rejected";
					return { status: "rejected", version: 1 };
				}
				if (decision === "counter") {
					incoming.status = "countered";
					return { status: "countered", version: 2 };
				}
				const contactId = nextId();
				state.contacts.push({
					id: contactId,
					display_name: incoming.creator_name,
					phone_e164: null,
					kind: "person",
				});
				state.incoming = state.incoming.filter((item) => item !== incoming);
				insertAgreement(state, {
					id,
					kind: incoming.kind,
					title: incoming.title,
					description: null,
					started_on: null,
					notes: incoming.notes,
					my_role: incoming.my_role,
					contact_id: contactId,
					principal_minor: incoming.principal_minor,
					down_payment_minor: incoming.down_payment_minor,
					down_payment_on: today(),
					created_at: now().toISOString(),
					plan: incoming.plan,
					status: "active",
					is_creator: false,
				});
				return { status: "active", version: 1 };
			}),

		listRequests: () =>
			respond((): RequestItem[] => [
				...state.incoming
					.filter((item) => item.status === "pending")
					.map((item) => ({
						agreement_id: item.agreement_id,
						kind: "share" as const,
						title: item.title,
						from_name: item.creator_name,
						my_role: item.my_role,
						principal_minor: item.principal_minor,
					})),
				...state.agreements
					.filter(
						(a) =>
							a.my_role === "creditor" &&
							(a.status === "active" || a.status === "amendment_pending"),
					)
					.flatMap((a) =>
						a.payments
							.filter((p) => p.status === "reported" && !p.by_me)
							.map((p) => ({
								agreement_id: a.id,
								kind: "payment" as const,
								payment_id: p.id,
								title: a.title,
								from_name: contactOf(a.contact_id).display_name,
								my_role: "creditor" as const,
								principal_minor: a.principal_minor,
								amount_minor: p.amount_minor,
								paid_on: p.paid_on,
								note: p.note,
							})),
					),
			]),

		decidePayment: (paymentId, decision) =>
			respond(() => {
				const agreement = state.agreements.find((a) =>
					a.payments.some((p) => p.id === paymentId),
				);
				const payment = agreement?.payments.find((p) => p.id === paymentId);
				if (agreement === undefined || payment === undefined) {
					throw new ApiError("not_found");
				}
				if (agreement.my_role !== "creditor" || payment.by_me) {
					throw new ApiError("forbidden");
				}
				if (payment.status !== "reported") {
					throw new ApiError("invalid_transition");
				}
				if (decision === "reject") {
					payment.status = "rejected";
				} else {
					// applyPayment appends; take the reported entry out first so it is not listed twice.
					agreement.payments = agreement.payments.filter((p) => p !== payment);
					applyPayment(agreement, { ...payment, status: "confirmed" });
				}
				agreement.events.push({
					id: `${paymentId}-${decision}`,
					type: decision === "confirm" ? "payment_confirmed" : "payment_rejected",
					at: now().toISOString(),
					actor: "me",
					amount_minor: payment.amount_minor,
				});
				agreement.row_version += 1;
				return {
					status: decision === "confirm" ? "confirmed" : "rejected",
					replayed: false,
				};
			}),

		withdrawPayment: (paymentId) =>
			respond(() => {
				const agreement = state.agreements.find((a) =>
					a.payments.some((p) => p.id === paymentId),
				);
				const payment = agreement?.payments.find((p) => p.id === paymentId);
				if (agreement === undefined || payment === undefined) {
					throw new ApiError("not_found");
				}
				if (!payment.by_me) {
					throw new ApiError("forbidden");
				}
				if (payment.status !== "reported") {
					throw new ApiError("invalid_transition");
				}
				payment.status = "withdrawn";
				agreement.events.push({
					id: `${paymentId}-withdrawn`,
					type: "payment_withdrawn",
					at: now().toISOString(),
					actor: "me",
					amount_minor: payment.amount_minor,
				});
				agreement.row_version += 1;
			}),

		proposeAmendment: (id, terms, _reason, rowVersion) =>
			respond(() => {
				const agreement = state.agreements.find((a) => a.id === id);
				if (agreement === undefined) {
					throw new ApiError("not_found");
				}
				if (
					!["active", "disputed"].includes(agreement.status) ||
					agreement.pending_proposal !== null
				) {
					throw new ApiError("invalid_transition");
				}
				if (agreement.row_version !== rowVersion) {
					throw new ApiError("conflict");
				}
				agreement.pending_proposal = {
					principal_minor: terms.principal_minor,
					plan: terms.plan,
				};
				if (agreement.status === "active") {
					agreement.status = "amendment_pending";
				}
				agreement.row_version += 1;
				agreement.events.push({
					id: `${id}-amend-${String(agreement.row_version)}`,
					type: "amendment_proposed",
					at: now().toISOString(),
					actor: "me",
					amount_minor: null,
				});
				return { status: agreement.status, version: 2 };
			}),

		withdrawAmendment: (id) =>
			respond(() => {
				const agreement = state.agreements.find((a) => a.id === id);
				if (agreement?.pending_proposal == null) {
					throw new ApiError(
						agreement === undefined ? "not_found" : "invalid_transition",
					);
				}
				agreement.pending_proposal = null;
				if (agreement.status === "amendment_pending") {
					agreement.status = "active";
				}
				agreement.row_version += 1;
				agreement.events.push({
					id: `${id}-amend-w-${String(agreement.row_version)}`,
					type: "amendment_withdrawn",
					at: now().toISOString(),
					actor: "me",
					amount_minor: null,
				});
			}),

		// Disputes, cancellation, forgiveness (F2-09): only my side exists in the prototype.
		openDispute: (id, reason, paymentId, rowVersion) =>
			respond(() => {
				const agreement = state.agreements.find((a) => a.id === id);
				if (agreement === undefined) {
					throw new ApiError("not_found");
				}
				if (!["active", "amendment_pending"].includes(agreement.status)) {
					throw new ApiError("invalid_transition");
				}
				if (agreement.row_version !== rowVersion) {
					throw new ApiError("conflict");
				}
				if (reason.trim() === "") {
					throw new ApiError("validation_error");
				}
				agreement.dispute = {
					by_me: true,
					reason,
					payment_id: paymentId,
					opened_at: now().toISOString(),
				};
				agreement.status = "disputed";
				event(agreement, "dispute_opened");
				return { status: agreement.status };
			}),

		resolveDispute: (id) =>
			respond(() => {
				const agreement = state.agreements.find((a) => a.id === id);
				if (agreement?.dispute == null) {
					throw new ApiError(
						agreement === undefined ? "not_found" : "invalid_transition",
					);
				}
				agreement.dispute = null;
				agreement.status =
					agreement.pending_proposal === null ? "active" : "amendment_pending";
				event(agreement, "dispute_resolved");
			}),

		requestCancel: (id, rowVersion) =>
			respond(() => {
				const agreement = state.agreements.find((a) => a.id === id);
				if (agreement === undefined) {
					throw new ApiError("not_found");
				}
				if (
					!["active", "amendment_pending", "disputed"].includes(agreement.status) ||
					agreement.cancel_request !== null
				) {
					throw new ApiError("invalid_transition");
				}
				if (agreement.row_version !== rowVersion) {
					throw new ApiError("conflict");
				}
				agreement.cancel_request = { by_me: true, requested_at: now().toISOString() };
				event(agreement, "cancel_requested");
			}),

		decideCancel: (id) =>
			respond(() => {
				const agreement = state.agreements.find((a) => a.id === id);
				if (agreement === undefined) {
					throw new ApiError("not_found");
				}
				// My own request is the only kind the prototype has, and I cannot answer it.
				throw new ApiError(
					agreement.cancel_request === null ? "invalid_transition" : "forbidden",
				);
			}),

		// The prototype keeps everything in memory; that snapshot is the export.
		exportMyData: () =>
			respond(() => ({
				exported_at: now().toISOString(),
				contacts: state.contacts,
				agreements: state.agreements,
			})),

		// The prototype records no analytics.
		trackEvent: () => Promise.resolve(),

		forgiveRemaining: (id, amountMinor, rowVersion, idempotencyKey) =>
			respond(() => {
				const existing = paymentByKey.get(idempotencyKey);
				if (existing !== undefined) {
					return { payment_id: existing, replayed: true, settled: false };
				}
				const agreement = state.agreements.find((a) => a.id === id);
				if (agreement === undefined) {
					throw new ApiError("not_found");
				}
				if (agreement.my_role !== "creditor") {
					throw new ApiError("forbidden");
				}
				if (!["personal", "active", "amendment_pending"].includes(agreement.status)) {
					throw new ApiError("invalid_transition");
				}
				if (agreement.row_version !== rowVersion) {
					throw new ApiError("conflict");
				}
				const left = outstanding(agreement, agreement.payments);
				const amount = amountMinor ?? left;
				if (amount <= 0) {
					throw new ApiError("validation_error");
				}
				if (amount > left) {
					throw new ApiError("amount_exceeds_outstanding");
				}
				const paymentId = nextId();
				paymentByKey.set(idempotencyKey, paymentId);
				applyPayment(agreement, {
					id: paymentId,
					amount_minor: amount,
					paid_on: today(),
					method: "other",
					kind: "discount",
					status: "confirmed",
					note: null,
					created_at: now().toISOString(),
					by_me: true,
				});
				const recorded = agreement.events.find((e) => e.id === `${paymentId}-e`);
				if (recorded !== undefined) {
					recorded.type = "forgiven";
				}
				return {
					payment_id: paymentId,
					replayed: false,
					settled: agreement.status === "settled",
				};
			}),
		requestMoney: async (input, paramnetId, idempotencyKey) => {
			const created = await api.createAgreement(input, idempotencyKey);
			if (created.replayed) {
				return { agreement_id: created.agreement_id, display_name: null };
			}
			const agreement = state.agreements.find((a) => a.id === created.agreement_id);
			const shared = await api.shareAgreementById(
				created.agreement_id,
				paramnetId,
				agreement?.row_version ?? 1,
			);
			if (shared.status !== "shared") {
				// The server keeps nothing for a request that could not be sent.
				state.agreements = state.agreements.filter((a) => a.id !== created.agreement_id);
				createdByKey.delete(idempotencyKey);
				throw new ApiError("not_found", { field: shared.status });
			}
			delivery.set(created.agreement_id, { reported_at: null, confirmed_at: null });
			return { agreement_id: created.agreement_id, display_name: shared.display_name };
		},

		getDelivery: (id) => respond(() => deliveryView(id)),
		reportDelivery: (id, rowVersion) => respond(() => deliveryStep(id, rowVersion, "report")),
		confirmDelivery: (id, rowVersion) => respond(() => deliveryStep(id, rowVersion, "confirm")),
	};

	function deliveryView(id: string): DeliveryState {
		const agreement = state.agreements.find((a) => a.id === id);
		if (agreement === undefined) {
			throw new ApiError("not_found");
		}
		const d = delivery.get(id);
		return {
			required: d !== undefined,
			reported_at: d?.reported_at ?? null,
			confirmed_at: d?.confirmed_at ?? null,
			my_role: agreement.my_role,
			status: agreement.status,
			row_version: agreement.row_version,
		};
	}

	function deliveryStep(
		id: string,
		rowVersion: number,
		step: "report" | "confirm",
	): DeliveryState {
		const current = deliveryView(id);
		const d = delivery.get(id);
		if ((step === "report") !== (current.my_role === "creditor")) {
			throw new ApiError("forbidden");
		}
		if (
			d === undefined ||
			current.status !== "active" ||
			(step === "report" && d.reported_at !== null) ||
			(step === "confirm" && (d.reported_at === null || d.confirmed_at !== null))
		) {
			throw new ApiError("invalid_transition");
		}
		if (current.row_version !== rowVersion) {
			throw new ApiError("conflict");
		}
		const agreement = state.agreements.find((a) => a.id === id);
		if (agreement !== undefined) {
			agreement.row_version += 1;
		}
		if (step === "report") {
			d.reported_at = now().toISOString();
		} else {
			d.confirmed_at = now().toISOString();
		}
		return deliveryView(id);
	}

	return Object.assign(api, {
		// Test/prototype helper: lets screens show "today" consistently with the mock clock.
		today,
		state,
	});
}

export type MockApi = ReturnType<typeof createMockApi>;
