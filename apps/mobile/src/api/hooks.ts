import type {
	AccountInput,
	CardInput,
	CreateAgreementInput,
	LoanInput,
	IsoDate,
	PaymentInput,
	RecurringInput,
	TransactionCategory,
	TransactionInput,
} from "@paramnet/shared";

import type {
	AnalyticsEvent,
	Decision,
	InboxPage,
	MyProfile,
	NotificationCategory,
	PendingDecision,
	ProfileInput,
	ReminderDay,
	TermsView,
} from "./types";
import {
	infiniteQueryOptions,
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";

import { useAccountsApi, useApi, useProfileApi } from "./ApiProvider";
import type { ProfileApi } from "./profile/ProfileApi";

export const queryKeys = {
	dashboard: ["dashboard"] as const,
	contacts: ["contacts"] as const,
	contact: (id: string) => ["contact", id] as const,
	agreement: (id: string) => ["agreement", id] as const,
	agreements: ["agreements"] as const,
	calendar: (month: IsoDate) => ["calendar", month] as const,
	invite: (token: string) => ["invite", token] as const,
	decision: (id: string) => ["decision", id] as const,
	requests: ["requests"] as const,
	profile: ["profile"] as const,
	avatar: (path: string) => ["avatar", path] as const,
	username: (name: string) => ["username", name] as const,
	paramnetId: (id: string) => ["paramnetId", id] as const,
	inbox: (category: NotificationCategory | null) => ["inbox", category ?? "all"] as const,
	// Every cash read shares the "cash" prefix: one write refreshes balances, lists and the home card.
	cash: ["cash"] as const,
	accounts: ["cash", "accounts"] as const,
	cashSummary: (month: IsoDate) => ["cash", "summary", month] as const,
	transactions: (month: IsoDate, accountId: string | null) =>
		["cash", "transactions", month, accountId ?? "all"] as const,
	transaction: (id: string) => ["cash", "transaction", id] as const,
	recurring: ["cash", "recurring"] as const,
	delivery: (id: string) => ["delivery", id] as const,
	budgets: (month: IsoDate) => ["cash", "budgets", month] as const,
	report: (month: IsoDate) => ["cash", "report", month] as const,
	cards: ["cash", "cards"] as const,
	card: (id: string) => ["cash", "card", id] as const,
	loans: ["cash", "loans"] as const,
	loan: (id: string) => ["cash", "loan", id] as const,
};

export function useDashboard() {
	const api = useApi();
	return useQuery({ queryKey: queryKeys.dashboard, queryFn: () => api.getDashboard() });
}

export function useContacts() {
	const api = useApi();
	return useQuery({ queryKey: queryKeys.contacts, queryFn: () => api.listContacts() });
}

export function useContact(id: string) {
	const api = useApi();
	return useQuery({ queryKey: queryKeys.contact(id), queryFn: () => api.getContact(id) });
}

export function useAgreement(id: string) {
	const api = useApi();
	return useQuery({ queryKey: queryKeys.agreement(id), queryFn: () => api.getAgreement(id) });
}

export function useAgreements() {
	const api = useApi();
	return useQuery({ queryKey: queryKeys.agreements, queryFn: () => api.listAgreements() });
}

export function useCalendar(month: IsoDate) {
	const api = useApi();
	return useQuery({ queryKey: queryKeys.calendar(month), queryFn: () => api.getCalendar(month) });
}

export function useCreateAgreement() {
	const api = useApi();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			input,
			idempotencyKey,
		}: {
			input: CreateAgreementInput;
			idempotencyKey: string;
		}) => api.createAgreement(input, idempotencyKey),
		// A new agreement changes the dashboard, contacts and calendar at once.
		onSuccess: () => queryClient.invalidateQueries(),
	});
}

export function useRecordPayment(agreementId: string) {
	const api = useApi();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			input,
			rowVersion,
			idempotencyKey,
		}: {
			input: PaymentInput;
			rowVersion: number;
			idempotencyKey: string;
		}) => api.recordPayment(agreementId, input, rowVersion, idempotencyKey),
		// Success changes balances everywhere; a conflict means our copy is stale. Both need fresh data.
		onSettled: () => queryClient.invalidateQueries(),
	});
}

export function useResolveInvite(token: string) {
	const api = useApi();
	return useQuery({ queryKey: queryKeys.invite(token), queryFn: () => api.resolveInvite(token) });
}

export function usePendingDecision(id: string) {
	const api = useApi();
	return useQuery({
		queryKey: queryKeys.decision(id),
		queryFn: () => api.getPendingDecision(id),
	});
}

