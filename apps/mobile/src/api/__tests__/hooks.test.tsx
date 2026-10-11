import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { ApiError, messageForError } from "../errors";
import { useAgreement, useDashboard } from "../hooks";
import { tr } from "@/i18n/tr";
import { TestProviders } from "@/testing/providers";

function wrapper({ children }: { children: ReactNode }) {
	return <TestProviders>{children}</TestProviders>;
}

describe("query hooks", () => {
	it("useDashboard resolves through the provided adapter", async () => {
		const { result } = await renderHook(() => useDashboard(), { wrapper });
		await waitFor(() => {
			expect(result.current.data?.receivable_minor).toBe(1550000);
		});
	});

	it("surfaces adapter errors", async () => {
		const { result } = await renderHook(() => useAgreement("missing"), { wrapper });
		await waitFor(() => {
			expect(result.current.error).toEqual(new ApiError("not_found"));
		});
	});
});

describe("messageForError", () => {
	it("maps server codes to Turkish copy and unknown errors to the generic message", () => {
		expect(messageForError(new ApiError("amount_exceeds_outstanding"))).toBe(
			tr.error.exceedsOutstanding,
		);
		expect(messageForError(new Error("boom"))).toBe(tr.error.generic);
	});
});
