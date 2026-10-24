import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountInput, TransactionInput } from "@paramnet/shared";

import type { AccountsApi } from "../accounts/AccountsApi";
import { createSupabaseAccountsApi } from "../accounts/supabaseAccounts";
import { ApiError, messageForError } from "../errors";
import { tr } from "@/i18n/tr";
import { createTestAccountsApi } from "@/testing/providers";

const MONTH = "2026-10-01";

const bank: AccountInput = {
	kind: "bank",
	name: "Akbank Vadesiz",
	bank_name: "Akbank",
	opening_balance_minor: 125000,
	include_in_total: true,
};

function expense(accountId: string, amount = 35000): TransactionInput {
	return {
		kind: "expense",
		account_id: accountId,
		to_account_id: null,
		amount_minor: amount,
		category: "food",
		title: null,
		note: null,
		occurred_on: "2026-10-11",
	};
}

async function code(promise: Promise<unknown>): Promise<string | undefined> {
	try {
		await promise;
		return undefined;
	} catch (error) {
		return error instanceof ApiError ? `${error.code}:${error.details?.field ?? ""}` : "other";
	}
}

describe("mock AccountsApi", () => {
	let api: AccountsApi;
	beforeEach(() => {
		api = createTestAccountsApi({ seed: "empty" });
	});

	it("derives balances, Toplam Nakit and the month like the server", async () => {
		const a = await api.createAccount(bank, "k1");
		const b = await api.createAccount(
			{ ...bank, kind: "cash", name: "Kasa", bank_name: null, opening_balance_minor: 0 },
			"k2",
		);
		await api.createTransaction(expense(a.id), "t1");
		await api.createTransaction(
			{ ...expense(a.id, 20000), kind: "transfer", to_account_id: b.id, category: null },
			"t2",
		);
		await api.createTransaction(
			{ ...expense(b.id, 100000), kind: "income", category: "salary" },
			"t3",
		);
		const list = await api.listAccounts();
		expect(list.accounts.map((x) => x.balance_minor)).toEqual([70000, 120000]);
		expect(list.total_cash_minor).toBe(190000);
		const month = await api.listTransactions(MONTH, null);
		expect(month.items).toHaveLength(3);
		expect(month.income_minor).toBe(100000);
		expect(month.expense_minor).toBe(35000);
		expect((await api.listTransactions(MONTH, b.id)).items).toHaveLength(2);
		const summary = await api.getCashSummary(MONTH);
		expect(summary).toMatchObject({
			total_cash_minor: 190000,
			account_count: 2,
			income_minor: 100000,
			expense_minor: 35000,
		});
	});

	it("replays by idempotency key", async () => {
		const first = await api.createAccount(bank, "same");
		const again = await api.createAccount(bank, "same");
		expect(again.id).toBe(first.id);
		const tx = await api.createTransaction(expense(first.id), "tx");
		expect((await api.createTransaction(expense(first.id), "tx")).id).toBe(tx.id);
		expect((await api.listTransactions(MONTH, null)).items).toHaveLength(1);
	});

	it("adjusts to the typed balance and refuses no change", async () => {
		const a = await api.createAccount(bank, "k1");
		expect((await api.adjustBalance(a.id, 200000, "adj")).balance_minor).toBe(200000);
		const items = (await api.listTransactions(MONTH, null)).items;
		expect(items[0]).toMatchObject({ kind: "adjustment", amount_minor: 75000 });
		expect(await code(api.adjustBalance(a.id, 200000, "adj2"))).toBe(
			"validation_error:no_change",
		);
	});

	it("keeps an edit history, deletes softly and restores", async () => {
		const a = await api.createAccount(bank, "k1");
		const tx = await api.createTransaction(expense(a.id), "t1");
		const edited = await api.updateTransaction(
			tx.id,
			{ ...expense(a.id), category: "groceries", title: "Migros" },
			1,
		);
		expect(edited.row_version).toBe(2);
		expect(await code(api.updateTransaction(tx.id, expense(a.id), 1))).toBe("conflict:");
		const detail = await api.getTransaction(tx.id);
		expect(detail.events.map((e) => e.type)).toEqual(["created", "updated"]);
		expect(detail.events[1]?.changes).toEqual({
			category: ["food", "groceries"],
			title: [null, "Migros"],
		});
		const deleted = await api.deleteTransaction(tx.id, 2);
		expect(deleted.deleted_at).not.toBeNull();
		expect((await api.listAccounts()).accounts[0]?.balance_minor).toBe(125000);
		expect(await code(api.deleteTransaction(tx.id, 3))).toBe("invalid_transition:");
		await api.restoreTransaction(tx.id, 3);
		expect((await api.listAccounts()).accounts[0]?.balance_minor).toBe(90000);
	});

	it("archives: the account leaves the list and takes no new records", async () => {
		const a = await api.createAccount(bank, "k1");
		await api.archiveAccount(a.id, 1);
		expect((await api.listAccounts()).accounts).toHaveLength(0);
		expect(await code(api.createTransaction(expense(a.id), "t1"))).toBe(
			"validation_error:account_archived",
		);
		expect(await code(api.archiveAccount(a.id, 2))).toBe("invalid_transition:");
	});

	it("refuses what the schema refuses", async () => {
		expect(await code(api.createAccount({ ...bank, name: "" }, "k"))).toBe(
			"validation_error:name",
		);
		const a = await api.createAccount(bank, "k1");
		expect(
			await code(api.createTransaction({ ...expense(a.id), category: "salary" }, "t")),
		).toBe("validation_error:category");
		expect(await code(api.getTransaction("missing"))).toBe("not_found:");
	});

	it("starts with the demo accounts by default", async () => {
		const demo = createTestAccountsApi();
		const list = await demo.listAccounts();
		expect(list.accounts.map((a) => a.name)).toEqual([
			"Maaş Hesabı",
			"Nakit Cüzdan",
			"Birikim Hesabı",
		]);
		expect(list.total_cash_minor).toBe(6725770);
	});
});

