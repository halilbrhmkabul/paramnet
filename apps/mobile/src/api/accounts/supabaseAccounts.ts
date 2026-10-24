import type { SupabaseClient } from "@supabase/supabase-js";

import { toApiError } from "../supabase/toApiError";
import type {
	Account,
	AccountList,
	CashSummary,
	Transaction,
	TransactionDetail,
	TransactionMonth,
} from "../types";
import type { AccountsApi } from "./AccountsApi";

// Shapes are guarded by the pgTAP tests (270_accounts, 280_transactions).
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
	};
}
