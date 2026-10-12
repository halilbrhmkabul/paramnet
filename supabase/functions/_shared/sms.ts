// Pure SMS layer shared by send-sms-hook (Supabase Auth OTP) and invite-otp-send (web OTP): which provider,
// what the message says, and how a provider's request and answer look. No Deno globals, so packages/shared
// tests it (sms.contract.test.ts). Swapping providers means adding an adapter here (spec 8, ADR-040).

export type SmsMode = "off" | "test" | "log" | "netgsm";

// test: nothing is sent; only the local test numbers (fixed code) get through.
// log: development only; the message is written to the function log instead of being sent.
export function smsMode(value: string | undefined): SmsMode {
	return value === "test" || value === "log" || value === "netgsm" ? value : "off";
}

const TEST_NUMBERS = new Set(["+905550000001", "+905550000002", "+905550000003"]);

export function isTestNumber(phone: string): boolean {
	return TEST_NUMBERS.has(phone);
}

export function otpMessage(code: string): string {
	return `Paramnet doğrulama kodun: ${code}. Bu kodu kimseyle paylaşma.`;
}

// Logs never carry a full number (security.md "Kişisel veri").
export function maskPhone(phone: string): string {
	return /^\+90\d{10}$/.test(phone) ? `+90******${phone.slice(-4)}` : "***";
}

// Netgsm -------------------------------------------------------------------------------------------------
// OTP endpoint as described in Netgsm's integration guide; confirm field names and codes against the
// provider documentation with the first real account before go-live (ADR-040).

export type NetgsmConfig = { usercode: string; password: string; header: string };
export type SmsRequest = {
	url: string;
	method: "POST";
	headers: Record<string, string>;
	body: string;
};
export type SmsResult = { ok: true; id: string } | { ok: false; code: string; retryable: boolean };

function xmlText(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cdata(value: string): string {
	return `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

export function netgsmOtpRequest(config: NetgsmConfig, phone: string, message: string): SmsRequest {
	const match = /^\+90(5\d{9})$/.exec(phone);
	if (match?.[1] === undefined) {
		throw new Error("invalid_phone");
	}
	const body =
		'<?xml version="1.0" encoding="UTF-8"?>' +
		"<mainbody><header>" +
		`<usercode>${xmlText(config.usercode)}</usercode>` +
		`<password>${xmlText(config.password)}</password>` +
		`<msgheader>${xmlText(config.header)}</msgheader>` +
		"</header><body>" +
		`<msg>${cdata(message)}</msg>` +
		`<no>${match[1]}</no>` +
		"</body></mainbody>";
	return {
		url: "https://api.netgsm.com.tr/sms/send/otp",
		method: "POST",
		headers: { "content-type": "application/xml; charset=utf-8" },
		body,
	};
}

// 80 (sending limit) and 100 (system error) may pass on retry; the rest are configuration or input errors.
const RETRYABLE_CODES = new Set(["80", "100"]);

export function parseNetgsmResponse(status: number, body: string): SmsResult {
	if (status < 200 || status >= 300) {
		return { ok: false, code: `http_${String(status)}`, retryable: true };
	}
	const code = /<code>\s*(\d+)\s*<\/code>/i.exec(body)?.[1];
	if (code === undefined) {
		return { ok: false, code: "unreadable", retryable: true };
	}
	if (code === "0" || code === "00") {
		return { ok: true, id: /<jobid>\s*([^<\s]+)\s*<\/jobid>/i.exec(body)?.[1] ?? "" };
	}
	return { ok: false, code, retryable: RETRYABLE_CODES.has(code) };
}

// Send SMS Hook ---------------------------------------------------------------------------------------

function field(value: unknown, key: string): unknown {
	return typeof value === "object" && value !== null
		? (value as Record<string, unknown>)[key]
		: undefined;
}

// Supabase Auth's payload, after its signature was verified: { user: { phone }, sms: { otp } }.
export function parseSmsHookPayload(payload: unknown): { phone: string; otp: string } | null {
	const phone = field(field(payload, "user"), "phone");
	const otp = field(field(payload, "sms"), "otp");
	if (typeof phone !== "string" || typeof otp !== "string" || !/^\d{4,10}$/.test(otp)) {
		return null;
	}
	const match = /^\+?90(5\d{9})$/.exec(phone);
	return match?.[1] === undefined ? null : { phone: `+90${match[1]}`, otp };
}
