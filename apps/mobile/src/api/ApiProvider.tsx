import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState, type ReactNode } from "react";

import type { AgreementsApi } from "./AgreementsApi";
import { createMockApi } from "./mock/mockApi";

const ApiContext = createContext<AgreementsApi | null>(null);

// Only the mock adapter exists until F1-17; EXPO_PUBLIC_API_MODE=supabase will select the real one.
export function createApi(): AgreementsApi {
	return createMockApi();
}

export function createQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { staleTime: 30_000 },
			mutations: { retry: 0 },
		},
	});
}

export function ApiProvider({
	api,
	queryClient,
	children,
}: {
	api?: AgreementsApi;
	queryClient?: QueryClient;
	children: ReactNode;
}) {
	const [value] = useState(() => api ?? createApi());
	const [client] = useState(() => queryClient ?? createQueryClient());
	return (
		<ApiContext.Provider value={value}>
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		</ApiContext.Provider>
	);
}

export function useApi(): AgreementsApi {
	const api = useContext(ApiContext);
	if (api === null) {
		throw new Error("useApi must be used inside ApiProvider");
	}
	return api;
}
