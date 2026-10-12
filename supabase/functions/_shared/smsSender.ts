// Deno-only sending for the SMS layer (sms.ts): reads SMS_MODE and the provider secrets, calls the
// provider, reports failures to Sentry without the number or the code (F3-04, ADR-040).
import { reportError } from "./sentry.ts";
import { env } from "./server.ts";
import { isTestNumber, maskPhone, netgsmOtpRequest, parseNetgsmResponse, smsMode } from "./sms.ts";

// The function log may only ever show a code on the local stack.
function isLocalStack(): boolean {
	return /^http:\/\/(kong|localhost|127\.0\.0\.1|host\.docker\.internal)(:\d+)?$/.test(
		env("SUPABASE_URL") ?? "",
	);
}

export async function sendOtpSms(phone: string, message: string): Promise<boolean> {
	const mode = smsMode(env("SMS_MODE"));
	if (mode === "test") {
		// Nothing is sent; the local test numbers use the fixed code.
		return isTestNumber(phone);
	}
	if (mode === "log") {
		if (!isLocalStack()) {
			await reportError(new Error("sms: log mode outside the local stack"), "sms");
			return false;
		}
		console.log(`[sms:log] ${maskPhone(phone)} ${message}`);
		return true;
	}
	if (mode === "netgsm") {
		const usercode = env("NETGSM_USERCODE");
		const password = env("NETGSM_PASSWORD");
		const header = env("NETGSM_HEADER");
		if (usercode === undefined || password === undefined || header === undefined) {
			await reportError(new Error("sms: netgsm is not configured"), "sms");
			return false;
		}
		const request = netgsmOtpRequest({ usercode, password, header }, phone, message);
		try {
			const response = await fetch(request.url, {
				method: request.method,
				headers: request.headers,
				body: request.body,
				signal: AbortSignal.timeout(10_000),
			});
			const result = parseNetgsmResponse(response.status, await response.text());
			if (!result.ok) {
				await reportError(new Error(`sms: netgsm ${result.code}`), "sms");
			}
			return result.ok;
		} catch (error) {
			await reportError(error, "sms");
			return false;
		}
	}
	console.error("sms: no provider configured (SMS_MODE)");
	return false;
}
