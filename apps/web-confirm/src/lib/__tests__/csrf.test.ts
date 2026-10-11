import { describe, expect, it } from "vitest";

import { newCsrfToken, sameToken } from "../csrf";

describe("CSRF double-submit token", () => {
	it("is 32 random bytes in base64url", () => {
		const a = newCsrfToken();
		expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(newCsrfToken()).not.toBe(a);
	});

	it("matches only the identical, non-empty token", () => {
		const token = newCsrfToken();
		expect(sameToken(token, token)).toBe(true);
		expect(sameToken(token, newCsrfToken())).toBe(false);
		expect(sameToken(token, undefined)).toBe(false);
		expect(sameToken("", "")).toBe(false);
		expect(sameToken(token, token.slice(1))).toBe(false);
	});
});
