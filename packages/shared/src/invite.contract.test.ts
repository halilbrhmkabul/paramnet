import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

// Pure helpers of the invite edge functions (supabase/functions/_shared/invite.ts), run under Node's
// WebCrypto here and Deno's in the functions.
import {
	TEST_OTP_CODE,
	generateOtp,
	hashIp,
	normalizePhoneTR as edgeNormalizePhoneTR,
	signSession,
	verifySession,
	verifyTurnstile,
} from "../../../supabase/functions/_shared/invite";

import { normalizePhoneTR } from "./schemas";

const secret = "x".repeat(32);

describe("normalizePhoneTR (edge copy)", () => {
	it("matches the app's rule", () => {
		for (const input of [
			"+905551234567",
			"0 (555) 123 45 67",
			"905551234567",
			"5551234567",
			"+15551234567",
			"",
			"05551234567a",
		]) {
			expect(edgeNormalizePhoneTR(input)).toBe(normalizePhoneTR(input));
		}
		fc.assert(
			fc.property(
				fc.string({
					unit: fc.constantFrom("0", "5", "9", "+", " ", "-", "(", ")", "1", "a"),
				}),
				(input) => {
					expect(edgeNormalizePhoneTR(input)).toBe(normalizePhoneTR(input));
				},
			),
		);
	});
});

describe("generateOtp", () => {
	it("is six random digits", () => {
		const codes = new Set(
			Array.from({ length: 200 }, () => generateOtp("+905321234567", false)),
		);
		for (const code of codes) {
			expect(code).toMatch(/^\d{6}$/);
		}
		expect(codes.size).toBeGreaterThan(190);
	});

	it("uses the fixed test code only for the local test numbers in test mode", () => {
		expect(generateOtp("+905550000002", true)).toBe(TEST_OTP_CODE);
		expect(generateOtp("+905321234567", true)).not.toBe(TEST_OTP_CODE);
		expect(generateOtp("+905550000002", false)).toMatch(/^\d{6}$/);
	});
});

describe("approval session (15 minutes, signed)", () => {
	const now = new Date("2026-10-12T10:00:00Z");

	it("round-trips the invite and the verified number", async () => {
		const token = await signSession({ invite_id: "i1", phone: "+905550000002" }, secret, now);
		expect(await verifySession(token, secret, now)).toEqual({
			invite_id: "i1",
			phone: "+905550000002",
		});
	});

	it("expires after 15 minutes", async () => {
		const token = await signSession({ invite_id: "i1", phone: "+905550000002" }, secret, now);
		expect(
			await verifySession(token, secret, new Date(now.getTime() + 14 * 60_000)),
		).not.toBeNull();
		expect(
			await verifySession(token, secret, new Date(now.getTime() + 15 * 60_000 + 1)),
		).toBeNull();
	});

	it("rejects tampering, another secret and garbage", async () => {
		const token = await signSession({ invite_id: "i1", phone: "+905550000002" }, secret, now);
		const [payload, signature] = token.split(".");
		const forged = btoa(JSON.stringify({ invite_id: "i2", phone: "+905550000002", exp: 9e15 }))
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");
		expect(await verifySession(`${forged}.${signature ?? ""}`, secret, now)).toBeNull();
		expect(await verifySession(token, "y".repeat(32), now)).toBeNull();
		expect(await verifySession(payload ?? "", secret, now)).toBeNull();
		expect(await verifySession("a.b.c", secret, now)).toBeNull();
	});

	it("refuses a short secret", async () => {
		await expect(
			signSession({ invite_id: "i1", phone: "+905550000002" }, "short", now),
		).rejects.toThrow();
	});
});

describe("hashIp", () => {
	it("is a stable keyed hash, never the address itself", async () => {
		const a = await hashIp("203.0.113.7", secret);
		expect(a).toMatch(/^[0-9a-f]{64}$/);
		expect(a).toBe(await hashIp("203.0.113.7", secret));
		expect(a).not.toBe(await hashIp("203.0.113.8", secret));
		expect(a).not.toContain("203");
	});
});

describe("verifyTurnstile", () => {
	it("posts the token to Cloudflare and accepts only success", async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));
		await expect(verifyTurnstile("tok", "secret", "1.2.3.4", fetcher)).resolves.toBe(true);
		const [url, init] = fetcher.mock.calls[0] as [string, { body: string }];
		expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
		expect(init.body).toContain("response=tok");

		fetcher.mockResolvedValue(new Response(JSON.stringify({ success: false })));
		await expect(verifyTurnstile("tok", "secret", "1.2.3.4", fetcher)).resolves.toBe(false);
		fetcher.mockRejectedValue(new Error("down"));
		await expect(verifyTurnstile("tok", "secret", "1.2.3.4", fetcher)).resolves.toBe(false);
		await expect(verifyTurnstile("", "secret", "1.2.3.4", fetcher)).resolves.toBe(false);
	});
});
