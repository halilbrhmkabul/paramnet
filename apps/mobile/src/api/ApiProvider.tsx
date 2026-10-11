import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState, type ReactNode } from "react";

import type { AgreementsApi } from "./AgreementsApi";
import type { AuthApi } from "./auth/AuthApi";
import { createMockAuthApi } from "./auth/mockAuth";
import { createMockApi } from "./mock/mockApi";

type Apis = { agreements: AgreementsApi; auth: AuthApi };

const ApiContext = createContext<Apis | null>(null);

// Only the mock adapters exist until F1-16/F1-17; EXPO_PUBLIC_API_MODE=supabase will select the real ones.
export function createApi(): AgreementsApi {
	return createMockApi();
}

export function createAuthApi(): AuthApi {
	return createMockAuthApi();
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
	authApi,
	queryClient,
	children,
}: {
	api?: AgreementsApi;
	authApi?: AuthApi;
	queryClient?: QueryClient;
	children: ReactNode;
}) {
	const [value] = useState<Apis>(() => ({
		agreements: api ?? createApi(),
		auth: authApi ?? createAuthApi(),
	}));
	const [client] = useState(() => queryClient ?? createQueryClient());
	return (
		<ApiContext.Provider value={value}>
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		</ApiContext.Provider>
	);
}

function useApis(): Apis {
	const apis = useContext(ApiContext);
	if (apis === null) {
		throw new Error("API hooks must be used inside ApiProvider");
	}
	return apis;
}

export function useApi(): AgreementsApi {
	return useApis().agreements;
}

export function useAuthApi(): AuthApi {
	return useApis().auth;
}
