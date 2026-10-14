import { normalizePhoneTR } from "@paramnet/shared";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { ApiError, type ApiErrorCode } from "../errors";
import { toApiError } from "../supabase/toApiError";
import type { AuthApi, AuthUser, ProfileResult } from "./AuthApi";
import { KVKK_VERSION, TERMS_VERSION } from "@/lib/legal";

const RESEND_AFTER_S = 60;

function phoneOrThrow(input: string): string {
	const phone = normalizePhoneTR(input);
	if (phone === null) {
		throw new ApiError("invalid_phone");
	}
	return phone;
}

// Codes pin-login and pin-set answer with (supabase/functions/_shared/pin.ts).
const FUNCTION_CODES: readonly ApiErrorCode[] = [
	"invalid_credentials",
	"account_locked",
	"pin_weak",
	"invalid_phone",
	"validation_error",
	"rate_limited",
];

function numberField(body: Record<string, unknown>, key: string): number | undefined {
	const value = body[key];
	return typeof value === "number" ? value : undefined;
}

// supabase-js reports a non-2xx function answer as an error whose context is the Response.
async function functionError(error: unknown): Promise<ApiError | Error> {
	const context: unknown =
		typeof error === "object" && error !== null && "context" in error
			? error.context
			: undefined;
	if (
		typeof context === "object" &&
		context !== null &&
		"json" in context &&
		typeof context.json === "function"
	) {
		try {
			const body: unknown = await (context.json as () => Promise<unknown>)();
			if (typeof body === "object" && body !== null && "error" in body) {
				const fields = body as Record<string, unknown>;
				const code = FUNCTION_CODES.find((c) => c === fields.error);
				if (code !== undefined) {
					const attempts_left = numberField(fields, "attempts_left");
					const retry_after_s = numberField(fields, "retry_after_s");
					const details = {
						...(attempts_left === undefined ? {} : { attempts_left }),
						...(retry_after_s === undefined ? {} : { retry_after_s }),
					};
					return new ApiError(
						code,
						Object.keys(details).length > 0 ? details : undefined,
					);
				}
			}
		} catch {
			// Not a JSON answer: fall through to the generic mapping.
		}
	}
	return toApiError(error);
}

function isPinSession(
	value: unknown,
): value is { session: { access_token: string; refresh_token: string } } {
	if (typeof value !== "object" || value === null || !("session" in value)) {
		return false;
	}
	const session: unknown = value.session;
	return (
		typeof session === "object" &&
		session !== null &&
		"access_token" in session &&
		typeof session.access_token === "string" &&
		"refresh_token" in session &&
		typeof session.refresh_token === "string"
	);
}

export function createSupabaseAuthApi(client: SupabaseClient): AuthApi {
	async function toAuthUser(user: User): Promise<AuthUser> {
		// RLS lets a user read only their own profile; no row yet means the profile step is still open.
		const { data, error } = await client
			.from("profiles")
			.select("display_name")
			.maybeSingle<{ display_name: string }>();
		if (error !== null) {
			throw toApiError(error);
		}
		const pin: { data: unknown; error: unknown } = await client.rpc("has_pin");
		if (pin.error !== null) {
			throw toApiError(pin.error);
		}
		return {
			id: user.id,
			phone_e164: `+${user.phone ?? ""}`,
			display_name: data?.display_name ?? null,
			has_pin: pin.data === true,
		};
	}

	return {
		async requestOtp(input) {
			const { error } = await client.auth.signInWithOtp({ phone: phoneOrThrow(input) });
			if (error !== null) {
				throw toApiError(error);
			}
			return { resend_after_s: RESEND_AFTER_S };
		},

		async verifyOtp(input, code) {
			const { data, error } = await client.auth.verifyOtp({
				phone: phoneOrThrow(input),
				token: code,
				type: "sms",
			});
			if (error !== null || data.user === null) {
				throw toApiError(error);
			}
			return toAuthUser(data.user);
		},

		async signInWithPin(input, pin) {
			const response: { data: unknown; error: unknown } = await client.functions.invoke(
				"pin-login",
				{ body: { phone: phoneOrThrow(input), pin } },
			);
			if (response.error !== null) {
				throw await functionError(response.error);
			}
			if (!isPinSession(response.data)) {
				throw new Error("pin-login returned no session");
			}
			const { access_token, refresh_token } = response.data.session;
			const { data, error } = await client.auth.setSession({ access_token, refresh_token });
			if (error !== null || data.user === null) {
				throw toApiError(error);
			}
			return toAuthUser(data.user);
		},

		async setPin(pin) {
			// The function reads the user from the session's JWT; supabase-js attaches it.
			const response: { error: unknown } = await client.functions.invoke("pin-set", {
				body: { pin },
			});
			if (response.error !== null) {
				throw await functionError(response.error);
			}
		},

		async updateProfile(displayName) {
			// complete_profile returns { id, display_name, phone_e164, pending_requests } (060, 150 tests).
			const response: { data: unknown; error: unknown } = await client.rpc(
				"complete_profile",
				{
					p_display_name: displayName,
					p_kvkk_version: KVKK_VERSION,
					p_terms_version: TERMS_VERSION,
				},
			);
			if (response.error !== null) {
				throw toApiError(response.error);
			}
			return response.data as ProfileResult;
		},

		async signOut() {
			await client.auth.signOut();
		},

		async deleteAccount() {
			// The function reads the user from the session's JWT; supabase-js attaches it.
			const response: { error: unknown } = await client.functions.invoke("delete-account", {
				method: "POST",
			});
			if (response.error !== null) {
				throw toApiError(response.error);
			}
			// The server session is gone with the account; only the local copy remains to clear.
			await client.auth.signOut({ scope: "local" });
		},

		async registerPushToken(token, platform) {
			const response: { error: unknown } = await client.rpc("register_push_token", {
				p_token: token,
				p_platform: platform,
			});
			if (response.error !== null) {
				throw toApiError(response.error);
			}
		},

		async unregisterPushToken(token) {
			const response: { error: unknown } = await client.rpc("unregister_push_token", {
				p_token: token,
			});
			if (response.error !== null) {
				throw toApiError(response.error);
			}
		},

		async restore() {
			const { data } = await client.auth.getSession();
			return data.session === null ? null : toAuthUser(data.session.user);
		},
	};
}
