import { annuityPayment, loanSchedule, type IsoDate } from "@paramnet/shared";

import type { Card, DueItem, Loan, RecurringRule, Transaction } from "@/api/types";

import {
	agreementEvents,
	barPoints,
	cardEvents,
	eventsByDay,
	loanEvents,
	projection,
	recurringEvents,
	transactionEvents,
	untilLabel,
	type FinanceEvent,
} from "../financeModel";

const TODAY: IsoDate = "2026-10-12";

function due(over: Partial<DueItem>): DueItem {
	return {
		agreement_id: "a1",
		title: "Mobilya",
		counterparty_name: "Kaya Mobilya",
		my_role: "debtor",
		seq: 3,
		installment_count: 6,
		due_date: "2026-10-15",
		due_minor: 333333,
		state: { status: "upcoming", partial: false },
		...over,
	};
}

function card(over: Partial<Card["state"]> = {}): Card {
	return {
		id: "c1",
		bank_name: "Yapı Kredi",
		card_name: "World",
		last4: "4281",
		label: "Yapı Kredi World ••4281",
		color: "navy",
		limit_minor: 6000000,
		opening_debt_minor: 0,
		statement_day: 9,
		due_offset_days: 10,
		min_payment_rate: 40,
		archived_at: null,
		row_version: 1,
		created_at: "2026-08-01T00:00:00Z",
		state: {
			last_cut: "2026-10-09",
			next_cut: "2026-11-09",
			due_date: "2026-10-19",
			statement_minor: 1245000,
			paid_since_minor: 0,
			statement_remaining_minor: 1245000,
			minimum_minor: 498000,
			minimum_remaining_minor: 498000,
			period_spent_minor: 128460,
			total_debt_minor: 1373460,
			used_minor: 1373460,
			available_minor: 4626540,
			overdue: false,
			history: [
				{ cut: "2026-09-09", amount_minor: 900000, paid_minor: 900000, status: "paid" },
			],
			installments: [],
			...over,
		},
	};
}

function loan(paid: number): Loan {
	const schedule = loanSchedule(
		10000000,
		250,
		24,
		"2026-02-28",
		annuityPayment(10000000, 250, 24),
	);
	return {
		id: "l1",
		bank_name: "İş Bankası",
		loan_type: "İhtiyaç kredisi",
		principal_minor: 10000000,
		monthly_rate_bps: 250,
		term_months: 24,
		first_due_on: "2026-02-28",
		installment_minor: schedule[0]?.payment_minor ?? 0,
		payment_account_id: null,
		payment_account_name: null,
		archived_at: null,
		row_version: 1,
		created_at: "2026-02-01T00:00:00Z",
		schedule,
		paid,
		remaining_principal_minor: 0,
		remaining_total_minor: 0,
		total_payment_minor: 0,
		total_interest_minor: 0,
		next: schedule[paid] ?? null,
	};
}

function rule(over: Partial<RecurringRule>): RecurringRule {
	return {
		id: "r1",
		kind: "expense",
		name: "Kira",
		amount_minor: 1500000,
		category: "rent",
		account_id: "acc",
		account_name: "Maaş Hesabı",
		frequency: "monthly",
		start_on: "2026-01-03",
		confirm_each: true,
		paused_at: null,
		next_dates: [],
		pending_dates: [],
		row_version: 1,
		created_at: "2026-01-01T00:00:00Z",
		...over,
	};
}

function tx(over: Partial<Transaction>): Transaction {
	return {
		id: "t1",
		kind: "income",
		account_id: "acc",
		account_name: "Maaş Hesabı",
		to_account_id: null,
		to_account_name: null,
		card_id: null,
		card_name: null,
		to_card_id: null,
		to_card_name: null,
		installments: 1,
		to_loan_id: null,
		to_loan_name: null,
		amount_minor: 3850000,
		category: "salary",
		title: "Maaş",
		note: null,
		occurred_on: "2026-10-01",
		deleted_at: null,
		row_version: 1,
		created_at: "2026-10-01T09:00:00Z",
		updated_at: "2026-10-01T09:00:00Z",
		...over,
	};
}

const pick = (events: FinanceEvent[], date: IsoDate) => events.filter((e) => e.date === date);

