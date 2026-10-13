import { normalizePhoneTR } from "@paramnet/shared";

import { ApiError } from "../errors";
import type { AuthApi, AuthUser } from "./AuthApi";

// Same code as the local Supabase test numbers (CLAUDE.md), so muscle memory carries over.
export const MOCK_OTP_CODE = "123456";
const OTP_TTL_MS = 3 * 60 * 1000;
const RESEND_AFTER_S = 60;

// signedIn: the prototype starts with a demo account (design QA in the simulator, F4-01).
export type MockAuthOptions = { now?: () => Date; latencyMs?: number; signedIn?: boolean };

export const DEMO_USER: AuthUser = {
	id: "u-demo",
	phone_e164: "+905550000001",
	display_name: "Deniz Yılmaz",
};

export function createMockAuthApi({
	now = () => new Date(),
	latencyMs = 300,
	signedIn = false,
}: MockAuthOptions = {}): AuthApi {
	const sentAt = new Map<string, number>();
	const users = new Map<string, AuthUser>();
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
			};
			users.set(phone, user);
			current = user;
			return { ...user };
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
			current = null;
		},

		// The prototype keeps nothing between launches (ADR-016).
		restore() {
			if (signedIn) {
				current = DEMO_USER;
				users.set(DEMO_USER.phone_e164, DEMO_USER);
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