export function useRequests() {
	const api = useApi();
	return useQuery({ queryKey: queryKeys.requests, queryFn: () => api.listRequests() });
}

// Sharing changes the agreement, the requests and the dashboard band at once: refresh everything.
function useSharingMutation<TArgs, TResult>(run: (args: TArgs) => Promise<TResult>) {
	const queryClient = useQueryClient();
	return useMutation({ mutationFn: run, onSettled: () => queryClient.invalidateQueries() });
}

export function useShareAgreementById() {
	const api = useApi();
	return useSharingMutation(
		({ id, paramnetId, rowVersion }: { id: string; paramnetId: string; rowVersion: number }) =>
			api.shareAgreementById(id, paramnetId, rowVersion),
	);
}

export function useShareAgreement() {
	const api = useApi();
	return useSharingMutation(
		({ id, phone, rowVersion }: { id: string; phone: string; rowVersion: number }) =>
			api.shareAgreement(id, phone, rowVersion),
	);
}

export function useWithdrawShare() {
	const api = useApi();
	return useSharingMutation((id: string) => api.withdrawShare(id));
}

export function useMakePersonal() {
	const api = useApi();
	return useSharingMutation((id: string) => api.makePersonal(id));
}

export function useDecide() {
	const api = useApi();
	return useSharingMutation(
		({
			pending,
			decision,
			counterTerms,
		}: {
			pending: PendingDecision;
			decision: Decision;
			counterTerms: TermsView | null;
		}) =>
			api.decide(
				pending.agreement_id,
				pending.actor,
				pending.version,
				pending.terms_hash,
				decision,
				counterTerms,
			),
	);
}

export function useDecidePayment() {
	const api = useApi();
	return useSharingMutation(
		({ paymentId, decision }: { paymentId: string; decision: "confirm" | "reject" }) =>
			api.decidePayment(paymentId, decision),
	);
}

export function useWithdrawPayment() {
	const api = useApi();
	return useSharingMutation((paymentId: string) => api.withdrawPayment(paymentId));
}

export function useProposeAmendment() {
	const api = useApi();
	return useSharingMutation(
		({
			id,
			terms,
			reason,
			rowVersion,
		}: {
			id: string;
			terms: TermsView;
			reason: string | null;
			rowVersion: number;
		}) => api.proposeAmendment(id, terms, reason, rowVersion),
	);
}

export function useWithdrawAmendment() {
	const api = useApi();
	return useSharingMutation((id: string) => api.withdrawAmendment(id));
}

export function useOpenDispute() {
	const api = useApi();
	return useSharingMutation(
		({
			id,
			reason,
			paymentId,
			rowVersion,
		}: {
			id: string;
			reason: string;
			paymentId: string | null;
			rowVersion: number;
		}) => api.openDispute(id, reason, paymentId, rowVersion),
	);
}

export function useResolveDispute() {
	const api = useApi();
	return useSharingMutation((id: string) => api.resolveDispute(id));
}

export function useRequestCancel() {
	const api = useApi();
	return useSharingMutation(({ id, rowVersion }: { id: string; rowVersion: number }) =>
		api.requestCancel(id, rowVersion),
	);
}

export function useDecideCancel() {
	const api = useApi();
	return useSharingMutation(({ id, decision }: { id: string; decision: "accept" | "reject" }) =>
		api.decideCancel(id, decision),
	);
}

export function useForgiveRemaining() {
	const api = useApi();
	return useSharingMutation(
		({
			id,
			amountMinor,
			rowVersion,
			idempotencyKey,
		}: {
			id: string;
			amountMinor: number | null;
			rowVersion: number;
			idempotencyKey: string;
		}) => api.forgiveRemaining(id, amountMinor, rowVersion, idempotencyKey),
	);
}

// Fire and forget: analytics never blocks or fails a screen.
export function useTrack(): (event: AnalyticsEvent) => void {
	const api = useApi();
	return useCallback(
		(event: AnalyticsEvent) => {
			api.trackEvent(event).catch(() => undefined);
		},
		[api],
	);
}

// Profile, ParamNet ID and inbox (F4-02) -----------------------------------------------------------

// Signed URLs live an hour (supabaseProfile); refetch well before they expire.
const AVATAR_URL_STALE_MS = 45 * 60 * 1000;
const INBOX_PAGE = 50;

export function useMyProfile() {
	const api = useProfileApi();
	return useQuery({ queryKey: queryKeys.profile, queryFn: () => api.getMyProfile() });
}

