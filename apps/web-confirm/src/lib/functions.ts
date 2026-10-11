import "server-only";

import { headers } from "next/headers";

// Server-side calls to the invite edge functions; the browser never talks to Supabase directly.
export type InviteStatus = "active" | "expired" | "consumed" | "revoked" | "locked" | "invalid";

export type InviteDetails = {
	creator_name: string;
	title: string;
	my_role: "creditor" | "debtor";
	version: number;
	terms_hash: string;
	principal_minor: number;
	down_payment_minor: number;
	notes: string | null;
	plan: { seq: number; due_date: string | null; amount_minor: number }[];
	payments: { amount_minor: number; paid_on: string; kind: string }[];
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function baseUrl(): string {
	const url = process.env.FUNCTIONS_URL;
	if (url === undefined || url === "") {
		throw new Error("FUNCTIONS_URL is not configured");
	}
	return url;
}

async function call<T>(
	name: string,
	init: { method: "GET" | "POST"; query?: string; body?: unknown },
): Promise<Result<T>> {
	const incoming = await headers();
	const response = await fetch(`${baseUrl()}/${name}${init.query ?? ""}`, {
		method: init.method,
		cache: "no-store",
		headers: {
			"content-type": "application/json",
			apikey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
			// The functions rate-limit and hash the visitor's address, not this server's.
			"x-forwarded-for": incoming.get("x-forwarded-for") ?? "unknown",
			"user-agent": (incoming.get("user-agent") ?? "").slice(0, 200),
		},
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
	});
	const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
	if (!response.ok) {
		return { ok: false, error: typeof json.error === "string" ? json.error : "generic" };
	}
	return { ok: true, data: json as T };
}

export function openInvite(token: string) {
	return call<{ status: InviteStatus; creator_name?: string }>("invite-open", {
		method: "GET",
		query: `?token=${encodeURIComponent(token)}`,
	});
}

export function sendCode(token: string, phone: string, turnstileToken: string) {
	return call<{ sent: boolean }>("invite-otp-send", {
		method: "POST",
		body: { token, phone, turnstile_token: turnstileToken },
	});
}

export function verifyCode(token: string, phone: string, code: string) {
	return call<{ session: string; details: InviteDetails }>("invite-otp-verify", {
		method: "POST",
		body: { token, phone, code },
	});
}

export function inviteDetails(session: string) {
	return call<{ phone: string; details: InviteDetails }>("invite-details", {
		method: "POST",
		body: { session },
	});
}

export function decide(
	session: string,
	body: { version: number; terms_hash: string; decision: string; counter_terms?: unknown },
) {
	return call<{ status: string; version: number }>("invite-decide", {
		method: "POST",
		body: { session, ...body },
	});
}
