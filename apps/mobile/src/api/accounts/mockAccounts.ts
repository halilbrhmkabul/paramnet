import {
	EXPENSE_CATEGORIES,
	MAX_ACCOUNTS,
	accountInputSchema,
	addDays,
	adjustmentDelta,
	deriveCash,
	monthOf,
	todayInIstanbul,
	nextOccurrences,
	occurrencesBetween,
	recurringInputSchema,
	shiftMonth,
	transactionInputSchema,
	type AccountInput,
	type RecurringInput,
	type TransactionCategory,
	type IsoDate,
	type TransactionInput,
} from "@paramnet/shared";

import { ApiError } from "../errors";
import type {
	Account,
	RecurringRule,
	Transaction,
	TransactionChange,
	TransactionEvent,
} from "../types";
import type { AccountsApi } from "./AccountsApi";
import { newIdempotencyKey } from "@/lib/ids";

export type MockAccountsOptions = {
	now?: () => Date;
	latencyMs?: number;
	seed?: "demo" | "empty";
	newId?: () => string;
};

type StoredAccount = Omit<Account, "balance_minor"> & { key: string | null };
type StoredTransaction = Omit<Transaction, "account_name" | "to_account_name"> & { key: string };
type StoredRule = Omit<RecurringRule, "account_name" | "next_dates" | "pending_dates"> & {
	key: string;
	tracking_from: IsoDate;
	// Handled dates: the record written for it, or null when skipped.
	handled: Map<IsoDate, string | null>;
};

const EDITABLE = [
	"kind",
	"account_id",
	"to_account_id",
	"amount_minor",
	"category",
	"title",
	"note",
	"occurred_on",
] as const;

