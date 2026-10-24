import { ApiError } from "../errors";
import { DEMO_USER, MOCK_OTP_CODE, MOCK_PIN, createMockAuthApi } from "../auth/mockAuth";

function clock(start: string) {
	let current = new Date(start).getTime();
	return {
		now: () => new Date(current),
		advance: (ms: number) => {
			current += ms;
		},
	};
}

describe("mock AuthApi", () => {
	it("verifies the test code and creates a user without a display name", async () => {
		const auth = createMockAuthApi({ latencyMs: 0 });
		await expect(auth.requestOtp("0555 123 45 67")).resolves.toEqual({ resend_after_s: 60 });
		const user = await auth.verifyOtp("+905551234567", MOCK_OTP_CODE);
		expect(user).toMatchObject({
			phone_e164: "+905551234567",
			display_name: null,
			has_pin: false,
		});
		expect(await auth.updateProfile("Halil")).toMatchObject({ display_name: "Halil" });
	});

	it("keeps the profile for a returning number", async () => {
		const auth = createMockAuthApi({ latencyMs: 0 });
		await auth.requestOtp("5551234567");
		await auth.verifyOtp("5551234567", MOCK_OTP_CODE);
		await auth.updateProfile("Halil");
		await auth.signOut();
		await auth.requestOtp("5551234567");
		expect((await auth.verifyOtp("5551234567", MOCK_OTP_CODE)).display_name).toBe("Halil");
	});

	it("rejects a wrong code, an expired code and a non-Turkish-mobile number", async () => {
		const time = clock("2026-10-11T09:00:00Z");
		const auth = createMockAuthApi({ latencyMs: 0, now: time.now });
		await expect(auth.requestOtp("+15551234567")).rejects.toEqual(
			new ApiError("invalid_phone"),
		);
		await auth.requestOtp("5551234567");
		await expect(auth.verifyOtp("5551234567", "000000")).rejects.toEqual(
			new ApiError("otp_invalid"),
		);
		time.advance(3 * 60 * 1000 + 1);
		await expect(auth.verifyOtp("5551234567", MOCK_OTP_CODE)).rejects.toEqual(
			new ApiError("otp_expired"),
		);
	});

	it("rate-limits a resend inside 60 seconds", async () => {
		const time = clock("2026-10-11T09:00:00Z");
		const auth = createMockAuthApi({ latencyMs: 0, now: time.now });
		await auth.requestOtp("5551234567");
		time.advance(30_000);
		await expect(auth.requestOtp("5551234567")).rejects.toEqual(new ApiError("rate_limited"));
		time.advance(30_000);
		await expect(auth.requestOtp("5551234567")).resolves.toEqual({ resend_after_s: 60 });
	});

	it("updateProfile requires a signed-in user", async () => {
		const auth = createMockAuthApi({ latencyMs: 0 });
		await expect(auth.updateProfile("Halil")).rejects.toEqual(new ApiError("forbidden"));
	});

	it("sets a PIN after the SMS code, then signs in with it (ADR-046)", async () => {
		const auth = createMockAuthApi({ latencyMs: 0 });
		await expect(auth.setPin("482915")).rejects.toEqual(new ApiError("forbidden"));
		await auth.requestOtp("5551234567");
		await auth.verifyOtp("5551234567", MOCK_OTP_CODE);
		await expect(auth.setPin("123456")).rejects.toEqual(new ApiError("pin_weak"));
		await auth.setPin("482915");
		await auth.updateProfile("Halil");
		await auth.signOut();
		await expect(auth.signInWithPin("0555 123 45 67", "482915")).resolves.toMatchObject({
			phone_e164: "+905551234567",
			display_name: "Halil",
			has_pin: true,
		});
	});

	it("counts wrong PINs and locks the number for 15 minutes on the fifth (ADR-049)", async () => {
		const time = clock("2026-10-11T09:00:00Z");
		const auth = createMockAuthApi({ latencyMs: 0, now: time.now, signedIn: true });
		await auth.restore();
		await auth.signOut();
		const phone = DEMO_USER.phone_e164;
		for (const left of [4, 3, 2, 1]) {
			const error: unknown = await auth
				.signInWithPin(phone, "111222")
				.catch((e: unknown) => e);
			expect(error).toEqual(new ApiError("invalid_credentials"));
			expect((error as ApiError).details).toEqual({ attempts_left: left });
		}
		const locked: unknown = await auth.signInWithPin(phone, "111222").catch((e: unknown) => e);
		expect(locked).toEqual(new ApiError("account_locked"));
		expect((locked as ApiError).details).toEqual({ retry_after_s: 900 });
		await expect(auth.signInWithPin(phone, MOCK_PIN)).rejects.toEqual(
			new ApiError("account_locked"),
		);
		time.advance(15 * 60 * 1000);
		await expect(auth.signInWithPin(phone, MOCK_PIN)).resolves.toMatchObject({ has_pin: true });
	});

	it("answers an unknown number like a wrong PIN", async () => {
		const auth = createMockAuthApi({ latencyMs: 0 });
		await expect(auth.signInWithPin("5559998877", "482915")).rejects.toEqual(
			new ApiError("invalid_credentials"),
		);
		await expect(auth.signInWithPin("123", "482915")).rejects.toEqual(
			new ApiError("invalid_phone"),
		);
	});
});
