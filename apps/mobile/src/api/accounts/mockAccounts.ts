import {
	MAX_ACCOUNTS,
	accountInputSchema,
	addDays,
	adjustmentDelta,
	deriveCash,
	monthOf,
	todayInIstanbul,
	transactionInputSchema,
	type AccountInput,
	type IsoDate,
	type TransactionInput,
} from "@paramnet/shared";

import { ApiError } from "../errors";
import type { Account, Transaction, TransactionChange, TransactionEvent } from "../types";
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
	};
}
