/// <reference lib="dom" />
// Web platform APIs (WebCrypto, fetch, TextEncoder) as available in Deno and Node 20; no Deno globals,
// so packages/shared can test this file with Vitest (invite.contract.test.ts).

// Same numbers and code as the Supabase Auth test OTPs (supabase/config.toml, ADR-009).
export const TEST_OTP_CODE = "123456";
const TEST_NUMBERS = new Set(["+905550000001", "+905550000002", "+905550000003"]);
const SESSION_TTL_MS = 15 * 60 * 1000;

export type ApprovalSession = { invite_id: string; phone: string };

// Same rule as packages/shared normalizePhoneTR (checked by invite.contract.test.ts).
export function normalizePhoneTR(input: string): string | null {
	const match = /^(?:\+90|90|0)?(5\d{9})$/.exec(input.replace(/[\s\-().]/g, ""));
	return match?.[1] === undefined ? null : `+90${match[1]}`;
}

// Six digits from a CSPRNG without modulo bias.
export function generateOtp(phone: string, testMode: boolean): string {
	if (testMode && TEST_NUMBERS.has(phone)) {
		return TEST_OTP_CODE;
	}
	const buffer = new Uint32Array(1);
	const limit = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
	for (;;) {
		crypto.getRandomValues(buffer);
		const value = buffer[0] ?? limit;
		if (value < limit) {
			return String(value % 1_000_000).padStart(6, "0");
		}
	}
}

function base64url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(text: string): Uint8Array<ArrayBuffer> | null {
	if (!/^[A-Za-z0-9_-]*$/.test(text)) {
		return null;
	}
	try {
		const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
		return Uint8Array.from(binary, (char) => char.charCodeAt(0));
	} catch {
		return null;
	}
}

async function hmacKey(secret: string): Promise<CryptoKey> {
	if (secret.length < 32) {
		throw new Error("INVITE_SESSION_SECRET must be at least 32 characters");
	}
	return crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

// payload.signature, both base64url; the web app keeps it in an HttpOnly cookie (F2-04).
export async function signSession(
	session: ApprovalSession,
	secret: string,
	now: Date = new Date(),
): Promise<string> {
	const payload = base64url(
		new TextEncoder().encode(
			JSON.stringify({ ...session, exp: now.getTime() + SESSION_TTL_MS }),
		),
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		await hmacKey(secret),
		new TextEncoder().encode(payload),
	);
	return `${payload}.${base64url(new Uint8Array(signature))}`;
}

export async function verifySession(
	token: string,
	secret: string,
	now: Date = new Date(),
): Promise<ApprovalSession | null> {
	const parts = token.split(".");
	if (parts.length !== 2) {
		return null;
	}
	const [payload = "", signatureText = ""] = parts;
	const signature = fromBase64url(signatureText);
	if (signature === null) {
		return null;
	}
	// subtle.verify compares in constant time.
	const valid = await crypto.subtle.verify(
		"HMAC",
		await hmacKey(secret),
		signature,
		new TextEncoder().encode(payload),
	);
	const bytes = fromBase64url(payload);
	if (!valid || bytes === null) {
		return null;
	}
	try {
		const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
		if (
			typeof data === "object" &&
			data !== null &&
			"invite_id" in data &&
			"phone" in data &&
			"exp" in data &&
			typeof data.invite_id === "string" &&
			typeof data.phone === "string" &&
			typeof data.exp === "number" &&
			data.exp >= now.getTime()
		) {
			return { invite_id: data.invite_id, phone: data.phone };
		}
	} catch {
		// fall through
	}
	return null;
}

// Evidence for the event log without storing the address (spec 10.1 ip_hash).
export async function hashIp(ip: string, secret: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(`${secret}:${ip}`),
	);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

export async function verifyTurnstile(
	token: string,
	secret: string,
	ip: string,
	fetcher: typeof fetch = fetch,
): Promise<boolean> {
	if (token === "") {
		return false;
	}
	try {
		const response = await fetcher(
			"https://challenges.cloudflare.com/turnstile/v0/siteverify",
			{
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({ secret, response: token, remoteip: ip }).toString(),
			},
		);
		const result = (await response.json()) as { success?: boolean };
		return result.success === true;
	} catch {
		return false;
	}
}
