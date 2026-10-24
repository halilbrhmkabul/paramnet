import { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { AccountsApi } from "@/api/accounts/AccountsApi";
import { createMockAccountsApi, type MockAccountsOptions } from "@/api/accounts/mockAccounts";
import { ApiProvider } from "@/api/ApiProvider";
import type { AuthApi } from "@/api/auth/AuthApi";
import { createMockAuthApi } from "@/api/auth/mockAuth";
import { createMockApi, type MockApiOptions } from "@/api/mock/mockApi";
import { createMockProfileApi, type MockProfileOptions } from "@/api/profile/mockProfile";
import type { ProfileApi } from "@/api/profile/ProfileApi";

export const TEST_NOW = () => new Date("2026-10-11T09:00:00Z");

// gcTime Infinity: React Query would otherwise leave a 5-minute timer that keeps Jest alive.
export function createTestQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: Infinity },
			mutations: { retry: false },
		},
	});
}

export function createTestApi(options: MockApiOptions = {}) {
	return createMockApi({ now: TEST_NOW, latencyMs: 0, ...options });
}

let nextApi: ReturnType<typeof createMockApi> | null = null;

// renderRouter builds the real root layout; this hands its ApiProvider a prepared adapter (e.g. a failing one).
export function provideTestApi(api: ReturnType<typeof createMockApi>): void {
	nextApi = api;
}

export function takeTestApi(): ReturnType<typeof createMockApi> {
	const api = nextApi ?? createTestApi();
	nextApi = null;
	return api;
}

// Matches signInForTest(): the same name and number as the session user.
export function createTestProfileApi(options: MockProfileOptions = {}): ProfileApi {
	return createMockProfileApi({
		now: TEST_NOW,
		latencyMs: 0,
		...options,
		profile: {
			id: "u-test",
			first_name: "Test",
			last_name: null,
			display_name: "Test",
			username: "test",
			...options.profile,
		},
	});
}

let nextProfileApi: ProfileApi | null = null;

export function provideTestProfileApi(api: ProfileApi): void {
	nextProfileApi = api;
}

export function takeTestProfileApi(): ProfileApi {
	const api = nextProfileApi ?? createTestProfileApi();
	nextProfileApi = null;
	return api;
}

export function createTestAccountsApi(options: MockAccountsOptions = {}): AccountsApi {
	let id = 0;
	return createMockAccountsApi({
		now: TEST_NOW,
		latencyMs: 0,
		// Ordered ids ("00000001-…"): tests can name a record by when it was made.
		newId: () => {
			id += 1;
			return `${String(id).padStart(8, "0")}-0000-4000-8000-000000000000`;
		},
		...options,
	});
}

let nextAccountsApi: AccountsApi | null = null;

export function provideTestAccountsApi(api: AccountsApi): void {
	nextAccountsApi = api;
}

export function takeTestAccountsApi(): AccountsApi {
	const api = nextAccountsApi ?? createTestAccountsApi();
	nextAccountsApi = null;
	return api;
}

let nextQueryClient: QueryClient | null = null;

export function provideTestQueryClient(client: QueryClient): void {
	nextQueryClient = client;
}

export function takeTestQueryClient(): QueryClient {
	const client = nextQueryClient ?? createTestQueryClient();
	nextQueryClient = null;
	return client;
}

let nextAuthApi: AuthApi | null = null;

export function provideTestAuthApi(api: AuthApi): void {
	nextAuthApi = api;
}

export function takeTestAuthApi(): AuthApi {
	const api = nextAuthApi ?? createTestAuthApi();
	nextAuthApi = null;
	return api;
}

// Real clock on purpose: expiry tests move it with jest fake timers.
export function createTestAuthApi(): AuthApi {
	return createMockAuthApi({ latencyMs: 0 });
}

export function TestProviders({
	api = createTestApi(),
	authApi = createTestAuthApi(),
	profileApi = createTestProfileApi(),
	accountsApi = createTestAccountsApi(),
	children,
}: {
	api?: ReturnType<typeof createMockApi>;
	authApi?: AuthApi;
	profileApi?: ProfileApi;
	accountsApi?: AccountsApi;
	children: ReactNode;
}) {
	return (
		<ApiProvider
			api={api}
			authApi={authApi}
			profileApi={profileApi}
			accountsApi={accountsApi}
			queryClient={createTestQueryClient()}
		>
			{children}
		</ApiProvider>
	);
}
