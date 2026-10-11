import { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ApiProvider } from "@/api/ApiProvider";
import type { AuthApi } from "@/api/auth/AuthApi";
import { createMockAuthApi } from "@/api/auth/mockAuth";
import { createMockApi, type MockApiOptions } from "@/api/mock/mockApi";

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

// Real clock on purpose: expiry tests move it with jest fake timers.
export function createTestAuthApi(): AuthApi {
	return createMockAuthApi({ latencyMs: 0 });
}

export function TestProviders({
	api = createTestApi(),
	authApi = createTestAuthApi(),
	children,
}: {
	api?: ReturnType<typeof createMockApi>;
	authApi?: AuthApi;
	children: ReactNode;
}) {
	return (
		<ApiProvider api={api} authApi={authApi} queryClient={createTestQueryClient()}>
			{children}
		</ApiProvider>
	);
}