describe("Supabase AccountsApi", () => {
	function fakeClient(data: unknown = {}) {
		const calls: { fn: string; args: unknown }[] = [];
		const client = {
			rpc: (fn: string, args?: unknown) => {
				calls.push({ fn, args });
				return Promise.resolve({ data, error: null });
			},
		};
		return { api: createSupabaseAccountsApi(client as unknown as SupabaseClient), calls };
	}

	it.each([
		["listAccounts", (api: AccountsApi) => api.listAccounts(), "list_accounts", undefined],
		[
			"createAccount",
			(api: AccountsApi) => api.createAccount(bank, "key"),
			"create_account",
			{ p_input: bank, p_idempotency_key: "key" },
		],
		[
			"updateAccount",
			(api: AccountsApi) => api.updateAccount("a", bank, 2),
			"update_account",
			{ p_id: "a", p_input: bank, p_row_version: 2 },
		],
		[
			"archiveAccount",
			(api: AccountsApi) => api.archiveAccount("a", 2),
			"archive_account",
			{ p_id: "a", p_row_version: 2 },
		],
		[
			"adjustBalance",
			(api: AccountsApi) => api.adjustBalance("a", -500, "key"),
			"adjust_account_balance",
			{ p_id: "a", p_target_balance_minor: -500, p_idempotency_key: "key" },
		],
		[
			"createTransaction",
			(api: AccountsApi) => api.createTransaction(expense("a"), "key"),
			"create_transaction",
			{ p_input: expense("a"), p_idempotency_key: "key" },
		],
		[
			"updateTransaction",
			(api: AccountsApi) => api.updateTransaction("t", expense("a"), 3),
			"update_transaction",
			{ p_id: "t", p_input: expense("a"), p_row_version: 3 },
		],
		[
			"deleteTransaction",
			(api: AccountsApi) => api.deleteTransaction("t", 3),
			"delete_transaction",
			{ p_id: "t", p_row_version: 3 },
		],
		[
			"restoreTransaction",
			(api: AccountsApi) => api.restoreTransaction("t", 4),
			"restore_transaction",
			{ p_id: "t", p_row_version: 4 },
		],
		[
			"getTransaction",
			(api: AccountsApi) => api.getTransaction("t"),
			"get_transaction",
			{ p_id: "t" },
		],
		[
			"listTransactions",
			(api: AccountsApi) => api.listTransactions(MONTH, null),
			"list_transactions",
			{ p_month: MONTH, p_account_id: null },
		],
		[
			"getCashSummary",
			(api: AccountsApi) => api.getCashSummary(MONTH),
			"get_cash_summary",
			{ p_month: MONTH },
		],
	])("%s calls %s", async (_name, run, fn, args) => {
		const { api, calls } = fakeClient({ account: {}, transaction: {} });
		await run(api);
		expect(calls).toEqual([{ fn, args }]);
	});

	it("unwraps the account and transaction", async () => {
		const { api } = fakeClient({ account: { id: "a" }, transaction: { id: "t" } });
		expect(await api.createAccount(bank, "k")).toEqual({ id: "a" });
		expect(await api.deleteTransaction("t", 1)).toEqual({ id: "t" });
	});

	it("names archived, unchanged and full refusals", () => {
		const message = (field: string) =>
			messageForError(new ApiError("validation_error", { field }));
		expect(message("account_archived")).toBe(tr.error.accountArchived);
		expect(message("no_change")).toBe(tr.error.noChange);
		expect(message("too_many_accounts")).toBe(tr.error.tooManyAccounts);
		expect(message("name")).toBe(tr.error.validation);
	});
});

