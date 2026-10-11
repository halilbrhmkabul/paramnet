import { ApiError } from "../errors";
import { MOCK_OTP_CODE, createMockAuthApi } from "../auth/mockAuth";

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
		expect(user).toMatchObject({ phone_e164: "+905551234567", display_name: null });
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
});
