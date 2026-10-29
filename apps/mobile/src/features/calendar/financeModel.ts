import {
	addDays,
	cutsAround,
	daysBetween,
	formatDateTR,
	formatTRY,
	occurrencesBetween,
	type IsoDate,
} from "@paramnet/shared";
import type { Href } from "expo-router";

import type { Card, DueItem, Loan, RecurringRule, Transaction } from "@/api/types";
import { titleOf } from "@/features/cash/cashModel";
import { fill, tr } from "@/i18n/tr";

// Design 26 (ADR-060): every module's dated items as one list, built on the device from each
// module's own data. Nothing here is stored; the calendar only reads.

// The legend's colours: a payment, a loan installment, money expected from someone, planned income.
export type FinanceKind = "pay" | "loan" | "expected" | "income";

export type FinanceStatus =
	| "paid"
	| "received"
	| "info"
	| "soon"
	| "today"
	| "planned"
	| "expected"
	| "overdue"
	| "waiting";

export type FinanceEvent = {
	key: string;
	date: IsoDate;
	kind: FinanceKind;
	status: FinanceStatus;
	title: string;
	sub: string;
	amount_minor: number | null;
	sign: "plus" | "minus" | "none";
	// Money still to move: what the projection counts. Null for notes and recorded items.
	flow: "in" | "out" | null;
	href: Href;
};

const DONE: ReadonlySet<FinanceStatus> = new Set(["paid", "received", "info"]);

export function isDone(event: FinanceEvent): boolean {
	return DONE.has(event.status);
}

// A payment three days away or closer is "Yaklaşıyor" (design 03, 26).
const SOON_DAYS = 3;

function dateStatus(date: IsoDate, today: IsoDate, later: FinanceStatus): FinanceStatus {
	const days = daysBetween(today, date);
	if (days < 0) return "overdue";
	if (days === 0) return "today";
	return days <= SOON_DAYS ? "soon" : later;
}

export function agreementEvents(items: readonly DueItem[], today: IsoDate): FinanceEvent[] {
	return items.map((item) => {
		const incoming = item.my_role === "creditor";
		const paid = item.state.status === "paid";
		let status: FinanceStatus;
		if (paid) {
			status = incoming ? "received" : "paid";
		} else if (item.state.status === "overdue") {
			status = "overdue";
		} else {
			status = dateStatus(item.due_date, today, incoming ? "expected" : "planned");
		}
		return {
			key: `agreement.${item.agreement_id}.${String(item.seq)}`,
			date: item.due_date,
			kind: incoming ? "expected" : "pay",
			status,
			title:
				item.installment_count > 1
					? fill(tr.calendar.installmentTitle, {
							title: item.title,
							seq: String(item.seq),
							count: String(item.installment_count),
						})
					: item.title,
			sub: fill(incoming ? tr.calendar.agreementExpected : tr.calendar.agreementPay, {
				name: item.counterparty_name,
			}),
			amount_minor: item.due_minor,
			sign: incoming ? "plus" : "none",
			flow: paid ? null : incoming ? "in" : "out",
			href: { pathname: "/agreement/[id]", params: { id: item.agreement_id } },
		};
	});
}

function cardTitle(card: Card): string {
	return card.card_name === null ? card.bank_name : `${card.bank_name} ${card.card_name}`;
}

export function cardEvents(
	cards: readonly Card[],
	from: IsoDate,
	to: IsoDate,
	today: IsoDate,
): FinanceEvent[] {
	const events: FinanceEvent[] = [];
	for (const card of cards) {
		if (card.archived_at !== null) continue;
		const s = card.state;
		const name = cardTitle(card);
		const href: Href = { pathname: "/cards/[id]", params: { id: card.id } };
		const add = (
			suffix: string,
			date: IsoDate,
			fields: Pick<FinanceEvent, "title" | "sub" | "status" | "amount_minor" | "flow">,
		) => {
			if (date < from || date > to) return;
			events.push({
				key: `card.${card.id}.${suffix}.${date}`,
				date,
				kind: "pay",
				sign: "none",
				href,
				...fields,
			});
		};
		const cut = (date: IsoDate, sub: string) => {
			add("cut", date, {
				title: fill(tr.calendar.cardCut, { card: name }),
				sub,
				status: "info",
				amount_minor: null,
				flow: null,
			});
		};
		const dueTitle = fill(tr.calendar.cardDue, { card: name });

		// Earlier statements: their cut, and the payment day once they were paid in full.
		for (const past of s.history) {
			cut(past.cut, fill(tr.calendar.statement, { amount: formatTRY(past.amount_minor) }));
			if (past.status === "paid") {
				add("due", addDays(past.cut, card.due_offset_days), {
					title: dueTitle,
					sub: fill(tr.calendar.statement, { amount: formatTRY(past.amount_minor) }),
					status: "paid",
					amount_minor: past.amount_minor,
					flow: null,
				});
			}
		}

		// The current statement.
		cut(s.last_cut, fill(tr.calendar.statement, { amount: formatTRY(s.statement_minor) }));
		if (s.statement_minor > 0) {
			const settled = s.statement_remaining_minor === 0;
			add("due", s.due_date, {
				title: dueTitle,
				sub: fill(tr.calendar.minimum, { amount: formatTRY(s.minimum_minor) }),
				status: settled
					? "paid"
					: s.overdue
						? "overdue"
						: dateStatus(s.due_date, today, "planned"),
				amount_minor: settled ? s.statement_minor : s.statement_remaining_minor,
				flow: settled ? null : "out",
			});
		}

		// The running period, then later cuts whose amounts are not known yet.
		cut(s.next_cut, fill(tr.calendar.periodSpent, { amount: formatTRY(s.period_spent_minor) }));
		let next = s.next_cut;
		while (next <= to) {
			if (next !== s.next_cut) cut(next, tr.calendar.amountLater);
			add("due", addDays(next, card.due_offset_days), {
				title: dueTitle,
				sub: tr.calendar.amountLater,
				status: "planned",
				amount_minor: null,
				flow: null,
			});
			next = cutsAround(addDays(next, 1), card.statement_day).next;
		}
	}
	return sortEvents(events);
}

