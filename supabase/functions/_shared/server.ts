// Deno-only helpers for the invite functions (Deno.env, npm: import). Kept out of packages/shared's
// typecheck; the testable logic lives in invite.ts.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.2";

export function env(name: string): string | undefined {
	const value = Deno.env.get(name);
	return value === undefined || value === "" ? undefined : value;
}

export function serviceClient(): SupabaseClient {
	return createClient(env("SUPABASE_URL") ?? "", env("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
		auth: { persistSession: false, autoRefreshToken: false },
	});
}

export function sessionSecret(): string {
	const secret = env("INVITE_SESSION_SECRET");
	if (secret === undefined || secret.length < 32) {
		throw new Error("INVITE_SESSION_SECRET is not configured");
	}
	return secret;
}

// spec 11.2: nothing about an invite may be cached, indexed or leaked through the referrer.
export function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store",
			"referrer-policy": "no-referrer",
			"x-robots-tag": "noindex",
		},
	});
}

export function clientIp(request: Request): string {
	return (
		request.headers.get("cf-connecting-ip") ??
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		"unknown"
	);
}

export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
	try {
		const body: unknown = await request.json();
		return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

export function text(body: Record<string, unknown>, key: string): string {
	const value = body[key];
	return typeof value === "string" ? value : "";
}

const STATUS_BY_CODE: Record<string, number> = {
	invalid_phone: 400,
	validation_error: 400,
	forbidden: 403,
	conflict: 409,
	invalid_transition: 409,
	invite_unavailable: 410,
	locked: 423,
	rate_limited: 429,
};

// RPCs raise P0001 with the domain code as message (ADR-021); unknown failures stay opaque.
export function rpcError(error: { code?: string; message?: string }): Response {
	const code = error.code === "P0001" ? (error.message ?? "") : "";
	const status = STATUS_BY_CODE[code];
	return status === undefined
		? json(500, { error: "server_error" })
		: json(status, { error: code });
}

export function errorStatus(code: string): number {
	return STATUS_BY_CODE[code] ?? 400;
}
