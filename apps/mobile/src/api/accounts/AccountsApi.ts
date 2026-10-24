import type { AccountInput, IsoDate, TransactionInput } from "@paramnet/shared";

import type {
	Account,
	AccountList,
	CashSummary,
	Transaction,
	TransactionDetail,
	TransactionMonth,
} from "../types";

// Own accounts and cash records (F4-03, ADR-053). Manual records only; nothing here moves money.
// Mock and Supabase adapters both implement it (EXPO_PUBLIC_API_MODE).
export interface AccountsApi {
	listAccounts(): Promise<AccountList>;
	createAccount(input: AccountInput, idempotencyKey: string): Promise<Account>;
	updateAccount(id: string, input: AccountInput, rowVersion: number): Promise<Account>;
	archiveAccount(id: string, rowVersion: number): Promise<Account>;
	// "Bakiye düzelt": the real balance; the server records the difference.
	adjustBalance(id: string, targetMinor: number, idempotencyKey: string): Promise<Account>;
	createTransaction(input: TransactionInput, idempotencyKey: string): Promise<Transaction>;
	updateTransaction(
		id: string,
		input: TransactionInput,
		rowVersion: number,
	): Promise<Transaction>;
	deleteTransaction(id: string, rowVersion: number): Promise<Transaction>;
	restoreTransaction(id: string, rowVersion: number): Promise<Transaction>;
	getTransaction(id: string): Promise<TransactionDetail>;
	// month: the first day; accountId narrows to one account.
	listTransactions(month: IsoDate, accountId: string | null): Promise<TransactionMonth>;
	getCashSummary(month: IsoDate): Promise<CashSummary>;
}
