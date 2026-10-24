import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { createMockAuthApi } from "@/api/auth/mockAuth";
import { SEED_IDS } from "@/api/mock/seed";
import { resetSession } from "@/features/auth/sessionStore";
import * as notifications from "@/lib/notifications";
import { appRoutes } from "@/testing/appRoutes";
import { reachSignUpOtp, verifyAndSetPin } from "@/testing/signUp";
import { provideTestAuthApi } from "@/testing/providers";
import { signInForTest } from "@/testing/session";

const mocked = jest.mocked(notifications);

function spyAuth() {
	const auth = createMockAuthApi({ latencyMs: 0 });
	const register = jest.spyOn(auth, "registerPushToken");
	const unregister = jest.spyOn(auth, "unregisterPushToken");
	provideTestAuthApi(auth);
	return { register, unregister };
}

beforeEach(() => {
	jest.clearAllMocks();
	mocked.hasNotificationPermission.mockResolvedValue(true);
	mocked.getPushToken.mockResolvedValue({ token: "ExponentPushToken[device]", platform: "ios" });
});

describe("push (F1-18)", () => {
	it("registers the device after the user allows notifications", async () => {
		resetSession();
		const { register } = spyAuth();
		await renderRouter(appRoutes, { initialUrl: "/welcome" });
		await reachSignUpOtp();
		await verifyAndSetPin();
		await fireEvent.changeText(screen.getByTestId("profile.name.input"), "Halil");
		await fireEvent.press(screen.getByTestId("profile.consent.checkbox"));
		await fireEvent.press(screen.getByTestId("profile.save.button"));
		await waitFor(() => {
			expect(screen.getByTestId("notifications.screen")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("notifications.allow.button"));
		await waitFor(() => {
			expect(register).toHaveBeenCalledWith("ExponentPushToken[device]", "ios");
		});
		expect(mocked.requestNotificationPermission).toHaveBeenCalled();
	});

	it("does not register when there is no token (simulator, no EAS project id)", async () => {
		mocked.getPushToken.mockResolvedValue(null);
		signInForTest();
		const { register } = spyAuth();
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(mocked.getPushToken).toHaveBeenCalled();
		});
		expect(register).not.toHaveBeenCalled();
	});

	it("unregisters the device on sign-out", async () => {
		signInForTest();
		const { register, unregister } = spyAuth();
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(register).toHaveBeenCalled();
		});
		await fireEvent.press(screen.getByTestId("home.profile.button"));
		await waitFor(() => {
			expect(screen.getByTestId("me.signOut.button")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("me.signOut.button"));
		await waitFor(() => {
			expect(unregister).toHaveBeenCalledWith("ExponentPushToken[device]");
		});
	});

	it("opening a reminder shows its agreement", async () => {
		signInForTest();
		spyAuth();
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(mocked.onNotificationOpened).toHaveBeenCalled();
		});
		const listener = mocked.onNotificationOpened.mock.calls[0]?.[0];
		await act(async () => {
			listener?.(SEED_IDS.ahmetLoan, "dueToday");
			await Promise.resolve();
		});
		await waitFor(() => {
			expect(screen.getByTestId("agreement.screen")).toBeTruthy();
		});
	});

	it.each([
		["shareReceived", "decide.screen"],
		["shareWithdrawn", "requests.screen"],
	])("opening %s shows %s (F2-11)", async (template, screenId) => {
		signInForTest();
		spyAuth();
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(mocked.onNotificationOpened).toHaveBeenCalled();
		});
		const listener = mocked.onNotificationOpened.mock.calls[0]?.[0];
		await act(async () => {
			listener?.(SEED_IDS.zeynepShare, template);
			await Promise.resolve();
		});
		await waitFor(() => {
			expect(screen.getByTestId(screenId)).toBeTruthy();
		});
	});
});