export function loanEvents(
	loans: readonly Loan[],
	from: IsoDate,
	to: IsoDate,
	today: IsoDate,
): FinanceEvent[] {
	const events: FinanceEvent[] = [];
	for (const loan of loans) {
		if (loan.archived_at !== null) continue;
		for (const row of loan.schedule) {
			if (row.due_date < from || row.due_date > to) continue;
			const paid = row.seq <= loan.paid;
			events.push({
				key: `loan.${loan.id}.${String(row.seq)}`,
				date: row.due_date,
				kind: "loan",
				status: paid ? "paid" : dateStatus(row.due_date, today, "planned"),
				title: fill(tr.calendar.loanTitle, {
					type: loan.loan_type,
					seq: String(row.seq),
					count: String(loan.term_months),
				}),
				sub: loan.bank_name,
				amount_minor: row.payment_minor,
				sign: "none",
				flow: paid ? null : "out",
				href: { pathname: "/loans/[id]", params: { id: loan.id } },
			});
		}
	}
	return sortEvents(events);
}

// Coming dates are planned; a past date still waiting for "Onayla" stays on its day. Recorded
// dates are already transactions, so they come from transactionEvents instead.
export function recurringEvents(
	rules: readonly RecurringRule[],
	from: IsoDate,
	to: IsoDate,
	today: IsoDate,
): FinanceEvent[] {
	const events: FinanceEvent[] = [];
	for (const rule of rules) {
		if (rule.paused_at !== null) continue;
		const income = rule.kind === "income";
		const start = from > today ? from : addDays(today, 1);
		const coming =
			start > to ? [] : occurrencesBetween(rule.start_on, rule.frequency, start, to);
		const waiting = rule.pending_dates.filter((date) => date >= from && date <= to);
		for (const [date, status] of [
			...waiting.map((d) => [d, "waiting"] as const),
			...coming.map((d) => [d, "planned"] as const),
		]) {
			events.push({
				key: `recurring.${rule.id}.${date}`,
				date,
				kind: income ? "income" : "pay",
				status,
				title: rule.name,
				sub: rule.account_name,
				amount_minor: rule.amount_minor,
				sign: income ? "plus" : "minus",
				flow: income ? "in" : "out",
				href: { pathname: "/recurring/[id]", params: { id: rule.id } },
			});
		}
	}
	return sortEvents(events);
}

// Card spending shows in the statement and loan or card payments on their own days.
export function transactionEvents(items: readonly Transaction[]): FinanceEvent[] {
	return sortEvents(
		items
			.filter(
				(t) =>
					t.deleted_at === null &&
					t.account_id !== null &&
					t.to_loan_id === null &&
					t.to_card_id === null &&
					(t.kind === "income" || t.kind === "expense"),
			)
			.map((t) => {
				const income = t.kind === "income";
				return {
					key: `tx.${t.id}`,
					date: t.occurred_on,
					kind: income ? "income" : "pay",
					status: income ? "received" : "paid",
					title: titleOf(t),
					sub: t.account_name ?? "",
					amount_minor: t.amount_minor,
					sign: income ? "plus" : "minus",
					flow: null,
					href: { pathname: "/transaction/[id]", params: { id: t.id } },
				} satisfies FinanceEvent;
			}),
	);
}