export function useAvatarUrl(path: string | null) {
	const api = useProfileApi();
	return useQuery({
		queryKey: queryKeys.avatar(path ?? ""),
		queryFn: () => (path === null ? Promise.resolve(null) : api.avatarUrl(path)),
		enabled: path !== null,
		staleTime: AVATAR_URL_STALE_MS,
	});
}

// Every write returns or implies the new profile; keep one copy for Profil, Menü and the form.
function useProfileMutation<TArgs, TResult>(
	run: (args: TArgs) => Promise<TResult>,
	patch: (result: TResult, args: TArgs) => Partial<MyProfile> | null,
) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: run,
		onSuccess: (result, args) => {
			const change = patch(result, args);
			if (change === null) {
				return queryClient.invalidateQueries({ queryKey: queryKeys.profile });
			}
			queryClient.setQueryData<MyProfile>(queryKeys.profile, (old) =>
				old === undefined ? old : { ...old, ...change },
			);
			return undefined;
		},
	});
}

export function useUpdateProfile() {
	const api = useProfileApi();
	return useProfileMutation(
		(input: ProfileInput) => api.updateProfile(input),
		(profile) => profile,
	);
}

export function useUploadAvatar() {
	const api = useProfileApi();
	return useProfileMutation(
		(localUri: string) => api.uploadAvatar(localUri),
		({ avatar_path }) => ({ avatar_path }),
	);
}

export function useRemoveAvatar() {
	const api = useProfileApi();
	return useProfileMutation(
		() => api.removeAvatar(),
		() => ({ avatar_path: null }),
	);
}

export function useRegenerateParamnetId() {
	const api = useProfileApi();
	return useProfileMutation(
		() => api.regenerateParamnetId(),
		(result) => result,
	);
}

export function useSetIdDiscoverable() {
	const api = useProfileApi();
	return useProfileMutation(
		(on: boolean) => api.setIdDiscoverable(on),
		(_result, on) => ({ id_discoverable: on }),
	);
}

export function useSetReminderPrefs() {
	const api = useProfileApi();
	return useProfileMutation(
		(days: ReminderDay[]) => api.setReminderPrefs(days),
		(reminder_before_days) => ({ reminder_before_days }),
	);
}

// name: an already valid, normalized username; null skips the check (empty, invalid or unchanged).
export function useUsernameCheck(name: string | null) {
	const api = useProfileApi();
	return useQuery({
		queryKey: queryKeys.username(name ?? ""),
		queryFn: () => (name === null ? Promise.resolve(null) : api.checkUsername(name)),
		enabled: name !== null,
	});
}

// id: a complete, normalized ParamNet ID. Every lookup counts against the hourly limit (ADR-050), so the
// answer is kept for the session and a lookup is never retried on its own.
export function useParamnetIdLookup(id: string | null) {
	const api = useProfileApi();
	return useQuery({
		queryKey: queryKeys.paramnetId(id ?? ""),
		queryFn: () => (id === null ? Promise.resolve(null) : api.findByParamnetId(id)),
		enabled: id !== null,
		staleTime: Infinity,
		retry: false,
	});
}

function inboxOptions(api: ProfileApi, category: NotificationCategory | null) {
	return infiniteQueryOptions({
		queryKey: queryKeys.inbox(category),
		queryFn: ({ pageParam }: { pageParam: number | null }) =>
			api.listNotifications(category, pageParam),
		initialPageParam: null as number | null,
		getNextPageParam: (last: InboxPage) =>
			last.items.length < INBOX_PAGE ? undefined : (last.items.at(-1)?.id ?? undefined),
	});
}

export function useInbox(category: NotificationCategory | null) {
	const api = useProfileApi();
	return useInfiniteQuery(inboxOptions(api, category));
}

// Home's bell: unread notices (design 03, "Bildirimler, 3 okunmamış").
export function useUnreadCount(): number {
	const api = useProfileApi();
	const inbox = useInfiniteQuery(inboxOptions(api, null));
	return inbox.data?.pages[0]?.unread_count ?? 0;
}

export function useMarkNotificationsRead() {
	const api = useProfileApi();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (ids: number[] | null) => api.markNotificationsRead(ids),
		onSettled: () => queryClient.invalidateQueries({ queryKey: ["inbox"] }),
	});
}

// Accounts and cash records (F4-03) ---------------------------------------------------------------

export function useAccounts() {
	const api = useAccountsApi();
	return useQuery({ queryKey: queryKeys.accounts, queryFn: () => api.listAccounts() });
}

