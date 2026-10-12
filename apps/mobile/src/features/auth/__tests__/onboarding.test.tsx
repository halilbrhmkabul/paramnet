import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { MOCK_OTP_CODE } from "@/api/auth/mockAuth";
import { resetSession, useSession } from "@/features/auth/sessionStore";
import { tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { createTestAuthApi, provideTestAuthApi } from "@/testing/providers";

beforeEach(() => {
	resetSession();
});

async function reachOtp() {
	await renderRouter(appRoutes, { initialUrl: "/" });
	expect(screen.getByTestId("welcome.screen")).toBeTruthy();
	await fireEvent.press(screen.getByTestId("welcome.skip.button"));
	await fireEvent.changeText(screen.getByTestId("phone.number.input"), "5551234567");
	expect(screen.getByTestId("phone.number.input")).toHaveDisplayValue("555 123 45 67");
	await fireEvent.press(screen.getByTestId("phone.continue.button"));
	await waitFor(() => {
		expect(screen.getByTestId("otp.screen")).toBeTruthy();
	});
}

describe("onboarding (S01–S04)", () => {
	it("walks the intro cards before the phone step", async () => {
		await renderRouter(appRoutes, { initialUrl: "/" });
		expect(screen.getByText(tr.welcome.cards[0].title)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("welcome.next.button"));
		expect(screen.getByText(tr.welcome.cards[1].title)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("welcome.next.button"));
		await fireEvent.press(screen.getByTestId("welcome.next.button"));
		expect(screen.getByTestId("phone.screen")).toBeTruthy();
	});

	it("keeps Continue disabled until the number is a Turkish mobile", async () => {
		await renderRouter(appRoutes, { initialUrl: "/phone" });
		await fireEvent.changeText(screen.getByTestId("phone.number.input"), "212123");
		expect(screen.getByTestId("phone.continue.button")).toBeDisabled();
	});

	it("shows the wrong-code error, then signs up a new user end to end", async () => {
		await reachOtp();
		await fireEvent.changeText(screen.getByTestId("otp.code.input"), "000000");
		await waitFor(() => {
			expect(screen.getByText(tr.otp.errorInvalid)).toBeTruthy();
		});

		await fireEvent.changeText(screen.getByTestId("otp.code.input"), MOCK_OTP_CODE);
		await waitFor(() => {
			expect(screen.getByTestId("profile.screen")).toBeTruthy();
		});

		expect(screen.getByTestId("profile.save.button")).toBeDisabled();
		await fireEvent.changeText(screen.getByTestId("profile.name.input"), "  Halil  ");
		await fireEvent.press(screen.getByTestId("profile.consent.checkbox"));
		await fireEvent.press(screen.getByTestId("profile.save.button"));
		await waitFor(() => {
			expect(screen.getByTestId("notifications.screen")).toBeTruthy();
		});
		expect(screen.getByText(tr.profile.notificationsReason)).toBeTruthy();

		await fireEvent.press(screen.getByTestId("notifications.allow.button"));
		await waitFor(() => {
			expect(screen.getByTestId("home.screen")).toBeTruthy();
		});
		expect(useSession.getState().user?.display_name).toBe("Halil");
		expect(useSession.getState().user).not.toHaveProperty("pending_requests");
	});

	it("opens Talepler after sign-up when plans were shared with the number (F2-10)", async () => {
		const auth = createTestAuthApi();
		const updateProfile = auth.updateProfile.bind(auth);
		auth.updateProfile = async (name) => ({
			...(await updateProfile(name)),
			pending_requests: 1,
		});
		provideTestAuthApi(auth);
		await reachOtp();
		await fireEvent.changeText(screen.getByTestId("otp.code.input"), MOCK_OTP_CODE);
		await waitFor(() => {
			expect(screen.getByTestId("profile.screen")).toBeTruthy();
		});
		await fireEvent.changeText(screen.getByTestId("profile.name.input"), "Bora");
		await fireEvent.press(screen.getByTestId("profile.consent.checkbox"));
		await fireEvent.press(screen.getByTestId("profile.save.button"));
		await waitFor(() => {
			expect(screen.getByTestId("notifications.screen")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("notifications.later.button"));
		await waitFor(() => {
			expect(screen.getByTestId("requests.screen")).toBeTruthy();
		});
		expect(useSession.getState().openRequestsAfterOnboarding).toBe(false);
	});

	it("shows the expiry error when the code is too old", async () => {
		jest.useFakeTimers({
			now: new Date("2026-10-11T09:00:00Z"),
			doNotFake: ["nextTick", "setImmediate"],
		});
		try {
			await reachOtp();
			jest.setSystemTime(new Date("2026-10-11T09:03:01Z"));
			await fireEvent.changeText(screen.getByTestId("otp.code.input"), MOCK_OTP_CODE);
			await waitFor(() => {
				expect(screen.getByText(tr.otp.errorExpired)).toBeTruthy();
			});
		} finally {
			jest.useRealTimers();
		}
	});

	it("offers a resend only after the countdown", async () => {
		await reachOtp();
		expect(screen.getByTestId("otp.resend.button")).toBeDisabled();
	});
});
