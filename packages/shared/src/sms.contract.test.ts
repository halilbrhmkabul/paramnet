import { describe, expect, it } from "vitest";

// Pure SMS layer of the edge functions (supabase/functions/_shared/sms.ts): provider choice, message
// text, phone masking and the Netgsm request/response mapping (F3-04, ADR-040).
import {
	isTestNumber,
	maskPhone,
	netgsmOtpRequest,
	otpMessage,
	parseNetgsmResponse,
	parseSmsHookPayload,
	smsMode,
} from "../../../supabase/functions/_shared/sms";

describe("smsMode", () => {
	it.each([
		["test", "test"],
		["log", "log"],
		["netgsm", "netgsm"],
		[undefined, "off"],
		["", "off"],
		["twilio", "off"],
	])("%s → %s", (value, mode) => {
		expect(smsMode(value)).toBe(mode);
	});
});

describe("message and logs", () => {
	it("says what the code is for and that it must not be shared", () => {
		expect(otpMessage("482913")).toBe(
			"Paramnet doğrulama kodun: 482913. Bu kodu kimseyle paylaşma.",
		);
	});

	it("masks the number for logs (security.md)", () => {
		expect(maskPhone("+905551234567")).toBe("+90******4567");
		expect(maskPhone("bozuk")).toBe("***");
	});

	it("knows the local test numbers", () => {
		expect(isTestNumber("+905550000001")).toBe(true);
		expect(isTestNumber("+905551234567")).toBe(false);
	});
});

describe("Netgsm OTP request (to be confirmed against the provider's docs before go-live)", () => {
	const config = { usercode: "8501234567", password: "p<&>", header: "PARAMNET" };

	it("posts XML with credentials in the body, the national number and the message", () => {
		const request = netgsmOtpRequest(config, "+905551234567", "Kod: 123456");
		expect(request.url).toBe("https://api.netgsm.com.tr/sms/send/otp");
		expect(request.method).toBe("POST");
		expect(request.headers).toEqual({ "content-type": "application/xml; charset=utf-8" });
		expect(request.body).toContain("<usercode>8501234567</usercode>");
		expect(request.body).toContain("<password>p&lt;&amp;&gt;</password>");
		expect(request.body).toContain("<msgheader>PARAMNET</msgheader>");
		expect(request.body).toContain("<no>5551234567</no>");
		expect(request.body).toContain("<msg><![CDATA[Kod: 123456]]></msg>");
	});

	it("never lets the message close its CDATA block", () => {
		const request = netgsmOtpRequest(config, "+905551234567", "a]]>b");
		expect(request.body).toContain("<msg><![CDATA[a]]]]><![CDATA[>b]]></msg>");
	});

	it("refuses a number that is not a Turkish mobile", () => {
		expect(() => netgsmOtpRequest(config, "+15551234567", "x")).toThrow("invalid_phone");
	});
});

describe("Netgsm OTP response", () => {
	it("code 0 is sent, with the job id", () => {
		expect(
			parseNetgsmResponse(
				200,
				"<xml><main><code>0</code><jobID>1310546758</jobID></main></xml>",
			),
		).toEqual({
			ok: true,
			id: "1310546758",
		});
	});

	it.each([
		["30", false],
		["40", false],
		["41", false],
		["60", false],
		["70", false],
		["80", true],
		["100", true],
	])("code %s is a failure (retryable: %s)", (code, retryable) => {
		expect(parseNetgsmResponse(200, `<xml><main><code>${code}</code></main></xml>`)).toEqual({
			ok: false,
			code,
			retryable,
		});
	});

	it("an HTTP error or an unreadable body is a retryable failure", () => {
		expect(parseNetgsmResponse(502, "")).toEqual({
			ok: false,
			code: "http_502",
			retryable: true,
		});
		expect(parseNetgsmResponse(200, "<html>")).toEqual({
			ok: false,
			code: "unreadable",
			retryable: true,
		});
	});
});

describe("Send SMS Hook payload (Supabase Auth)", () => {
	it("takes the number (GoTrue stores it without +) and the code", () => {
		expect(
			parseSmsHookPayload({
				user: { id: "u1", phone: "905551234567" },
				sms: { otp: "482913" },
			}),
		).toEqual({
			phone: "+905551234567",
			otp: "482913",
		});
	});

	it.each([
		[null],
		[{}],
		[{ user: { phone: "15551234567" }, sms: { otp: "482913" } }],
		[{ user: { phone: "905551234567" }, sms: { otp: "12ab" } }],
		[{ user: { phone: "905551234567" }, sms: {} }],
	])("refuses %j", (payload) => {
		expect(parseSmsHookPayload(payload)).toBeNull();
	});
});
