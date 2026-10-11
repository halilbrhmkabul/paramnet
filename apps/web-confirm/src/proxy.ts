import { NextResponse, type NextRequest } from "next/server";

import { CSRF_COOKIE } from "@/lib/csrf";

// Per-request CSP nonce (Next applies it to its own scripts) and the CSRF cookie for the forms.
export function proxy(request: NextRequest) {
	const nonce = btoa(crypto.randomUUID());
	const dev = process.env.NODE_ENV !== "production";
	const csp = [
		"default-src 'self'",
		`script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${dev ? " 'unsafe-eval'" : ""}`,
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data:",
		"connect-src 'self'",
		"frame-src https://challenges.cloudflare.com",
		"frame-ancestors 'none'",
		"form-action 'self'",
		"base-uri 'none'",
		"object-src 'none'",
	].join("; ");

	const requestHeaders = new Headers(request.headers);
	requestHeaders.set("x-nonce", nonce);
	requestHeaders.set("content-security-policy", csp);
	const response = NextResponse.next({ request: { headers: requestHeaders } });
	response.headers.set("content-security-policy", csp);

	if (request.cookies.get(CSRF_COOKIE) === undefined) {
		const bytes = new Uint8Array(32);
		crypto.getRandomValues(bytes);
		const token = btoa(String.fromCharCode(...bytes))
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");
		response.cookies.set(CSRF_COOKIE, token, {
			httpOnly: true,
			secure: !dev,
			sameSite: "strict",
			path: "/",
		});
		// Visible to this render too, so the very first form already carries it.
		requestHeaders.set(
			"cookie",
			`${request.headers.get("cookie") ?? ""}; ${CSRF_COOKIE}=${token}`,
		);
		return NextResponse.next({
			request: { headers: requestHeaders },
			headers: response.headers,
		});
	}
	return response;
}

export const config = {
	matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico).*)" }],
};