// Same rules as the RPCs (270_accounts, 280_transactions): the screens see the same refusals in both modes.
export function createMockAccountsApi(options: MockAccountsOptions = {}): AccountsApi {
	const now = options.now ?? (() => new Date());
	const latencyMs = options.latencyMs ?? 150;
	const newId = options.newId ?? newIdempotencyKey;
	const accounts: StoredAccount[] = [];
	const transactions: StoredTransaction[] = [];
	const events = new Map<string, TransactionEvent[]>();

	const rules: StoredRule[] = [];
	const budgets = new Map<TransactionCategory, number>();
	const stamp = () => now().toISOString();
	const today = () => todayInIstanbul(now());

	function addAccount(
		fields: Pick<
			StoredAccount,
			"kind" | "name" | "bank_name" | "opening_balance_minor" | "include_in_total"
		>,
		key: string | null,
	): StoredAccount {
		const account: StoredAccount = {
			id: newId(),
			...fields,
			archived_at: null,
			row_version: 1,
			created_at: stamp(),
			key,
		};
		accounts.push(account);
		return account;
	}

	function addTransaction(
		fields: Omit<
			StoredTransaction,
			"id" | "deleted_at" | "row_version" | "created_at" | "updated_at" | "key"
		>,
		key: string,
	): StoredTransaction {
		const tx: StoredTransaction = {
			id: newId(),
			...fields,
			deleted_at: null,
			row_version: 1,
			created_at: stamp(),
			updated_at: stamp(),
			key,
		};
		transactions.push(tx);
		events.set(tx.id, [{ type: "created", changes: {}, created_at: stamp() }]);
		return tx;
	}

	if (options.seed !== "empty") {
		const day = (offset: number) => addDays(monthOf(today()), offset);
		const salary = addAccount(
			{
				kind: "bank",
				name: "Maaş Hesabı",
				bank_name: "İş Bankası",
				opening_balance_minor: 1250000,
				include_in_total: true,
			},
			null,
		);
		const cash = addAccount(
			{
				kind: "cash",
				name: "Nakit Cüzdan",
				bank_name: null,
				opening_balance_minor: 260000,
				include_in_total: true,
			},
			null,
		);
		addAccount(
			{
				kind: "savings",
				name: "Birikim Hesabı",
				bank_name: "İş Bankası",
				opening_balance_minor: 650000,
				include_in_total: true,
			},
			null,
		);
		const record = (
			kind: Transaction["kind"],
			amount: number,
			category: Transaction["category"],
			title: string | null,
			on: IsoDate,
			to: string | null = null,
		) =>
			addTransaction(
				{
					kind,
					account_id: salary.id,
					to_account_id: to,
					amount_minor: amount,
					category,
					title,
					note: null,
					occurred_on: on,
				},
				`seed-${title ?? kind}`,
			);
		record("income", 3850000, "salary", "Maaş", day(0));
		record("transfer", 200000, null, null, day(4), cash.id);
		record("expense", 84230, "bills", "Elektrik faturası", day(7));
		record("income", 800000, "freelance", "Freelance proje geliri", day(9));
		const rent: StoredRule = {
			id: newId(),
			kind: "expense",
			name: "Kira",
			amount_minor: 1500000,
			category: "rent",
			account_id: salary.id,
			frequency: "monthly",
			start_on: day(2),
			confirm_each: true,
			paused_at: null,
			row_version: 1,
			created_at: stamp(),
			key: "seed-rent",
			tracking_from: day(0),
			handled: new Map(),
		};
		const wage: StoredRule = {
			...rent,
			id: newId(),
			kind: "income",
			name: "Maaş",
			amount_minor: 3850000,
			category: "salary",
			start_on: day(0),
			key: "seed-salary",
			handled: new Map([[day(0), transactions[0]?.id ?? null]]),
		};
		rules.push(wage, rent);
		budgets.set("groceries", 800000);
		budgets.set("food", 450000);
		budgets.set("bills", 300000);
	}

	function wait<T>(value: () => T): Promise<T> {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				try {
					resolve(value());
				} catch (error) {
					reject(error instanceof Error ? error : new Error(String(error)));
				}
			}, latencyMs);
		});
	}

	function cash() {
		return deriveCash(
			accounts.map((a) => ({
				id: a.id,
				opening_balance_minor: a.opening_balance_minor,
				include_in_total: a.include_in_total,
				archived: a.archived_at !== null,
			})),
			transactions.map((t) => ({ ...t, deleted: t.deleted_at !== null })),
			monthOf(today()),
		);
	}

	function view(account: StoredAccount): Account {
		const { key: _key, ...rest } = account;
		return { ...rest, balance_minor: cash().balances[account.id] ?? 0 };
	}

	function txView(tx: StoredTransaction): Transaction {
		const { key: _key, ...rest } = tx;
		return {
			...rest,
			account_name: accounts.find((a) => a.id === tx.account_id)?.name ?? "",
			to_account_name:
				tx.to_account_id === null
					? null
					: (accounts.find((a) => a.id === tx.to_account_id)?.name ?? null),
		};
	}

	function invalid(field: string): ApiError {
		return new ApiError("validation_error", { field });
	}

	function parseAccount(input: AccountInput): AccountInput {
		const parsed = accountInputSchema.safeParse(input);
		if (!parsed.success) {
			throw invalid(String(parsed.error.issues[0]?.path[0] ?? "input"));
		}
		return parsed.data;
	}

	function ownAccount(id: string): StoredAccount {
		const account = accounts.find((a) => a.id === id);
		if (account === undefined) {
			throw new ApiError("not_found");
		}
		return account;
	}

	function ownTransaction(id: string): StoredTransaction {
		const tx = transactions.find((t) => t.id === id);
		if (tx === undefined) {
			throw new ApiError("not_found");
		}
		return tx;
	}

	function parseTransaction(
		input: TransactionInput,
		old: StoredTransaction | null,
	): TransactionInput {
		const parsed = transactionInputSchema.safeParse(input);
		if (!parsed.success) {
			throw invalid(String(parsed.error.issues[0]?.path[0] ?? "input"));
		}
		const value = parsed.data;
		if (value.occurred_on < "2000-01-01" || value.occurred_on > addDays(today(), 366)) {
			throw invalid("occurred_on");
		}
		for (const id of [value.account_id, value.to_account_id]) {
			if (id === null) {
				continue;
			}
			const unchanged = old !== null && (id === old.account_id || id === old.to_account_id);
			if (ownAccount(id).archived_at !== null && !unchanged) {
				throw invalid("account_archived");
			}
		}
		return value;
	}

	function writable(account: StoredAccount, rowVersion: number): void {
		if (account.archived_at !== null) {
			throw new ApiError("invalid_transition");
		}
		if (account.row_version !== rowVersion) {
			throw new ApiError("conflict");
		}
	}

	function setDeleted(id: string, rowVersion: number, deleted: boolean): Transaction {
		const tx = ownTransaction(id);
		if ((tx.deleted_at === null) !== deleted) {
			throw new ApiError("invalid_transition");
		}
		if (tx.row_version !== rowVersion) {
			throw new ApiError("conflict");
		}
		tx.deleted_at = deleted ? stamp() : null;
		tx.row_version += 1;
		tx.updated_at = stamp();
		events
			.get(tx.id)
			?.push({ type: deleted ? "deleted" : "restored", changes: {}, created_at: stamp() });
		return txView(tx);
	}

	function inMonth(month: IsoDate, accountId: string | null): StoredTransaction[] {
		return transactions
			.filter(
				(t) =>
					t.deleted_at === null &&
					monthOf(t.occurred_on) === month &&
					(accountId === null ||
						t.account_id === accountId ||
						t.to_account_id === accountId),
			)
			.sort((a, b) =>
				a.occurred_on === b.occurred_on
					? b.created_at.localeCompare(a.created_at)
					: b.occurred_on.localeCompare(a.occurred_on),
			);
	}

	const sumOf = (items: StoredTransaction[], kind: Transaction["kind"]) =>
		items.filter((t) => t.kind === kind).reduce((sum, t) => sum + t.amount_minor, 0);

	function requireMonth(month: IsoDate): void {
		if (monthOf(month) !== month) {
			throw invalid("month");
		}
	}

	function dueDates(rule: StoredRule, until: IsoDate): IsoDate[] {
		if (rule.paused_at !== null) {
			return [];
		}
		const from = rule.start_on > rule.tracking_from ? rule.start_on : rule.tracking_from;
		return occurrencesBetween(rule.start_on, rule.frequency, from, until).filter(
			(date) => !rule.handled.has(date),
		);
	}

	// Stands in for the server's hourly job (post_due_recurring).
	function postDue(): void {
		for (const rule of rules) {
			if (rule.confirm_each || ownAccount(rule.account_id).archived_at !== null) {
				continue;
			}
			for (const date of dueDates(rule, today())) {
				post(rule, date, newId());
			}
		}
	}

	function post(rule: StoredRule, date: IsoDate, key: string): StoredTransaction {
		const tx = addTransaction(
			{
				kind: rule.kind,
				account_id: rule.account_id,
				to_account_id: null,
				amount_minor: rule.amount_minor,
				category: rule.category,
				title: rule.name,
				note: null,
				occurred_on: date,
			},
			key,
		);
		rule.handled.set(date, tx.id);
		return tx;
	}

	function ruleView(rule: StoredRule): RecurringRule {
		const { key: _key, tracking_from: _from, handled: _handled, ...rest } = rule;
		return {
			...rest,
			account_name: ownAccount(rule.account_id).name,
			next_dates: nextOccurrences(rule.start_on, rule.frequency, addDays(today(), 1), 3),
			pending_dates: rule.confirm_each ? dueDates(rule, today()) : [],
		};
	}

	function ownRule(id: string, rowVersion: number | null): StoredRule {
		const rule = rules.find((r) => r.id === id);
		if (rule === undefined) {
			throw new ApiError("not_found");
		}
		if (rowVersion !== null && rule.row_version !== rowVersion) {
			throw new ApiError("conflict");
		}
		return rule;
	}

	function parseRule(input: RecurringInput): RecurringInput {
		const parsed = recurringInputSchema.safeParse(input);
		if (!parsed.success) {
			throw invalid(String(parsed.error.issues[0]?.path[0] ?? "input"));
		}
		if (ownAccount(parsed.data.account_id).archived_at !== null) {
			throw invalid("account_archived");
		}
		return parsed.data;
	}

	function dueDate(rule: StoredRule, date: IsoDate): void {
		if (!dueDates(rule, today()).includes(date)) {
			throw new ApiError("invalid_transition");
		}
	}

	const expenseIn = (month: IsoDate) =>
		transactions.filter(
			(t) =>
				t.deleted_at === null && t.kind === "expense" && monthOf(t.occurred_on) === month,
		);

	return {
		listAccounts: () =>
			wait(() => {
				const open = accounts.filter((a) => a.archived_at === null).map(view);
				return {
					accounts: open,
					total_cash_minor: cash().total_cash_minor,
					included_count: open.filter((a) => a.include_in_total).length,
				};
			}),

		createAccount: (input, key) =>
			wait(() => {
				const replay = accounts.find((a) => a.key === key);
				if (replay !== undefined) {
					return view(replay);
				}
				const value = parseAccount(input);
				if (accounts.filter((a) => a.archived_at === null).length >= MAX_ACCOUNTS) {
					throw invalid("too_many_accounts");
				}
				return view(addAccount(value, key));
			}),

		updateAccount: (id, input, rowVersion) =>
			wait(() => {
				const value = parseAccount(input);
				const account = ownAccount(id);
				writable(account, rowVersion);
				Object.assign(account, value, { row_version: account.row_version + 1 });
				return view(account);
			}),

		archiveAccount: (id, rowVersion) =>
			wait(() => {
				const account = ownAccount(id);
				writable(account, rowVersion);
				account.archived_at = stamp();
				account.row_version += 1;
				return view(account);
			}),

		adjustBalance: (id, targetMinor, key) =>
			wait(() => {
				const replay = transactions.find((t) => t.key === key);
				if (replay !== undefined) {
					return view(ownAccount(replay.account_id));
				}
				const account = ownAccount(id);
				if (account.archived_at !== null) {
					throw invalid("account_archived");
				}
				const delta = adjustmentDelta(cash().balances[id] ?? 0, targetMinor);
				if (delta === 0) {
					throw invalid("no_change");
				}
				addTransaction(
					{
						kind: "adjustment",
						account_id: id,
						to_account_id: null,
						amount_minor: delta,
						category: null,
						title: null,
						note: null,
						occurred_on: today(),
					},
					key,
				);
				return view(account);
			}),

		createTransaction: (input, key) =>
			wait(() => {
				const replay = transactions.find((t) => t.key === key);
				if (replay !== undefined) {
					return txView(replay);
				}
				return txView(addTransaction(parseTransaction(input, null), key));
			}),

		updateTransaction: (id, input, rowVersion) =>
			wait(() => {
				const tx = ownTransaction(id);
				if (tx.deleted_at !== null || tx.kind === "adjustment") {
					throw new ApiError("invalid_transition");
				}
				if (tx.row_version !== rowVersion) {
					throw new ApiError("conflict");
				}
				const value = parseTransaction(input, tx);
				const changes: Record<string, TransactionChange> = {};
				for (const field of EDITABLE) {
					if (tx[field] !== value[field]) {
						changes[field] = [tx[field], value[field]];
					}
				}
				if (Object.keys(changes).length === 0) {
					return txView(tx);
				}
				Object.assign(tx, value, { row_version: tx.row_version + 1, updated_at: stamp() });
				events.get(tx.id)?.push({ type: "updated", changes, created_at: stamp() });
				return txView(tx);
			}),

		deleteTransaction: (id, rowVersion) => wait(() => setDeleted(id, rowVersion, true)),
		restoreTransaction: (id, rowVersion) => wait(() => setDeleted(id, rowVersion, false)),

		getTransaction: (id) =>
			wait(() => {
				const tx = ownTransaction(id);
				return { transaction: txView(tx), events: [...(events.get(tx.id) ?? [])] };
			}),

		listTransactions: (month, accountId) =>
			wait(() => {
				requireMonth(month);
				const items = inMonth(month, accountId);
				return {
					items: items.map(txView),
					income_minor: sumOf(items, "income"),
					expense_minor: sumOf(items, "expense"),
				};
			}),

		getCashSummary: (month) =>
			wait(() => {
				requireMonth(month);
				const items = inMonth(month, null);
				const open = accounts.filter((a) => a.archived_at === null);
				const latest = [
					...transactions.map((t) => t.updated_at),
					...accounts.map((a) => a.created_at),
				]
					.sort()
					.at(-1);
				return {
					total_cash_minor: cash().total_cash_minor,
					account_count: open.filter((a) => a.include_in_total).length,
					income_minor: sumOf(items, "income"),
					expense_minor: sumOf(items, "expense"),
					updated_at: latest ?? null,
				};
			}),

		listRecurring: () =>
			wait(() => {
				postDue();
				return rules.map(ruleView);
			}),

		createRecurring: (input, key) =>
			wait(() => {
				const replay = rules.find((r) => r.key === key);
				if (replay !== undefined) {
					return ruleView(replay);
				}
				const value = parseRule(input);
				const back = addDays(today(), -31);
				const start = value.start_on < today() ? value.start_on : today();
				const rule: StoredRule = {
					id: newId(),
					...value,
					paused_at: null,
					row_version: 1,
					created_at: stamp(),
					key,
					tracking_from: start > back ? start : back,
					handled: new Map(),
				};
				rules.push(rule);
				return ruleView(rule);
			}),

		updateRecurring: (id, input, rowVersion) =>
			wait(() => {
				const value = parseRule(input);
				const rule = ownRule(id, rowVersion);
				Object.assign(rule, value, { row_version: rule.row_version + 1 });
				return ruleView(rule);
			}),

		setRecurringPaused: (id, paused, rowVersion) =>
			wait(() => {
				const rule = ownRule(id, rowVersion);
				if ((rule.paused_at !== null) === paused) {
					throw new ApiError("invalid_transition");
				}
				rule.paused_at = paused ? stamp() : null;
				if (!paused) {
					rule.tracking_from = today();
				}
				rule.row_version += 1;
				return ruleView(rule);
			}),

		deleteRecurring: (id, rowVersion) =>
			wait(() => {
				const rule = ownRule(id, rowVersion);
				rules.splice(rules.indexOf(rule), 1);
			}),

		confirmRecurring: (id, date, key) =>
			wait(() => {
				const replay = transactions.find((t) => t.key === key);
				if (replay !== undefined) {
					return txView(replay);
				}
				const rule = ownRule(id, null);
				dueDate(rule, date);
				if (ownAccount(rule.account_id).archived_at !== null) {
					throw invalid("account_archived");
				}
				return txView(post(rule, date, key));
			}),

		skipRecurring: (id, date) =>
			wait(() => {
				const rule = ownRule(id, null);
				dueDate(rule, date);
				rule.handled.set(date, null);
			}),

		listBudgets: (month) =>
			wait(() => {
				requireMonth(month);
				const spent = expenseIn(month);
				const items = [...budgets.entries()].map(([category, limit]) => {
					const own = spent.filter((t) => t.category === category);
					return {
						category,
						limit_minor: limit,
						spent_minor: own.reduce((sum, t) => sum + t.amount_minor, 0),
						count: own.length,
					};
				});
				return {
					items,
					total_limit_minor: items.reduce((sum, i) => sum + i.limit_minor, 0),
					total_spent_minor: items.reduce((sum, i) => sum + i.spent_minor, 0),
					month_expense_minor: spent.reduce((sum, t) => sum + t.amount_minor, 0),
				};
			}),

		setBudget: (category, limitMinor) =>
			wait(() => {
				if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) {
					throw invalid("category");
				}
				if (limitMinor === null || limitMinor === 0) {
					budgets.delete(category);
					return;
				}
				if (!Number.isSafeInteger(limitMinor) || limitMinor < 0) {
					throw invalid("amount");
				}
				budgets.set(category, limitMinor);
			}),

		getMonthlyReport: (month) =>
			wait(() => {
				requireMonth(month);
				const sumKind = (m: IsoDate, kind: Transaction["kind"]) =>
					transactions
						.filter(
							(t) =>
								t.deleted_at === null &&
								t.kind === kind &&
								monthOf(t.occurred_on) === m,
						)
						.reduce((sum, t) => sum + t.amount_minor, 0);
				const byCategory = new Map<TransactionCategory, number>();
				for (const t of expenseIn(month)) {
					if (t.category !== null) {
						byCategory.set(
							t.category,
							(byCategory.get(t.category) ?? 0) + t.amount_minor,
						);
					}
				}
				return {
					month,
					income_minor: sumKind(month, "income"),
					expense_minor: sumKind(month, "expense"),
					by_category: [...byCategory.entries()]
						.map(([category, amount_minor]) => ({ category, amount_minor }))
						.sort(
							(a, b) =>
								b.amount_minor - a.amount_minor ||
								a.category.localeCompare(b.category),
						),
					series: [5, 4, 3, 2, 1, 0].map((back) => {
						const m = shiftMonth(month, -back);
						return {
							month: m,
							income_minor: sumKind(m, "income"),
							expense_minor: sumKind(m, "expense"),
						};
					}),
				};
			}),
	};
}
