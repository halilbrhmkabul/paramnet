import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

// Pure logic of the pin-login and pin-set edge functions (supabase/functions/_shared/pin.ts), run under
// Node's WebCrypto here and Deno's in the functions.
import {
	derivePinPassword,
	pinLogin,
	pinProblem as edgePinProblem,
	pinSet,
	type PinLoginDeps,
	type PinSetDeps,
} from "../../../supabase/functions/_shared/pin";
import { normalizePhoneTR } from "../../../supabase/functions/_shared/invite";

import { pinProblem } from "./pin";

const pepper = "p".repeat(32);
const session = { access_token: "at", refresh_token: "rt", expires_in: 3600 };

function loginDeps(overrides: Partial<PinLoginDeps> = {}): PinLoginDeps {
	return {
		pepper,
		normalizePhone: normalizePhoneTR,
		check: vi.fn(() => Promise.resolve({ locked: false })),
		record: vi.fn((_phone: string, ok: boolean) =>
			Promise.resolve(
				ok ? { locked: false, attempts_left: 5 } : { locked: false, attempts_left: 4 },
			),
		),
		signIn: vi.fn(() => Promise.resolve({ ok: true as const, session })),
		...overrides,
	};
}

describe("pinProblem (edge copy)", () => {
	it("matches the app's rule", () => {
		fc.assert(
			fc.property(
				fc.string({
					unit: fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a"),
				}),
				(pin) => {
					expect(edgePinProblem(pin)).toBe(pinProblem(pin));
				},
			),
		);
	});
});

describe("derivePinPassword", () => {
	it("is a fixed HMAC of the PIN under the server secret", async () => {
		const password = await derivePinPassword("482915", pepper);
		expect(password).toBe(await derivePinPassword("482915", pepper));
		expect(password).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(password).not.toContain("482915");
		expect(await derivePinPassword("482916", pepper)).not.toBe(password);
		expect(await derivePinPassword("482915", "q".repeat(32))).not.toBe(password);
	});

	it("refuses a short secret", async () => {
		await expect(derivePinPassword("482915", "short")).rejects.toThrow();
	});
});

describe("pinLogin", () => {
	it("signs in with the derived password and clears the count", async () => {
		const deps = loginDeps();
		const result = await pinLogin({ phone: "0555 000 00 01", pin: "482915" }, deps);
		expect(result).toEqual({ status: 200, body: { session } });
		expect(deps.signIn).toHaveBeenCalledWith(
			"+905550000001",
			await derivePinPassword("482915", pepper),
		);
		expect(deps.record).toHaveBeenCalledWith("+905550000001", true);
	});

	it("rejects a bad number or PIN format without counting", async () => {
		const deps = loginDeps();
		expect(await pinLogin({ phone: "123", pin: "482915" }, deps)).toEqual({
			status: 400,
			body: { error: "invalid_phone" },
		});
		expect(await pinLogin({ phone: "+905550000001", pin: "48291" }, deps)).toEqual({
			status: 400,
			body: { error: "validation_error" },
		});
		expect(deps.record).not.toHaveBeenCalled();
		expect(deps.signIn).not.toHaveBeenCalled();
	});

	it("does not try the PIN while the number is locked", async () => {
		const deps = loginDeps({
			check: vi.fn(() => Promise.resolve({ locked: true, retry_after_s: 600 })),
		});
		expect(await pinLogin({ phone: "+905550000001", pin: "482915" }, deps)).toEqual({
			status: 423,
			body: { error: "account_locked", retry_after_s: 600 },
		});
		expect(deps.signIn).not.toHaveBeenCalled();
	});

	it("counts a wrong PIN and says how many tries are left", async () => {
		const deps = loginDeps({
			signIn: vi.fn(() =>
				Promise.resolve({ ok: false as const, reason: "invalid_credentials" as const }),
			),
		});
		expect(await pinLogin({ phone: "+905550000001", pin: "482915" }, deps)).toEqual({
			status: 401,
			body: { error: "invalid_credentials", attempts_left: 4 },
		});
		expect(deps.record).toHaveBeenCalledWith("+905550000001", false);
	});

	it("locks on the fifth wrong PIN", async () => {
		const deps = loginDeps({
			signIn: vi.fn(() =>
				Promise.resolve({ ok: false as const, reason: "invalid_credentials" as const }),
			),
			record: vi.fn(() =>
				Promise.resolve({ locked: true, attempts_left: 0, retry_after_s: 900 }),
			),
		});
		expect(await pinLogin({ phone: "+905550000001", pin: "482915" }, deps)).toEqual({
			status: 423,
			body: { error: "account_locked", retry_after_s: 900 },
		});
	});

	it("passes Auth's own rate limit through without counting it", async () => {
		const deps = loginDeps({
			signIn: vi.fn(() =>
				Promise.resolve({ ok: false as const, reason: "rate_limited" as const }),
			),
		});
		expect(await pinLogin({ phone: "+905550000001", pin: "482915" }, deps)).toEqual({
			status: 429,
			body: { error: "rate_limited" },
		});
		expect(deps.record).not.toHaveBeenCalled();
	});
});

describe("pinSet", () => {
	function setDeps(): PinSetDeps {
		return {
			pepper,
			setPassword: vi.fn(() => Promise.resolve()),
			markSet: vi.fn(() => Promise.resolve()),
		};
	}
	const user = { id: "u1", phone: "905550000001" };

	it("stores the derived password and records the PIN", async () => {
		const deps = setDeps();
		expect(await pinSet(user, "482915", deps)).toEqual({
			status: 200,
			body: { pin_set: true },
		});
		expect(deps.setPassword).toHaveBeenCalledWith(
			"u1",
			await derivePinPassword("482915", pepper),
		);
		expect(deps.markSet).toHaveBeenCalledWith("u1", "+905550000001");
	});

	it("refuses a weak or malformed PIN", async () => {
		const deps = setDeps();
		expect(await pinSet(user, "123456", deps)).toEqual({
			status: 400,
			body: { error: "pin_weak" },
		});
		expect(await pinSet(user, "12a456", deps)).toEqual({
			status: 400,
			body: { error: "validation_error" },
		});
		expect(deps.setPassword).not.toHaveBeenCalled();
	});
});
