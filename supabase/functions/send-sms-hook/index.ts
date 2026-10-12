// Supabase Auth Send SMS Hook (spec 10.4 "send-sms-hook", F3-04): Auth hands the sign-in code to this
// function instead of a built-in provider; it goes out through the Turkish provider (sms.ts). The request
// is signed with the hook secret (Standard Webhooks); anything unsigned is refused.
import { Webhook } from "npm:standardwebhooks@1.0.0";

import { env, json } from "../_shared/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { otpMessage, parseSmsHookPayload } from "../_shared/sms.ts";
import { sendOtpSms } from "../_shared/smsSender.ts";

// The error shape Auth shows to the client.
function hookError(status: number, message: string): Response {
	return json(status, { error: { http_code: status, message } });
}

Deno.serve(
	withSentry("send-sms-hook", async (request) => {
		if (request.method !== "POST") {
			return hookError(405, "method_not_allowed");
		}
		const secret = env("SEND_SMS_HOOK_SECRET");
		if (secret === undefined) {
			throw new Error("SEND_SMS_HOOK_SECRET is not configured");
		}
		const body = await request.text();
		let payload: unknown;
		try {
			payload = new Webhook(secret.replace(/^v1,whsec_/, "")).verify(
				body,
				Object.fromEntries(request.headers),
			);
		} catch {
			return hookError(401, "invalid_signature");
		}
		const parsed = parseSmsHookPayload(payload);
		if (parsed === null) {
			return hookError(400, "invalid_phone");
		}
		const outcome = await sendOtpSms(parsed.phone, otpMessage(parsed.otp), "auth");
		return outcome === "sent"
			? json(200, {})
			: outcome === "limited"
				? hookError(429, "rate_limited")
				: hookError(503, "sms_unavailable");
	}),
);