describe("mock AccountsApi · F4-04", () => {
	const gym = (accountId: string, confirm: boolean) => ({
		kind: "expense" as const,
		name: "Spor salonu",
		amount_minor: 120000,
		category: "health" as const,
		account_id: accountId,
		frequency: "monthly" as const,
		start_on: "2026-10-05",
		confirm_each: confirm,
	});

	it("lists planned dates, confirms and skips them", async () => {
		const api = createTestAccountsApi({ seed: "empty" });
		const a = await api.createAccount(bank, "k1");
		const rule = await api.createRecurring(gym(a.id, true), "r1");
		expect(rule.pending_dates).toEqual(["2026-10-05"]);
		expect(rule.next_dates).toEqual(["2026-11-05", "2026-12-05", "2027-01-05"]);
		const tx = await api.confirmRecurring(rule.id, "2026-10-05", "c1");
		expect(tx).toMatchObject({
			kind: "expense",
			title: "Spor salonu",
			occurred_on: "2026-10-05",
		});
		expect(await code(api.confirmRecurring(rule.id, "2026-10-05", "c2"))).toBe(
			"invalid_transition:",
		);
		expect((await api.listRecurring())[0]?.pending_dates).toEqual([]);
	});

	it("records rules that do not ask, once", async () => {
		const api = createTestAccountsApi({ seed: "empty" });
		const a = await api.createAccount(bank, "k1");
		await api.createRecurring(gym(a.id, false), "r1");
		await api.listRecurring();
		await api.listRecurring();
		expect((await api.listTransactions(MONTH, null)).items).toHaveLength(1);
	});

	it("sums budgets and builds the report", async () => {
		const api = createTestAccountsApi({ seed: "empty" });
		const a = await api.createAccount(bank, "k1");
		await api.createTransaction({ ...expense(a.id, 90000), category: "groceries" }, "t1");
		await api.setBudget("groceries", 100000);
		const budgets = await api.listBudgets(MONTH);
		expect(budgets.items).toEqual([
			{ category: "groceries", limit_minor: 100000, spent_minor: 90000, count: 1 },
		]);
		await api.setBudget("groceries", null);
		expect((await api.listBudgets(MONTH)).items).toEqual([]);
		const report = await api.getMonthlyReport(MONTH);
		expect(report.expense_minor).toBe(90000);
		expect(report.by_category).toEqual([{ category: "groceries", amount_minor: 90000 }]);
		expect(report.series.map((m) => m.month)).toEqual([
			"2026-05-01",
			"2026-06-01",
			"2026-07-01",
			"2026-08-01",
			"2026-09-01",
			"2026-10-01",
		]);
	});
});
