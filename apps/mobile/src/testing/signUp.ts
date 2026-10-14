import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { MOCK_OTP_CODE } from "@/api/auth/mockAuth";

// The sign-up path from welcome (01) to the code screen: create account → skip the intro (31) → number.
export async function reachSignUpOtp(digits = "5551234567"): Promise<void> {
	await fireEvent.press(screen.getByTestId("welcome.create.button"));
	await fireEvent.press(screen.getByTestId("onboarding.skip.button"));
	await fireEvent.changeText(screen.getByTestId("login.phone.input"), digits);
	await fireEvent.press(screen.getByTestId("login.submit.button"));
	await waitFor(() => {
		expect(screen.getByTestId("otp.screen")).toBeTruthy();
	});
}

// Code, then the PIN twice (ADR-046); ends on the profile step for a new number.
export async function verifyAndSetPin(pin = "482915"): Promise<void> {
	await fireEvent.changeText(screen.getByTestId("otp.code.input"), MOCK_OTP_CODE);
	await waitFor(() => {
		expect(screen.getByTestId("pin.screen")).toBeTruthy();
	});
	await fireEvent.changeText(screen.getByTestId("pin.input"), pin);
	await fireEvent.changeText(screen.getByTestId("pin.input"), pin);
	await waitFor(() => {
		expect(screen.getByTestId("profile.screen")).toBeTruthy();
	});
}
