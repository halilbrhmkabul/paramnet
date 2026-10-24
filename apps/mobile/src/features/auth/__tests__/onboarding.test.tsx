import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { DEMO_USER, MOCK_OTP_CODE, MOCK_PIN } from "@/api/auth/mockAuth";
import { resetSession, useSession } from "@/features/auth/sessionStore";
import { fill, tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { createTestAuthApi, provideTestAuthApi } from "@/testing/providers";
import { reachSignUpOtp, verifyAndSetPin } from "@/testing/signUp";

beforeEach(() => {
	resetSession();
});

async function finishProfile(name: string) {
	await fireEvent.changeText(screen.getByTestId("profile.name.input"), name);
	await fireEvent.press(screen.getByTestId("profile.consent.checkbox"));
	await fireEvent.press(screen.getByTestId("profile.save.button"));
	await waitFor(() => {
		expect(screen.getByTestId("notifications.screen")).toBeTruthy();
	});
}

async function openSignIn() {
	await renderRouter(appRoutes, { initialUrl: "/" });
	await fireEvent.press(screen.getByTestId("welcome.signIn.button"));
	expect(screen.getByText(tr.login.signInTitle)).toBeTruthy();
}

describe("welcome (01) and intro (31)", () => {
	it("create account walks the three intro slides, then opens sign-up", async () => {
		await renderRouter(appRoutes, { initialUrl: "/" });
		expect(screen.getByText(tr.welcome.disclaimer)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("welcome.create.button"));
		expect(screen.getByText(tr.onboarding.slides[0].title)).toBeTruthy();
		expect(
			screen.getByText(fill(tr.onboarding.position, { current: "1", total: "3" })),
		).toBeTruthy();
		await fireEvent.press(screen.getByTestId("onboarding.next.button"));
		expect(screen.getByText(tr.onboarding.slides[1].title)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("onboarding.next.button"));
		expect(screen.getByText(tr.onboarding.slides[2].title)).toBeTruthy();
		expect(screen.getByText(tr.onboarding.start)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("onboarding.next.button"));
		expect(screen.getByText(tr.login.signUpTitle)).toBeTruthy();
		expect(screen.queryByTestId("login.pin.input")).toBeNull();
	});

	it("skip goes straight to sign-up; sign in opens the PIN form", async () => {
		await renderRouter(appRoutes, { initialUrl: "/" });
		await fireEvent.press(screen.getByTestId("welcome.create.button"));
		await fireEvent.press(screen.getByTestId("onboarding.skip.button"));
		expect(screen.getByText(tr.login.signUpTitle)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("login.mode.signin"));
		expect(screen.getByText(tr.login.signInTitle)).toBeTruthy();
		expect(screen.getByTestId("login.pin.input")).toBeTruthy();
		// Face ID waits for a later task (BACKLOG); no button for it yet.
		expect(screen.queryByText(/Yüz tanıma/)).toBeNull();
	});
});

describe("sign-up (02 → code → PIN → profile)", () => {
	it("keeps the button disabled until the number is a Turkish mobile", async () => {
		await renderRouter(appRoutes, { initialUrl: "/login?mode=signup" });
		await fireEvent.changeText(screen.getByTestId("login.phone.input"), "212123");
		expect(screen.getByTestId("login.submit.button")).toBeDisabled();
		await fireEvent.changeText(screen.getByTestId("login.phone.input"), "5551234567");
		expect(screen.getByTestId("login.phone.input")).toHaveDisplayValue("555 123 45 67");
		expect(screen.getByTestId("login.submit.button")).not.toBeDisabled();
	});

	it("shows the wrong-code error, then signs up a new user with a PIN end to end", async () => {
		await renderRouter(appRoutes, { initialUrl: "/" });
		await reachSignUpOtp();
		await fireEvent.changeText(screen.getByTestId("otp.code.input"), "000000");
		await waitFor(() => {
			expect(screen.getByText(tr.otp.errorInvalid)).toBeTruthy();
		});
		await fireEvent.changeText(screen.getByTestId("otp.code.input"), MOCK_OTP_CODE);
		await waitFor(() => {
			expect(screen.getByTestId("pin.screen")).toBeTruthy();
		});
		expect(screen.getByText(tr.pin.createTitle)).toBeTruthy();

		// A weak PIN is refused before the second entry.
		await fireEvent.changeText(screen.getByTestId("pin.input"), "123456");
		expect(screen.getByText(tr.pin.weak)).toBeTruthy();
		expect(screen.getByText(tr.pin.createTitle)).toBeTruthy();

		// A different second entry starts over.
		await fireEvent.changeText(screen.getByTestId("pin.input"), "482915");
		expect(screen.getByText(tr.pin.confirmTitle)).toBeTruthy();
		await fireEvent.changeText(screen.getByTestId("pin.input"), "482916");
		expect(screen.getByText(tr.pin.mismatch)).toBeTruthy();
		expect(screen.getByText(tr.pin.createTitle)).toBeTruthy();

		await fireEvent.changeText(screen.getByTestId("pin.input"), "482915");
		await fireEvent.changeText(screen.getByTestId("pin.input"), "482915");
		await waitFor(() => {
			expect(screen.getByTestId("profile.screen")).toBeTruthy();
		});
		await finishProfile("  Halil  ");
		expect(screen.getByText(tr.profile.notificationsReason)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("notifications.allow.button"));
		await waitFor(() => {
			expect(screen.getByTestId("home.screen")).toBeTruthy();
		});
		expect(useSession.getState().user).toMatchObject({ display_name: "Halil", has_pin: true });
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
		await renderRouter(appRoutes, { initialUrl: "/" });
		await reachSignUpOtp();
		await verifyAndSetPin();
		await finishProfile("Bora");
		await fireEvent.press(screen.getByTestId("notifications.later.button"));
		await waitFor(() => {
			expect(screen.getByTestId("requests.screen")).toBeTruthy();
		});
		expect(useSession.getState().openRequestsAfterOnboarding).toBe(false);
	});

	it("an account from before PINs sets one after the SMS code, then opens the tabs", async () => {
		const auth = createTestAuthApi();
		auth.verifyOtp = () =>
			Promise.resolve({
				id: "u1",
				phone_e164: "+905551234567",
				display_name: "Ayşe",
				has_pin: false,
			});
		auth.setPin = () => Promise.resolve();
		provideTestAuthApi(auth);
		await renderRouter(appRoutes, { initialUrl: "/" });
		await reachSignUpOtp();
		await fireEvent.changeText(screen.getByTestId("otp.code.input"), MOCK_OTP_CODE);
		await waitFor(() => {
			expect(screen.getByTestId("pin.screen")).toBeTruthy();
		});
		expect(screen.getByText(tr.pin.legacyHelper)).toBeTruthy();
		await fireEvent.changeText(screen.getByTestId("pin.input"), "482915");
		await fireEvent.changeText(screen.getByTestId("pin.input"), "482915");
		await waitFor(() => {
			expect(screen.getByTestId("home.screen")).toBeTruthy();
		});
	});

	it("shows the expiry error when the code is too old", async () => {
		jest.useFakeTimers({
			now: new Date("2026-10-11T09:00:00Z"),
			doNotFake: ["nextTick", "setImmediate"],
		});
		try {
			await renderRouter(appRoutes, { initialUrl: "/" });
			await reachSignUpOtp();
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
		await renderRouter(appRoutes, { initialUrl: "/" });
		await reachSignUpOtp();
		expect(screen.getByTestId("otp.resend.button")).toBeDisabled();
	});
});

describe("sign-in with PIN (02, ADR-046)", () => {
	it("signs a returning user straight into the tabs", async () => {
		await openSignIn();
		await fireEvent.changeText(screen.getByTestId("login.phone.input"), "5550000001");
		expect(screen.getByTestId("login.submit.button")).toBeDisabled();
		await fireEvent.changeText(screen.getByTestId("login.pin.input"), MOCK_PIN);
		await fireEvent.press(screen.getByTestId("login.submit.button"));
		await waitFor(() => {
			expect(screen.getByTestId("home.screen")).toBeTruthy();
		});
		expect(useSession.getState().user?.id).toBe(DEMO_USER.id);
	});

	it("hides the PIN until asked to show it", async () => {
		await openSignIn();
		expect(screen.getByTestId("login.pin.input").props.secureTextEntry).toBe(true);
		await fireEvent.press(screen.getByTestId("login.pin.toggle"));
		expect(screen.getByTestId("login.pin.input").props.secureTextEntry).toBe(false);
		expect(screen.getByLabelText(tr.login.hidePin)).toBeTruthy();
	});

	it("says how many tries are left, then that the number is locked", async () => {
		await openSignIn();
		await fireEvent.changeText(screen.getByTestId("login.phone.input"), "5550000001");
		await fireEvent.changeText(screen.getByTestId("login.pin.input"), "111222");
		await fireEvent.press(screen.getByTestId("login.submit.button"));
		await waitFor(() => {
			expect(screen.getByText(fill(tr.error.attemptsLeft, { count: "4" }))).toBeTruthy();
		});
		// A wrong PIN is cleared, so each try types it again.
		expect(screen.getByTestId("login.pin.input")).toHaveDisplayValue("");
		for (let i = 0; i < 4; i += 1) {
			await fireEvent.changeText(screen.getByTestId("login.pin.input"), "111222");
			await fireEvent.press(screen.getByTestId("login.submit.button"));
		}
		await waitFor(() => {
			expect(screen.getByText(fill(tr.error.accountLocked, { minutes: "15" }))).toBeTruthy();
		});
	});

	it("forgot PIN: asks for the number, then SMS code and a new PIN", async () => {
		await openSignIn();
		await fireEvent.press(screen.getByTestId("login.forgot.button"));
		expect(screen.getByText(tr.login.forgotNeedsPhone)).toBeTruthy();

		await fireEvent.changeText(screen.getByTestId("login.phone.input"), "5550000001");
		await fireEvent.press(screen.getByTestId("login.forgot.button"));
		await waitFor(() => {
			expect(screen.getByTestId("otp.screen")).toBeTruthy();
		});
		await fireEvent.changeText(screen.getByTestId("otp.code.input"), MOCK_OTP_CODE);
		await waitFor(() => {
			expect(screen.getByTestId("pin.screen")).toBeTruthy();
		});
		expect(screen.getByText(tr.pin.resetTitle)).toBeTruthy();
		await fireEvent.changeText(screen.getByTestId("pin.input"), "550913");
		await fireEvent.changeText(screen.getByTestId("pin.input"), "550913");
		await waitFor(() => {
			expect(screen.getByTestId("home.screen")).toBeTruthy();
		});
	});
});
