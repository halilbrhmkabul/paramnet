import { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ApiProvider } from "@/api/ApiProvider";
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

export function TestProviders({
	api = createTestApi(),
	children,
}: {
	api?: ReturnType<typeof createMockApi>;
	children: ReactNode;
}) {
	return (
		<ApiProvider api={api} queryClient={createTestQueryClient()}>
			{children}
		</ApiProvider>
	);
}
