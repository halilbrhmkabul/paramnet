/// <reference lib="dom" />
// Logic of pin-login and pin-set (ADR-046, ADR-049) with its I/O injected; web platform APIs only, so
// packages/shared tests it with Vitest (pin.contract.test.ts).
export type PinProblem = "pin_format" | "pin_weak";

const ASCENDING = "0123456789";
const DESCENDING = "9876543210";

// Same rule as packages/shared pinProblem (checked by pin.contract.test.ts).
export function pinProblem(pin: string): PinProblem | null {
	if (!/^[0-9]{6}$/.test(pin)) {
		return "pin_format";
	}
	const repeated = pin === (pin[0] ?? "").repeat(6);
	const run = ASCENDING.includes(pin) || DESCENDING.includes(pin);
	return repeated || run ? "pin_weak" : null;
}

function base64url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Auth stores this instead of the PIN: without the server secret no one can sign in to Auth directly,
// so every PIN attempt passes through pin-login's lock.
export async function derivePinPassword(pin: string, pepper: string): Promise<string> {
	if (pepper.length < 32) {
		throw new Error("PIN_PEPPER is not configured");
	}
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(pepper),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`paramnet-pin:v1:${pin}`));
	return base64url(new Uint8Array(mac));
}

export type PinSession = { access_token: string; refresh_token: string; expires_in: number };
export type LockState = { locked: boolean; attempts_left?: number; retry_after_s?: number };
export type SignInResult =
	| { ok: true; session: PinSession }
	| { ok: false; reason: "invalid_credentials" | "rate_limited" };
export type FunctionResult = { status: number; body: Record<string, unknown> };

// normalizePhone is invite.ts's normalizePhoneTR, passed in so packages/shared can typecheck this file.
export type PinLoginDeps = {
	pepper: string;
	normalizePhone: (input: string) => string | null;
	check: (phone: string) => Promise<LockState>;
	record: (phone: string, ok: boolean) => Promise<LockState>;
	signIn: (phone: string, password: string) => Promise<SignInResult>;
};

function locked(state: LockState): FunctionResult {
	return {
		status: 423,
		body: { error: "account_locked", retry_after_s: state.retry_after_s ?? 900 },
	};
}

export async function pinLogin(
	input: { phone: string; pin: string },
	deps: PinLoginDeps,
): Promise<FunctionResult> {
	const phone = deps.normalizePhone(input.phone);
	if (phone === null) {
		return { status: 400, body: { error: "invalid_phone" } };
	}
	// The app never sends a malformed PIN; such a request cannot match and is not worth a try.
	if (pinProblem(input.pin) === "pin_format") {
		return { status: 400, body: { error: "validation_error" } };
	}
	const before = await deps.check(phone);
	if (before.locked) {
		return locked(before);
	}
	const result = await deps.signIn(phone, await derivePinPassword(input.pin, deps.pepper));
	if (result.ok) {
		await deps.record(phone, true);
		return { status: 200, body: { session: result.session } };
	}
	if (result.reason === "rate_limited") {
		return { status: 429, body: { error: "rate_limited" } };
	}
	// An unknown number counts like a wrong PIN, so the answer does not tell whether it has an account.
	const after = await deps.record(phone, false);
	if (after.locked) {
		return locked(after);
	}
	return {
		status: 401,
		body: { error: "invalid_credentials", attempts_left: after.attempts_left ?? 0 },
	};
}

export type PinSetDeps = {
	pepper: string;
	setPassword: (userId: string, password: string) => Promise<void>;
	markSet: (userId: string, phone: string) => Promise<void>;
};

// Auth keeps the phone without "+".
export async function pinSet(
	user: { id: string; phone: string },
	pin: string,
	deps: PinSetDeps,
): Promise<FunctionResult> {
	const problem = pinProblem(pin);
	if (problem !== null) {
		return {
			status: 400,
			body: { error: problem === "pin_weak" ? "pin_weak" : "validation_error" },
		};
	}
	await deps.setPassword(user.id, await derivePinPassword(pin, deps.pepper));
	await deps.markSet(user.id, `+${user.phone.replace(/^\+/, "")}`);
	return { status: 200, body: { pin_set: true } };
}