export function useCashSummary(month: IsoDate) {
	const api = useAccountsApi();
	return useQuery({
		queryKey: queryKeys.cashSummary(month),
		queryFn: () => api.getCashSummary(month),
	});
}

export function useTransactions(month: IsoDate, accountId: string | null) {
	const api = useAccountsApi();
	return useQuery({
		queryKey: queryKeys.transactions(month, accountId),
		queryFn: () => api.listTransactions(month, accountId),
	});
}

// null: the form is for a new record and has nothing to load.
export function useTransaction(id: string | null) {
	const api = useAccountsApi();
	return useQuery({
		queryKey: queryKeys.transaction(id ?? ""),
		queryFn: () => api.getTransaction(id ?? ""),
		enabled: id !== null,
	});
}

// Success moves balances and lists; a conflict means our copy is stale. Both need the cash reads again.
function useCashMutation<TArgs, TResult>(run: (args: TArgs) => Promise<TResult>) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: run,
		onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.cash }),
	});
}

export function useCreateAccount() {
	const api = useAccountsApi();
	return useCashMutation(
		({ input, idempotencyKey }: { input: AccountInput; idempotencyKey: string }) =>
			api.createAccount(input, idempotencyKey),
	);
}

export function useUpdateAccount() {
	const api = useAccountsApi();
	return useCashMutation(
		({ id, input, rowVersion }: { id: string; input: AccountInput; rowVersion: number }) =>
			api.updateAccount(id, input, rowVersion),
	);
}

export function useArchiveAccount() {
	const api = useAccountsApi();
	return useCashMutation(({ id, rowVersion }: { id: string; rowVersion: number }) =>
		api.archiveAccount(id, rowVersion),
	);
}

export function useAdjustBalance() {
	const api = useAccountsApi();
	return useCashMutation(
		({
			id,
			targetMinor,
			idempotencyKey,
		}: {
			id: string;
			targetMinor: number;
			idempotencyKey: string;
		}) => api.adjustBalance(id, targetMinor, idempotencyKey),
	);
}

export function useCreateTransaction() {
	const api = useAccountsApi();
	return useCashMutation(
		({ input, idempotencyKey }: { input: TransactionInput; idempotencyKey: string }) =>
			api.createTransaction(input, idempotencyKey),
	);
}

export function useUpdateTransaction() {
	const api = useAccountsApi();
	return useCashMutation(
		({ id, input, rowVersion }: { id: string; input: TransactionInput; rowVersion: number }) =>
			api.updateTransaction(id, input, rowVersion),
	);
}

export function useDeleteTransaction() {
	const api = useAccountsApi();
	return useCashMutation(({ id, rowVersion }: { id: string; rowVersion: number }) =>
		api.deleteTransaction(id, rowVersion),
	);
}

export function useRestoreTransaction() {
	const api = useAccountsApi();
	return useCashMutation(({ id, rowVersion }: { id: string; rowVersion: number }) =>
		api.restoreTransaction(id, rowVersion),
	);
}

// Repeating records, budgets and the monthly report (F4-04) -------------------------------------------

export function useRecurring() {
	const api = useAccountsApi();
	return useQuery({ queryKey: queryKeys.recurring, queryFn: () => api.listRecurring() });
}

export function useCreateRecurring() {
	const api = useAccountsApi();
	return useCashMutation(
		({ input, idempotencyKey }: { input: RecurringInput; idempotencyKey: string }) =>
			api.createRecurring(input, idempotencyKey),
	);
}

export function useUpdateRecurring() {
	const api = useAccountsApi();
	return useCashMutation(
		({ id, input, rowVersion }: { id: string; input: RecurringInput; rowVersion: number }) =>
			api.updateRecurring(id, input, rowVersion),
	);
}

export function useSetRecurringPaused() {
	const api = useAccountsApi();
	return useCashMutation(
		({ id, paused, rowVersion }: { id: string; paused: boolean; rowVersion: number }) =>
			api.setRecurringPaused(id, paused, rowVersion),
	);
}

export function useDeleteRecurring() {
	const api = useAccountsApi();
	return useCashMutation(({ id, rowVersion }: { id: string; rowVersion: number }) =>
		api.deleteRecurring(id, rowVersion),
	);
}

export function useConfirmRecurring() {
	const api = useAccountsApi();
	return useCashMutation(
		({ id, date, idempotencyKey }: { id: string; date: IsoDate; idempotencyKey: string }) =>
			api.confirmRecurring(id, date, idempotencyKey),
	);
}