describe("agreementEvents", () => {
	it("names the installment, counts my debts as payments and others' as expected money", () => {
		const [mine, theirs] = agreementEvents(
			[
				due({}),
				due({
					agreement_id: "a2",
					title: "Borç",
					counterparty_name: "Ayşe Demir",
					my_role: "creditor",
					seq: 1,
					installment_count: 1,
					due_date: "2026-10-25",
					due_minor: 450000,
				}),
			],
			TODAY,
		);
		expect(mine).toMatchObject({
			title: "Mobilya 3/6",
			sub: "Kaya Mobilya · Ödeme",
			kind: "pay",
			flow: "out",
			status: "soon",
			amount_minor: 333333,
		});
		expect(theirs).toMatchObject({
			title: "Borç",
			sub: "Ayşe Demir · Beklenen tahsilat",
			kind: "expected",
			flow: "in",
			status: "expected",
		});
	});

	it("marks paid and overdue installments; paid ones no longer move money", () => {
		const [paid, late] = agreementEvents(
			[
				due({ due_date: "2026-10-01", state: { status: "paid", partial: false } }),
				due({
					seq: 4,
					due_date: "2026-10-05",
					state: { status: "overdue", partial: true },
				}),
			],
			TODAY,
		);
		expect(paid).toMatchObject({ status: "paid", flow: null });
		expect(late).toMatchObject({ status: "overdue", flow: "out" });
	});
});

describe("cardEvents", () => {
	it("puts the cut, the payment day and the next cut on their days", () => {
		const events = cardEvents([card()], "2026-09-01", "2026-11-30", TODAY);
		expect(pick(events, "2026-10-09")[0]).toMatchObject({
			title: "Yapı Kredi World hesap kesimi",
			sub: "Ekstre 12.450,00 TL",
			status: "info",
			flow: null,
		});
		expect(pick(events, "2026-10-19")[0]).toMatchObject({
			title: "Yapı Kredi World son ödeme",
			sub: "Asgari 4.980,00 TL",
			amount_minor: 1245000,
			status: "planned",
			flow: "out",
			kind: "pay",
		});
		expect(pick(events, "2026-11-09")[0]).toMatchObject({
			sub: "Dönem harcaması 1.284,60 TL",
			status: "info",
		});
		// A paid earlier statement shows its cut and its payment day.
		expect(pick(events, "2026-09-09")[0]?.status).toBe("info");
		expect(pick(events, "2026-09-19")[0]).toMatchObject({ status: "paid", flow: null });
		// The next statement's payment day is known, its amount is not yet.
		expect(pick(events, "2026-11-19")[0]).toMatchObject({ amount_minor: null, flow: null });
	});

	it("says when the payment is close, paid or late", () => {
		const soon = cardEvents([card()], TODAY, TODAY, "2026-10-17");
		expect(soon).toEqual([]);
		const near = cardEvents([card()], "2026-10-19", "2026-10-19", "2026-10-17");
		expect(near[0]?.status).toBe("soon");
		const paid = cardEvents(
			[card({ statement_remaining_minor: 0, paid_since_minor: 1245000 })],
			"2026-10-19",
			"2026-10-19",
			TODAY,
		);
		expect(paid[0]).toMatchObject({ status: "paid", amount_minor: 1245000, flow: null });
		const late = cardEvents(
			[card({ overdue: true })],
			"2026-10-19",
			"2026-10-19",
			"2026-10-21",
		);
		expect(late[0]?.status).toBe("overdue");
	});

	it("skips archived cards", () => {
		expect(
			cardEvents(
				[{ ...card(), archived_at: "2026-10-01T00:00:00Z" }],
				"2026-10-01",
				"2026-10-31",
				TODAY,
			),
		).toEqual([]);
	});
});

describe("loanEvents", () => {
	it("lists the plan's rows with their number; paid ones are done, missed ones late", () => {
		const events = loanEvents([loan(7)], "2026-08-01", "2026-10-31", TODAY);
		expect(events.map((e) => [e.date, e.title, e.status])).toEqual([
			["2026-08-28", "İhtiyaç kredisi 7/24", "paid"],
			["2026-09-28", "İhtiyaç kredisi 8/24", "overdue"],
			["2026-10-28", "İhtiyaç kredisi 9/24", "planned"],
		]);
		expect(events[2]).toMatchObject({ kind: "loan", sub: "İş Bankası", flow: "out" });
	});
});

describe("recurringEvents", () => {
	it("plans the coming dates and keeps unconfirmed past ones waiting", () => {
		const events = recurringEvents(
			[
				rule({ pending_dates: ["2026-10-03"] }),
				rule({
					id: "r2",
					kind: "income",
					name: "Maaş",
					amount_minor: 3850000,
					category: "salary",
					start_on: "2026-01-01",
				}),
				rule({ id: "r3", name: "Spor salonu", paused_at: "2026-09-01T00:00:00Z" }),
			],
			"2026-10-01",
			"2026-11-05",
			TODAY,
		);
		expect(events.map((e) => [e.date, e.title, e.status, e.flow])).toEqual([
			["2026-10-03", "Kira", "waiting", "out"],
			["2026-11-01", "Maaş", "planned", "in"],
			["2026-11-03", "Kira", "planned", "out"],
		]);
		expect(events[1]).toMatchObject({ kind: "income", sub: "Maaş Hesabı" });
	});
});

