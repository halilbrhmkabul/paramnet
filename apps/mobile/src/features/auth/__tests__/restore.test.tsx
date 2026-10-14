import { renderRouter, screen, waitFor } from "expo-router/testing-library";

import { createMockAuthApi } from "@/api/auth/mockAuth";
import { useSession } from "@/features/auth/sessionStore";
import { appRoutes } from "@/testing/appRoutes";
import { provideTestAuthApi } from "@/testing/providers";

beforeEach(() => {
	useSession.setState({
		user: null,
		pendingPhone: null,
		pinRequired: false,
		onboarded: false,
		restored: false,
	});
});

describe("session restore (F1-16)", () => {
	it("opens the tabs directly when a stored session with a profile exists", async () => {
		const auth = createMockAuthApi({ latencyMs: 0 });
		auth.restore = () =>
			Promise.resolve({
				id: "u1",
				phone_e164: "+905550000001",
				display_name: "Ayşe",
				has_pin: true,
			});
		provideTestAuthApi(auth);
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(screen.getByTestId("home.screen")).toBeTruthy();
		});
	});

	it("shows welcome when nothing is stored", async () => {
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(screen.getByTestId("welcome.screen")).toBeTruthy();
		});
	});

	it("a stored session without a profile continues at the profile step", async () => {
		const auth = createMockAuthApi({ latencyMs: 0 });
		auth.restore = () =>
			Promise.resolve({
				id: "u1",
				phone_e164: "+905550000001",
				display_name: null,
				has_pin: true,
			});
		provideTestAuthApi(auth);
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(screen.getByTestId("profile.screen")).toBeTruthy();
		});
	});
});
