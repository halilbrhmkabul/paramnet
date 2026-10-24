import type { SupabaseClient } from "@supabase/supabase-js";

import { toApiError } from "../supabase/toApiError";
import type {
	Account,
	AccountList,
	BudgetMonth,
	CashSummary,
	MonthlyReport,
	RecurringRule,
	Transaction,
	TransactionDetail,
	TransactionMonth,
} from "../types";
import type { AccountsApi } from "./AccountsApi";

// Shapes are guarded by the pgTAP tests (270_accounts, 280_transactions, 290_recurring, 300_budgets_reports).
export function createSupabaseAccountsApi(client: SupabaseClient): AccountsApi {
	async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
		const response: { data: unknown; error: unknown } = await client.rpc(fn, args);
		if (response.error !== null) {
			throw toApiError(response.error);
		}
		return response.data as T;
	}

	const account = async (fn: string, args: Record<string, unknown>) =>
		(await call<{ account: Account }>(fn, args)).account;
	const transaction = async (fn: string, args: Record<string, unknown>) =>
		(await call<{ transaction: Transaction }>(fn, args)).transaction;

	return {
		listAccounts: () => call<AccountList>("list_accounts"),
		createAccount: (input, idempotencyKey) =>
			account("create_account", { p_input: input, p_idempotency_key: idempotencyKey }),
		updateAccount: (id, input, rowVersion) =>
			account("update_account", { p_id: id, p_input: input, p_row_version: rowVersion }),
		archiveAccount: (id, rowVersion) =>
			account("archive_account", { p_id: id, p_row_version: rowVersion }),
		adjustBalance: (id, targetMinor, idempotencyKey) =>
			account("adjust_account_balance", {
				p_id: id,
				p_target_balance_minor: targetMinor,
				p_idempotency_key: idempotencyKey,
			}),
		createTransaction: (input, idempotencyKey) =>
			transaction("create_transaction", {
				p_input: input,
				p_idempotency_key: idempotencyKey,
			}),
		updateTransaction: (id, input, rowVersion) =>
			transaction("update_transaction", {
				p_id: id,
				p_input: input,
				p_row_version: rowVersion,
			}),
		deleteTransaction: (id, rowVersion) =>
			transaction("delete_transaction", { p_id: id, p_row_version: rowVersion }),
		restoreTransaction: (id, rowVersion) =>
			transaction("restore_transaction", { p_id: id, p_row_version: rowVersion }),
		getTransaction: (id) => call<TransactionDetail>("get_transaction", { p_id: id }),
		listTransactions: (month, accountId) =>
			call<TransactionMonth>("list_transactions", {
				p_month: month,
				p_account_id: accountId,
			}),
		getCashSummary: (month) => call<CashSummary>("get_cash_summary", { p_month: month }),

		listRecurring: async () => (await call<{ rules: RecurringRule[] }>("list_recurring")).rules,
		createRecurring: async (input, idempotencyKey) =>
			(
				await call<{ rule: RecurringRule }>("create_recurring", {
					p_input: input,
					p_idempotency_key: idempotencyKey,
				})
			).rule,
		updateRecurring: async (id, input, rowVersion) =>
			(
				await call<{ rule: RecurringRule }>("update_recurring", {
					p_id: id,
					p_input: input,
					p_row_version: rowVersion,
				})
			).rule,
		setRecurringPaused: async (id, paused, rowVersion) =>
			(
				await call<{ rule: RecurringRule }>("set_recurring_paused", {
					p_id: id,
					p_paused: paused,
					p_row_version: rowVersion,
				})
			).rule,
		deleteRecurring: async (id, rowVersion) => {
			await call("delete_recurring", { p_id: id, p_row_version: rowVersion });
		},
		confirmRecurring: (id, date, idempotencyKey) =>
			transaction("confirm_recurring", {
				p_rule_id: id,
				p_occurrence_on: date,
				p_idempotency_key: idempotencyKey,
			}),
		skipRecurring: async (id, date) => {
			await call("skip_recurring", { p_rule_id: id, p_occurrence_on: date });
		},
		listBudgets: (month) => call<BudgetMonth>("list_budgets", { p_month: month }),
		setBudget: async (category, limitMinor) => {
			await call("set_budget", { p_category: category, p_limit_minor: limitMinor });
		},
		getMonthlyReport: (month) => call<MonthlyReport>("get_monthly_report", { p_month: month }),
	};
}
