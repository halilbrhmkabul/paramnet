import { addDays, monthOf, shiftMonth, type IsoDate } from "@paramnet/shared";
import {
	useAccounts,
	useCalendars,
	useCards,
	useDashboard,
	useLoans,
	useRecurring,
	useTransactionMonths,
} from "@/api/hooks";
import { useToday } from "@/lib/clock";

import {
	agreementEvents,
	cardEvents,
	loanEvents,
	recurringEvents,
	transactionEvents,
	type FinanceEvent,
} from "./financeModel";

// The start of time for "everything late so far".
const EPOCH: IsoDate = "2000-01-01";

export function monthsBetween(from: IsoDate, to: IsoDate): IsoDate[] {
	const months: IsoDate[] = [];
	for (let m = monthOf(from); m <= to; m = shiftMonth(m, 1)) months.push(m);
	return months;
}

export type FinanceData = {
	isPending: boolean;
	error: unknown;
	refetch: () => void;
	// Everything dated in [from, to].
	events: FinanceEvent[];
	// Everything late, whatever its date.
	overdue: FinanceEvent[];
	// Toplam Nakit, the projection's starting point; null without accounts.
	cashMinor: number | null;
};

// One read model for design 26 and the home screen's "Yaklaşan Ödemeler": each module's own query,
// combined on the device (ADR-060).
export function useFinanceEvents(from: IsoDate, to: IsoDate): FinanceData {
	const today = useToday();
	const months = monthsBetween(from, to);
	const calendars = useCalendars(months);
	// Recorded money only exists up to this month.
	const transactions = useTransactionMonths(months.filter((m) => m <= monthOf(today)));
	const cards = useCards();
	const loans = useLoans();
	const recurring = useRecurring();
	const dashboard = useDashboard();
	const accounts = useAccounts();

	const queries = [...calendars, ...transactions, cards, loans, recurring, dashboard, accounts];
	const isPending = queries.some((q) => q.isPending);
	const error = queries.find((q) => q.isError)?.error ?? null;

	const dueItems = calendars.flatMap((q) =>
		Object.values(q.data?.days ?? {}).flatMap((items) => items ?? []),
	);
	const txItems = transactions.flatMap((q) => q.data?.items ?? []);
	const cardList = cards.data?.cards ?? [];
	const loanList = loans.data?.loans ?? [];
	const rules = recurring.data ?? [];

	// A few hundred items at most: cheap enough to rebuild on each render.
	const events = isPending
		? []
		: [
				...agreementEvents(
					dueItems.filter((item) => item.due_date >= from && item.due_date <= to),
					today,
				),
				...cardEvents(cardList, from, to, today),
				...loanEvents(loanList, from, to, today),
				...recurringEvents(rules, from, to, today),
				...transactionEvents(
					txItems.filter((t) => t.occurred_on >= from && t.occurred_on <= to),
				),
			];

	const overdue = isPending
		? []
		: [
				...agreementEvents(dashboard.data?.overdue ?? [], today),
				...cardEvents(cardList, EPOCH, today, today),
				...loanEvents(loanList, EPOCH, addDays(today, -1), today),
				...recurringEvents(rules, EPOCH, today, today),
			]
				.filter((e) => e.status === "overdue" || e.status === "waiting")
				.sort((a, b) => a.date.localeCompare(b.date));

	const list = accounts.data?.accounts ?? [];
	return {
		isPending,
		error,
		refetch: () => {
			for (const q of queries) void q.refetch();
		},
		events,
		overdue,
		cashMinor: list.length === 0 ? null : (accounts.data?.total_cash_minor ?? null),
	};
}
