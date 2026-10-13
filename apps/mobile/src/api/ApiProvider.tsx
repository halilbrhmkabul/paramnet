import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState, type ReactNode } from "react";

import type { AgreementsApi } from "./AgreementsApi";
import type { AuthApi } from "./auth/AuthApi";
import { createMockAuthApi } from "./auth/mockAuth";
import { createSupabaseAuthApi } from "./auth/supabaseAuth";
import { createMockApi } from "./mock/mockApi";
import { createSupabaseAgreementsApi } from "./supabase/supabaseAgreements";
import { readConfig } from "@/lib/config";
import { getSupabase } from "@/lib/supabase";

type Apis = { agreements: AgreementsApi; auth: AuthApi };

const ApiContext = createContext<Apis | null>(null);

// EXPO_PUBLIC_API_MODE selects the adapters (paramnet-mobile skill); screens never know which one runs.
export function createApi(): AgreementsApi {
	const config = readConfig();
	return config.mode === "supabase"
		? createSupabaseAgreementsApi(getSupabase(config.supabaseUrl, config.supabaseKey))
		: createMockApi();
}

export function createAuthApi(): AuthApi {
	const config = readConfig();
	return config.mode === "supabase"
		? createSupabaseAuthApi(getSupabase(config.supabaseUrl, config.supabaseKey))
		: createMockAuthApi({ signedIn: process.env.EXPO_PUBLIC_MOCK_SIGNED_IN === "1" });
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
