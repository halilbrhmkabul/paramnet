// W01 → W02: Turnstile + rate limits, then a one-time code to the invite's number (spec 11.2).
import { generateOtp, hashIp, normalizePhoneTR, verifyTurnstile } from "../_shared/invite.ts";
import {
	clientIp,
	env,
	json,
	readBody,
	rpcError,
	serviceClient,
	sessionSecret,
	text,
} from "../_shared/server.ts";
import { withSentry } from "../_shared/sentry.ts";

// No SMS provider until F3-04: test mode only lets the local test numbers through, with code 123456.
async function sendSms(phone: string, code: string): Promise<boolean> {
	if (env("SMS_MODE") === "test") {
		return code === "123456";
	}
	console.error("invite-otp-send: no SMS provider configured");
	return false;
}

Deno.serve(
	withSentry("invite-otp-send", async (request) => {
		if (request.method !== "POST") {
			return json(405, { error: "method_not_allowed" });
		}
		const body = await readBody(request);
		if (body === null) {
			return json(400, { error: "validation_error" });
		}
		const ip = clientIp(request);
		if (env("TURNSTILE_DISABLED") !== "1") {
			const secret = env("TURNSTILE_SECRET_KEY");
			if (
				secret === undefined ||
				!(await verifyTurnstile(text(body, "turnstile_token"), secret, ip))
			) {
				return json(403, { error: "turnstile_failed" });
			}
		}
		const phone = normalizePhoneTR(text(body, "phone"));
		if (phone === null) {
			return json(400, { error: "invalid_phone" });
		}
		const code = generateOtp(phone, env("SMS_MODE") === "test");
		const { data, error } = await serviceClient().rpc("invite_send_otp", {
			p_token: text(body, "token"),
			p_phone: phone,
			p_code: code,
			p_ip_hash: await hashIp(ip, sessionSecret()),
		});
		if (error) {
			return rpcError(error);
		}
		const result = data as { send: boolean };
		if (result.send && !(await sendSms(phone, code))) {
			return json(503, { error: "sms_unavailable" });
		}
		// Same answer whether or not the number was the invite's target (no probing).
		return json(200, { sent: true });
	}),
);
