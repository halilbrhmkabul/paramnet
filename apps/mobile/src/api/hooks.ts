import type { CreateAgreementInput, IsoDate, PaymentInput } from "@paramnet/shared";

import type { Decision, PendingDecision, TermsView } from "./types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApi } from "./ApiProvider";

export const queryKeys = {
	dashboard: ["dashboard"] as const,
	contacts: ["contacts"] as const,
	contact: (id: string) => ["contact", id] as const,
	agreement: (id: string) => ["agreement", id] as const,
	calendar: (month: IsoDate) => ["calendar", month] as const,
	invite: (token: string) => ["invite", token] as const,
	decision: (id: string) => ["decision", id] as const,
	requests: ["requests"] as const,
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
