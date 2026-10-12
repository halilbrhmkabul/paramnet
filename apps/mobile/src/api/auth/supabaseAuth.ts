import { normalizePhoneTR } from "@paramnet/shared";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { ApiError } from "../errors";
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
		return {
			id: user.id,
			phone_e164: `+${user.phone ?? ""}`,
			display_name: data?.display_name ?? null,
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