export function useSkipRecurring() {
	const api = useAccountsApi();
	return useCashMutation(({ id, date }: { id: string; date: IsoDate }) =>
		api.skipRecurring(id, date),
	);
}

export function useBudgets(month: IsoDate) {
	const api = useAccountsApi();
	return useQuery({ queryKey: queryKeys.budgets(month), queryFn: () => api.listBudgets(month) });
}

export function useSetBudget() {
	const api = useAccountsApi();
	return useCashMutation(
		({ category, limitMinor }: { category: TransactionCategory; limitMinor: number | null }) =>
			api.setBudget(category, limitMinor),
	);
}

export function useMonthlyReport(month: IsoDate) {
	const api = useAccountsApi();
	return useQuery({
		queryKey: queryKeys.report(month),
		queryFn: () => api.getMonthlyReport(month),
	});
}

// Credit cards (F4-05) -----------------------------------------------------------------------------------

export function useCards() {
	const api = useAccountsApi();
	return useQuery({ queryKey: queryKeys.cards, queryFn: () => api.listCards() });
}

export function useCard(id: string) {
	const api = useAccountsApi();
	return useQuery({ queryKey: queryKeys.card(id), queryFn: () => api.getCard(id) });
}

export function useCreateCard() {
	const api = useAccountsApi();
	return useCashMutation(
		({ input, idempotencyKey }: { input: CardInput; idempotencyKey: string }) =>
			api.createCard(input, idempotencyKey),
	);
}

export function useUpdateCard() {
	const api = useAccountsApi();
	return useCashMutation(
		({ id, input, rowVersion }: { id: string; input: CardInput; rowVersion: number }) =>
			api.updateCard(id, input, rowVersion),
	);
}

export function useArchiveCard() {
	const api = useAccountsApi();
	return useCashMutation(({ id, rowVersion }: { id: string; rowVersion: number }) =>
		api.archiveCard(id, rowVersion),
	);
}

// Bank loans (F4-06) -----------------------------------------------------------------------------------

export function useLoans() {
	const api = useAccountsApi();
	return useQuery({ queryKey: queryKeys.loans, queryFn: () => api.listLoans() });
}

export function useLoan(id: string) {
	const api = useAccountsApi();
	return useQuery({ queryKey: queryKeys.loan(id), queryFn: () => api.getLoan(id) });
}

export function useCreateLoan() {
	const api = useAccountsApi();
	return useCashMutation(
		({ input, idempotencyKey }: { input: LoanInput; idempotencyKey: string }) =>
			api.createLoan(input, idempotencyKey),
	);
}

export function useUpdateLoan() {
	const api = useAccountsApi();
	return useCashMutation(
		({ id, input, rowVersion }: { id: string; input: LoanInput; rowVersion: number }) =>
			api.updateLoan(id, input, rowVersion),
	);
}

export function useArchiveLoan() {
	const api = useAccountsApi();
	return useCashMutation(({ id, rowVersion }: { id: string; rowVersion: number }) =>
		api.archiveLoan(id, rowVersion),
	);
}

export function useRecordLoanPayment() {
	const api = useAccountsApi();
	return useCashMutation(
		({
			id,
			accountId,
			paidOn,
			idempotencyKey,
		}: {
			id: string;
			accountId: string;
			paidOn: IsoDate;
			idempotencyKey: string;
		}) => api.recordLoanPayment(id, accountId, paidOn, idempotencyKey),
	);
}

// "Para iste" and the hand-over (F4-08) ------------------------------------------------------------------

export function useRequestMoney() {
	const api = useApi();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			input,
			paramnetId,
			idempotencyKey,
		}: {
			input: CreateAgreementInput;
			paramnetId: string;
			idempotencyKey: string;
		}) => api.requestMoney(input, paramnetId, idempotencyKey),
		onSuccess: () => queryClient.invalidateQueries(),
	});
}

export function useDelivery(id: string) {
	const api = useApi();
	return useQuery({ queryKey: queryKeys.delivery(id), queryFn: () => api.getDelivery(id) });
}

export function useDeliveryStep() {
	const api = useApi();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			rowVersion,
			step,
		}: {
			id: string;
			rowVersion: number;
			step: "report" | "confirm";
		}) =>
			step === "report"
				? api.reportDelivery(id, rowVersion)
				: api.confirmDelivery(id, rowVersion),
		// The agreement's row_version moved too.
		onSettled: () => queryClient.invalidateQueries(),
	});
}
