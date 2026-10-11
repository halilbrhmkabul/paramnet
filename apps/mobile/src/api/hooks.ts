import type { CreateAgreementInput, IsoDate } from "@paramnet/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApi } from "./ApiProvider";

export const queryKeys = {
	dashboard: ["dashboard"] as const,
	contacts: ["contacts"] as const,
	contact: (id: string) => ["contact", id] as const,
	agreement: (id: string) => ["agreement", id] as const,
	calendar: (month: IsoDate) => ["calendar", month] as const,
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
