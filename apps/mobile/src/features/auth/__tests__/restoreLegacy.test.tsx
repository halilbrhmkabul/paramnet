import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { createMockAuthApi } from "@/api/auth/mockAuth";
import { resetSession, useSession } from "@/features/auth/sessionStore";
import { tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { provideTestAuthApi } from "@/testing/providers";

// Own file: once an earlier test in the same file has shown the tabs, the router test harness keeps
// that state and a later switch from (auth) to the tabs lands on "Unmatched Route" (any setup step).
describe("session restore, account from before PINs", () => {
	beforeEach(() => {
		resetSession();
		useSession.setState({ restored: false });
	});

	it("an account from before PINs sets one first, then opens the tabs (ADR-046)", async () => {
		const auth = createMockAuthApi({ latencyMs: 0 });
		auth.restore = () =>
			Promise.resolve({
				id: "u1",
				phone_e164: "+905550000001",
				display_name: "Ayşe",
				has_pin: false,
			});
		auth.setPin = () => Promise.resolve();
		provideTestAuthApi(auth);
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(screen.getByTestId("pin.screen")).toBeTruthy();
		});
		expect(screen.getByText(tr.pin.legacyHelper)).toBeTruthy();
		await fireEvent.changeText(screen.getByTestId("pin.input"), "482915");
		await fireEvent.changeText(screen.getByTestId("pin.input"), "482915");
		await waitFor(() => {
			expect(screen.getByTestId("home.screen")).toBeTruthy();
		});
		expect(useSession.getState().user?.has_pin).toBe(true);
	});
});