function sortEvents(events: FinanceEvent[]): FinanceEvent[] {
	return events.sort(
		(a, b) =>
			a.date.localeCompare(b.date) ||
			Number(a.status === "info") - Number(b.status === "info") ||
			a.key.localeCompare(b.key),
	);
}

export function eventsByDay(
	events: readonly FinanceEvent[],
): Partial<Record<IsoDate, FinanceEvent[]>> {
	const days: Partial<Record<IsoDate, FinanceEvent[]>> = {};
	for (const event of sortEvents([...events])) {
		(days[event.date] ??= []).push(event);
	}
	return days;
}

export type ProjectionPoint = { date: IsoDate; balance_minor: number };

export type Projection = {
	out_minor: number;
	in_minor: number;
	points: ProjectionPoint[];
	lowest: ProjectionPoint | null;
	// "negative": the balance goes below zero; "receivables": it would if money owed to me came late.
	risk: "negative" | "receivables" | null;
};

// From today's Toplam Nakit, apply every planned in and out over the next `days` days.
export function projection(
	events: readonly FinanceEvent[],
	today: IsoDate,
	startMinor: number,
	days: number,
): Projection {
	const end = addDays(today, days);
	const planned = sortEvents(
		events.filter(
			(e) => e.flow !== null && e.amount_minor !== null && e.date >= today && e.date <= end,
		),
	);
	let balance = startMinor;
	let outMinor = 0;
	let inMinor = 0;
	const points: ProjectionPoint[] = [{ date: today, balance_minor: startMinor }];
	for (const e of planned) {
		const amount = e.amount_minor ?? 0;
		if (e.flow === "in") {
			inMinor += amount;
			balance += amount;
		} else {
			outMinor += amount;
			balance -= amount;
		}
		const last = points[points.length - 1];
		if (last !== undefined && last.date === e.date) {
			last.balance_minor = balance;
		} else {
			points.push({ date: e.date, balance_minor: balance });
		}
	}
	const lowest = points.reduce<ProjectionPoint | null>(
		(low, p) => (low === null || p.balance_minor < low.balance_minor ? p : low),
		null,
	);
	let risk: Projection["risk"] = null;
	if (lowest !== null && lowest.balance_minor < 0) {
		risk = "negative";
	} else if (lowest !== null) {
		const owed = planned
			.filter((e) => e.kind === "expected" && e.date <= lowest.date)
			.reduce((sum, e) => sum + (e.amount_minor ?? 0), 0);
		if (lowest.balance_minor - owed < 0) risk = "receivables";
	}
	return { out_minor: outMinor, in_minor: inMinor, points, lowest, risk };
}

export type Bar = ProjectionPoint & { percent: number; label: string; low: boolean; high: boolean };

// Design 26 ".bars": at most eight columns. The first, last, lowest and highest always stay.
export function barPoints(points: readonly ProjectionPoint[], max: number): Bar[] {
	if (points.length === 0) return [];
	let low = 0;
	let high = 0;
	points.forEach((p, i) => {
		if (p.balance_minor < (points[low]?.balance_minor ?? 0)) low = i;
		if (p.balance_minor > (points[high]?.balance_minor ?? 0)) high = i;
	});
	const target = Math.min(max, points.length);
	const keep = new Set([0, points.length - 1, low, high]);
	for (let step = 1; step < max - 1 && keep.size < target; step += 1) {
		keep.add(Math.round((step * (points.length - 1)) / (max - 1)));
	}
	for (let i = 0; keep.size < target; i += 1) keep.add(i);
	const chosen = [...keep].sort((a, b) => a - b);
	const top = Math.max(1, points[high]?.balance_minor ?? 1);
	let month = "";
	return chosen.map((i, n) => {
		const p = points[i] as ProjectionPoint;
		const [, monthShort = ""] = formatDateTR(p.date, "short").split(" ");
		const day = String(Number(p.date.slice(8, 10)));
		const label = n === 0 || monthShort !== month ? `${day} ${monthShort}` : day;
		month = monthShort;
		return {
			...p,
			// A bar never disappears: at or below zero it keeps a sliver so the day is still seen.
			percent: Math.max(4, Math.round((Math.max(0, p.balance_minor) / top) * 100)),
			label,
			low: i === low && low !== high,
			high: i === high,
		};
	});
}

export function untilLabel(
	date: IsoDate,
	today: IsoDate,
): { label: string; tone: "warning" | "neutral" | "overdue" } {
	const days = daysBetween(today, date);
	if (days < 0) return { label: tr.calendar.status.overdue, tone: "overdue" };
	if (days === 0) return { label: tr.calendar.status.today, tone: "warning" };
	if (days <= SOON_DAYS) {
		return { label: fill(tr.calendar.untilSoon, { count: String(days) }), tone: "warning" };
	}
	return { label: fill(tr.calendar.untilDays, { count: String(days) }), tone: "neutral" };
}
