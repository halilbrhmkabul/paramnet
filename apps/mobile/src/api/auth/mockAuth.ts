import { normalizePhoneTR, pinProblem } from "@paramnet/shared";

import { ApiError } from "../errors";
import type { AuthApi, AuthUser } from "./AuthApi";

// Same code as the local Supabase test numbers (CLAUDE.md), so muscle memory carries over.
export const MOCK_OTP_CODE = "123456";
const OTP_TTL_MS = 3 * 60 * 1000;
const RESEND_AFTER_S = 60;
// The design's sample PIN; the demo account signs in with it (F4-01b).
export const MOCK_PIN = "482915";
// Same lock as pin_login_record (ADR-049).
const MAX_PIN_FAILURES = 5;
const PIN_LOCK_MS = 15 * 60 * 1000;

// signedIn: the prototype starts with a demo account (design QA in the simulator, F4-01).
export type MockAuthOptions = { now?: () => Date; latencyMs?: number; signedIn?: boolean };

export const DEMO_USER: AuthUser = {
	id: "u-demo",
	phone_e164: "+905550000001",
	display_name: "Deniz Yılmaz",
	has_pin: true,
};

export function createMockAuthApi({
	now = () => new Date(),
	latencyMs = 300,
	signedIn = false,
}: MockAuthOptions = {}): AuthApi {
	const sentAt = new Map<string, number>();
	const users = new Map<string, AuthUser>([[DEMO_USER.phone_e164, DEMO_USER]]);
	const pins = new Map<string, string>([[DEMO_USER.phone_e164, MOCK_PIN]]);
	const failures = new Map<string, { count: number; last: number; lockedUntil: number | null }>();
	let current: AuthUser | null = null;

	async function delay(): Promise<void> {
		if (latencyMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, latencyMs));
		}
	}

	function phoneOrThrow(input: string): string {
		const phone = normalizePhoneTR(input);
		if (phone === null) {
			throw new ApiError("invalid_phone");
		}
		return phone;
	}

	return {
		async requestOtp(input) {
			await delay();
			const phone = phoneOrThrow(input);
			const last = sentAt.get(phone);
			const time = now().getTime();
			if (last !== undefined && time - last < RESEND_AFTER_S * 1000) {
				throw new ApiError("rate_limited");
			}
			sentAt.set(phone, time);
			return { resend_after_s: RESEND_AFTER_S };
		},

		async verifyOtp(input, code) {
			await delay();
			const phone = phoneOrThrow(input);
			const sent = sentAt.get(phone);
			if (sent === undefined || now().getTime() - sent > OTP_TTL_MS) {
				throw new ApiError("otp_expired");
			}
			if (code !== MOCK_OTP_CODE) {
				throw new ApiError("otp_invalid");
			}
			sentAt.delete(phone);
			const user = users.get(phone) ?? {
				id: `u-${phone.slice(-4)}`,
				phone_e164: phone,
				display_name: null,
				has_pin: false,
			};
			users.set(phone, user);
			current = user;
			return { ...user };
		},

		async signInWithPin(input, pin) {
			await delay();
			const phone = phoneOrThrow(input);
			const time = now().getTime();
			const entry = failures.get(phone);
			if (entry?.lockedUntil != null && entry.lockedUntil > time) {
				throw new ApiError("account_locked", {
					retry_after_s: Math.ceil((entry.lockedUntil - time) / 1000),
				});
			}
			const user = users.get(phone);
			if (user !== undefined && pins.get(phone) === pin) {
				failures.delete(phone);
				current = user;
				return { ...user };
			}
			const fresh =
				entry === undefined ||
				entry.lockedUntil !== null ||
				time - entry.last > PIN_LOCK_MS;
			const count = fresh ? 1 : entry.count + 1;
			const locked = count >= MAX_PIN_FAILURES;
			failures.set(phone, {
				count,
				last: time,
				lockedUntil: locked ? time + PIN_LOCK_MS : null,
			});
			if (locked) {
				throw new ApiError("account_locked", { retry_after_s: PIN_LOCK_MS / 1000 });
			}
			throw new ApiError("invalid_credentials", { attempts_left: MAX_PIN_FAILURES - count });
		},

		async setPin(pin) {
			await delay();
			if (current === null) {
				throw new ApiError("forbidden");
			}
			const problem = pinProblem(pin);
			if (problem !== null) {
				throw new ApiError(problem === "pin_weak" ? "pin_weak" : "validation_error");
			}
			pins.set(current.phone_e164, pin);
			failures.delete(current.phone_e164);
			current = { ...current, has_pin: true };
			users.set(current.phone_e164, current);
		},

		async updateProfile(displayName) {
			await delay();
			if (current === null) {
				throw new ApiError("forbidden");
			}
			current = { ...current, display_name: displayName };
			users.set(current.phone_e164, current);
			// The prototype's auth knows nothing of shared plans.
			return { ...current, pending_requests: 0 };
		},

		async signOut() {
			await delay();
			current = null;
		},

		async deleteAccount() {
			await delay();
			if (current === null) {
				throw new ApiError("forbidden");
			}
			users.delete(current.phone_e164);
			pins.delete(current.phone_e164);
			current = null;
		},

		// The prototype keeps nothing between launches (ADR-016).
		restore() {
			if (signedIn) {
				current = users.get(DEMO_USER.phone_e164) ?? DEMO_USER;
			}
			return Promise.resolve(current === null ? null : { ...current });
		},

		// The prototype sends no pushes.
		registerPushToken() {
			return Promise.resolve();
		},

		unregisterPushToken() {
			return Promise.resolve();
		},
	};
}
