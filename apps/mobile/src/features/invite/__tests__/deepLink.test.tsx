import { renderRouter, screen, waitFor, fireEvent } from "expo-router/testing-library";

import { redirectSystemPath } from "../../../../app/+native-intent";
import { resetSession, useSession } from "@/features/auth/sessionStore";
import { appRoutes } from "@/testing/appRoutes";
import { signInForTest } from "@/testing/session";

describe("invite links (F2-05)", () => {
	it.each([
		["https://paramnet.app/i/abcDEF_-123", "/invite/abcDEF_-123"],
		["/i/abcDEF_-123", "/invite/abcDEF_-123"],
		["paramnet://i/abc", "/invite/abc"],
		["https://paramnet.app/other", "https://paramnet.app/other"],
		["/agreement/1", "/agreement/1"],
	])("%s → %s", (input, output) => {
		expect(redirectSystemPath({ path: input, initial: true })).toBe(output);
	});

	it("signed in: the invite opens directly", async () => {
		signInForTest();
		await renderRouter(appRoutes, { initialUrl: "/invite/tok123" });
		await waitFor(() => {
			expect(screen.getByTestId("invite.screen")).toBeTruthy();
		});
	});

	it("signed out: sign in first, then come back to the same invite", async () => {
		resetSession();
		await renderRouter(appRoutes, { initialUrl: "/invite/tok123" });
		await waitFor(() => {
			expect(screen.getByTestId("welcome.screen")).toBeTruthy();
		});
		expect(useSession.getState().pendingInviteToken).toBe("tok123");

		await fireEvent.press(screen.getByTestId("welcome.skip.button"));
		await fireEvent.changeText(screen.getByTestId("phone.number.input"), "5551234567");
		await fireEvent.press(screen.getByTestId("phone.continue.button"));
		await waitFor(() => {
			expect(screen.getByTestId("otp.screen")).toBeTruthy();
		});
		await fireEvent.changeText(screen.getByTestId("otp.code.input"), "123456");
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
			expect(screen.getByTestId("invite.screen")).toBeTruthy();
		});
		expect(useSession.getState().pendingInviteToken).toBeNull();
	});
});
