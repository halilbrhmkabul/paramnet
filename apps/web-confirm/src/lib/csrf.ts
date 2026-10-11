import { randomBytes, timingSafeEqual } from "node:crypto";

// Double-submit token: a cookie set by proxy.ts and the same value in every form. Server Actions
// also check the Origin header; this is the explicit "POST + CSRF token" of spec 11.2.
export const CSRF_COOKIE = "pn_csrf";
export const CSRF_FIELD = "csrf";

export function newCsrfToken(): string {
	return randomBytes(32).toString("base64url");
}

export function sameToken(a: string | undefined, b: string | undefined): boolean {
	if (a === undefined || b === undefined || a === "" || a.length !== b.length) {
		return false;
	}
	return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
