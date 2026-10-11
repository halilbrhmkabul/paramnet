import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { useSession } from "@/features/auth/sessionStore";
import { createTestQueryClient, provideTestQueryClient } from "@/testing/providers";
import { tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

describe("Profile / settings (S20 skeleton)", () => {
	it("opens from the home avatar and shows name and phone", async () => {
		await renderRouter(appRoutes, { initialUrl: "/" });
		await fireEvent.press(screen.getByTestId("home.profile.button"));
		await waitFor(() => {
			expect(screen.getByTestId("settings.screen")).toBeTruthy();
		});
		expect(screen.getByTestId("settings.name.text")).toHaveTextContent("Test");
		expect(screen.getByText("+90 555 000 00 01")).toBeTruthy();
		expect(screen.getByText(tr.settings.deleteAccount)).toBeTruthy();
	});

	it("signs out back to welcome and forgets the cached data", async () => {
		const queryClient = createTestQueryClient();
		provideTestQueryClient(queryClient);
		await renderRouter(appRoutes, { initialUrl: "/" });
		await fireEvent.press(screen.getByTestId("home.profile.button"));
		await waitFor(() => {
			expect(screen.getByTestId("settings.signOut.button")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("settings.signOut.button"));
		await waitFor(() => {
			expect(useSession.getState().user).toBeNull();
		});
		expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
		await waitFor(() => {
			expect(screen.getByTestId("welcome.screen")).toBeTruthy();
		});
		expect(useSession.getState().user).toBeNull();
	});
});
