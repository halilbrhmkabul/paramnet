import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState, type ReactNode } from "react";

import type { AccountsApi } from "./accounts/AccountsApi";
import { createMockAccountsApi } from "./accounts/mockAccounts";
import { createSupabaseAccountsApi } from "./accounts/supabaseAccounts";
import type { AgreementsApi } from "./AgreementsApi";
import type { AuthApi } from "./auth/AuthApi";
import { createMockAuthApi } from "./auth/mockAuth";
import { createSupabaseAuthApi } from "./auth/supabaseAuth";
import { createMockApi } from "./mock/mockApi";
import { createMockProfileApi } from "./profile/mockProfile";
import type { ProfileApi } from "./profile/ProfileApi";
import { createSupabaseProfileApi } from "./profile/supabaseProfile";
import { createSupabaseAgreementsApi } from "./supabase/supabaseAgreements";
import { readConfig } from "@/lib/config";
import { getSupabase } from "@/lib/supabase";

type Apis = {
	agreements: AgreementsApi;
	auth: AuthApi;
	profile: ProfileApi;
	accounts: AccountsApi;
};

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

export function createProfileApi(): ProfileApi {
	const config = readConfig();
	return config.mode === "supabase"
		? createSupabaseProfileApi(getSupabase(config.supabaseUrl, config.supabaseKey))
		: createMockProfileApi();
}

export function createAccountsApi(): AccountsApi {
	const config = readConfig();
	return config.mode === "supabase"
		? createSupabaseAccountsApi(getSupabase(config.supabaseUrl, config.supabaseKey))
		: createMockAccountsApi();
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
	profileApi,
	accountsApi,
	queryClient,
	children,
}: {
	api?: AgreementsApi;
	authApi?: AuthApi;
	profileApi?: ProfileApi;
	accountsApi?: AccountsApi;
	queryClient?: QueryClient;
	children: ReactNode;
}) {
	const [value] = useState<Apis>(() => ({
		agreements: api ?? createApi(),
		auth: authApi ?? createAuthApi(),
		profile: profileApi ?? createProfileApi(),
		accounts: accountsApi ?? createAccountsApi(),
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

export function useProfileApi(): ProfileApi {
	return useApis().profile;
}

export function useAccountsApi(): AccountsApi {
	return useApis().accounts;
}
