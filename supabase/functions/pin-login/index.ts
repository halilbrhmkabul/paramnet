// Sign-in with phone + 6-digit PIN (ADR-046). The only way to use a PIN: Auth holds a password derived
// with PIN_PEPPER, and this function counts failures and locks the number (5 in 15 min → 15 min, ADR-049).
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

import { normalizePhoneTR } from "../_shared/invite.ts";
import { pinLogin, type LockState } from "../_shared/pin.ts";
import { env, json, pinPepper, readBody, serviceClient, text } from "../_shared/server.ts";
import { withSentry } from "../_shared/sentry.ts";

Deno.serve(
	withSentry("pin-login", async (request) => {
		if (request.method !== "POST") {
			return json(405, { error: "method_not_allowed" });
		}
		const body = await readBody(request);
		if (body === null) {
			return json(400, { error: "validation_error" });
		}
		const service = serviceClient();
		async function lockRpc(name: string, args: Record<string, unknown>): Promise<LockState> {
			const { data, error } = await service.rpc(name, args);
			if (error !== null) {
				throw new Error(`rpc ${name}: ${error.code ?? "unknown"}`);
			}
			return data as LockState;
		}
		const result = await pinLogin(
			{ phone: text(body, "phone"), pin: text(body, "pin") },
			{
				pepper: pinPepper(),
				normalizePhone: normalizePhoneTR,
				check: (phone) => lockRpc("pin_login_check", { p_phone: phone }),
				record: (phone, ok) => lockRpc("pin_login_record", { p_phone: phone, p_ok: ok }),
				async signIn(phone, password) {
					// A fresh client per request: the session goes back to the app, never kept here.
					const auth = createClient(
						env("SUPABASE_URL") ?? "",
						env("SUPABASE_ANON_KEY") ?? "",
						{
							auth: { persistSession: false, autoRefreshToken: false },
						},
					);
					const { data, error } = await auth.auth.signInWithPassword({ phone, password });
					if (error === null && data.session !== null) {
						const { access_token, refresh_token, expires_in } = data.session;
						return { ok: true, session: { access_token, refresh_token, expires_in } };
					}
					if (error?.status === 429) {
						return { ok: false, reason: "rate_limited" };
					}
					if (error?.status === 400) {
						return { ok: false, reason: "invalid_credentials" };
					}
					throw error ?? new Error("sign-in returned no session");
				},
			},
		);
		return json(result.status, result.body);
	}),
);