describe("transactionEvents", () => {
	it("shows recorded income and account expenses, not transfers, card spending or loan payments", () => {
		const events = transactionEvents([
			tx({}),
			tx({
				id: "t2",
				kind: "expense",
				category: "bills",
				title: "Elektrik faturası",
				amount_minor: 84230,
				occurred_on: "2026-10-08",
			}),
			tx({ id: "t3", kind: "transfer", category: null, title: null }),
			tx({ id: "t4", kind: "expense", account_id: null, card_id: "c1", title: "Migros" }),
			tx({ id: "t5", kind: "expense", to_loan_id: "l1", title: "Kredi" }),
			tx({ id: "t6", deleted_at: "2026-10-02T00:00:00Z" }),
		]);
		expect(events.map((e) => [e.title, e.status, e.sign, e.flow])).toEqual([
			["Maaş", "received", "plus", null],
			["Elektrik faturası", "paid", "minus", null],
		]);
	});
});

describe("eventsByDay", () => {
	it("groups by date and keeps money-moving items before notes", () => {
		const days = eventsByDay([
			...cardEvents([card()], "2026-10-09", "2026-10-09", TODAY),
			...transactionEvents([tx({ occurred_on: "2026-10-09" })]),
		]);
		expect(days["2026-10-09"]?.map((e) => e.status)).toEqual(["received", "info"]);
	});
});

describe("projection", () => {
	const events: FinanceEvent[] = [
		...agreementEvents(
			[
				due({ due_date: "2026-10-15" }),
				due({
					agreement_id: "a2",
					my_role: "creditor",
					due_date: "2026-10-25",
					due_minor: 450000,
				}),
				due({
					agreement_id: "a3",
					due_date: "2026-10-05",
					state: { status: "overdue", partial: false },
				}),
			],
			TODAY,
		),
		...cardEvents([card()], TODAY, "2026-11-11", TODAY),
		...recurringEvents(
			[
				rule({
					kind: "income",
					name: "Maaş",
					amount_minor: 3850000,
					category: "salary",
					start_on: "2026-01-01",
				}),
			],
			TODAY,
			"2026-11-11",
			TODAY,
		),
	];

	it("sums the next 30 days and walks the balance from today's cash", () => {
		const p = projection(events, TODAY, 2834000, 30);
		expect(p.out_minor).toBe(333333 + 1245000);
		expect(p.in_minor).toBe(450000 + 3850000);
		expect(p.points.map((pt) => [pt.date, pt.balance_minor])).toEqual([
			["2026-10-12", 2834000],
			["2026-10-15", 2500667],
			["2026-10-19", 1255667],
			["2026-10-25", 1705667],
			["2026-11-01", 5555667],
		]);
		expect(p.lowest).toEqual({ date: "2026-10-19", balance_minor: 1255667 });
		expect(p.risk).toBeNull();
	});

	it("warns when cash goes below zero, or would if expected money came late", () => {
		expect(projection(events, TODAY, 1000000, 30).risk).toBe("negative");
		const late = projection(
			[
				...agreementEvents(
					[
						due({
							agreement_id: "a2",
							my_role: "creditor",
							due_date: "2026-10-14",
							due_minor: 500000,
						}),
						due({ due_date: "2026-10-20", due_minor: 900000 }),
					],
					TODAY,
				),
			],
			TODAY,
			600000,
			30,
		);
		expect(late.lowest).toEqual({ date: "2026-10-20", balance_minor: 200000 });
		expect(late.risk).toBe("receivables");
	});
});

describe("barPoints", () => {
	it("keeps at most eight bars, always the first, last, lowest and highest", () => {
		const points = Array.from({ length: 12 }, (_, i) => ({
			date: `2026-10-${String(12 + i)}`,
			balance_minor: i === 5 ? -100 : i === 9 ? 9000 : 1000 + i,
		}));
		const bars = barPoints(points, 8);
		expect(bars).toHaveLength(8);
		expect(bars.map((b) => b.date)).toEqual(
			expect.arrayContaining(["2026-10-12", "2026-10-23", "2026-10-17", "2026-10-21"]),
		);
		expect(bars.find((b) => b.date === "2026-10-17")).toMatchObject({ low: true, percent: 4 });
		expect(bars.find((b) => b.date === "2026-10-21")).toMatchObject({
			high: true,
			percent: 100,
		});
		expect(bars[0]?.label).toBe("12 Eki");
		expect(bars[1]?.label).not.toContain("Eki");
	});
});

describe("untilLabel", () => {
	it("says how near a payment is", () => {
		expect(untilLabel("2026-10-14", TODAY)).toEqual({
			label: "Yaklaşıyor · 2 gün",
			tone: "warning",
		});
		expect(untilLabel("2026-10-12", TODAY)).toEqual({ label: "Bugün", tone: "warning" });
		expect(untilLabel("2026-10-19", TODAY)).toEqual({ label: "7 gün", tone: "neutral" });
		expect(untilLabel("2026-10-10", TODAY)).toEqual({ label: "Gecikti", tone: "overdue" });
	});
});
