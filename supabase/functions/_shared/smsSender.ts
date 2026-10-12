// Deno-only sending for the SMS layer (sms.ts): reads SMS_MODE and the provider secrets, calls the
// provider, reports failures to Sentry without the number or the code (F3-04, ADR-040).
import { reportError } from "./sentry.ts";
import { env, serviceClient } from "./server.ts";
import { isTestNumber, maskPhone, netgsmOtpRequest, parseNetgsmResponse, smsMode } from "./sms.ts";

// The function log may only ever show a code on the local stack.
function isLocalStack(): boolean {
	return /^http:\/\/(kong|localhost|127\.0\.0\.1|host\.docker\.internal)(:\d+)?$/.test(
		env("SUPABASE_URL") ?? "",
	);
}

export type SmsChannel = "auth" | "invite";
export type SendOutcome = "sent" | "limited" | "failed";

const DEFAULT_DAILY_LIMIT = 500;

// take_sms_budget (ADR-041): the per-number cap and the daily total, with one alarm at 80 % and one on
// the first refusal. Fails closed: no budget answer, no SMS.
async function takeBudget(channel: SmsChannel, phone: string): Promise<boolean> {
	const limit = Number(env("SMS_DAILY_LIMIT") ?? DEFAULT_DAILY_LIMIT);
	const { data, error } = await serviceClient().rpc("take_sms_budget", {
		p_channel: channel,
		p_phone: phone,
		p_daily_limit: Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_DAILY_LIMIT,
	});
	if (error !== null) {
		await reportError(
			new Error(`sms: budget check failed (${error.code ?? "unknown"})`),
			"sms",
		);
		return false;
	}
	const budget = data as {
		allowed: boolean;
		alarm: "warning" | "exhausted" | null;
		used: number | null;
	};
	if (budget.alarm !== null) {
		await reportError(
			new Error(`sms: daily budget ${budget.alarm} (${String(budget.used)})`),
			"sms-budget",
		);
	}
	return budget.allowed;
}

export async function sendOtpSms(
	phone: string,
	message: string,
	channel: SmsChannel,
): Promise<SendOutcome> {
	const mode = smsMode(env("SMS_MODE"));
	if (mode === "test") {
		// Nothing is sent; the local test numbers use the fixed code.
		return isTestNumber(phone) ? "sent" : "failed";
	}
	if (mode === "off") {
		console.error("sms: no provider configured (SMS_MODE)");
		return "failed";
	}
	if (!(await takeBudget(channel, phone))) {
		return "limited";
	}
	return (await deliver(mode, phone, message)) ? "sent" : "failed";
}

async function deliver(mode: "log" | "netgsm", phone: string, message: string): Promise<boolean> {
	if (mode === "log") {
		if (!isLocalStack()) {
			await reportError(new Error("sms: log mode outside the local stack"), "sms");
			return false;
		}
		console.log(`[sms:log] ${maskPhone(phone)} ${message}`);
		return true;
	}
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
