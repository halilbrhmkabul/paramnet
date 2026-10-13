// Error reports must not carry personal data (CLAUDE.md "Kişisel veri", spec 11): no phone, name, note
// or amount. Used as Sentry's beforeSend / beforeBreadcrumb in the app, the web page and the edge
// functions; supabase/functions/_shared/telemetry.ts is an identical copy (telemetry.test.ts checks it).

const JWT = /eyJ[\w-]*\.[\w-]*\.[\w-]*/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const LONG_TOKEN = /[A-Za-z0-9_-]{32,}/g;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Turkish mobile numbers in the shapes people and the app write them (+90 / 0 / bare, spaced or not).
const PHONE = /(?<!\d)(?:\+?90[\s-]?)?\(?0?5\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}(?!\d)/g;
// "₺12.000,00" (ADR-047) and the legacy "12.000,00 TL".
const AMOUNT = /₺\s?\d[\d.]*(?:,\d+)?|(?<![\d.,])\d{1,3}(?:\.\d{3})*(?:,\d{2})?\s?TL\b/g;

// Keys whose values are personal or financial, wherever they appear (payloads, extras, contexts).
const FILTERED_KEY =
	/^(phone|phone_e164|target_phone_e164|display_name|creator_name|from_name|other_name|counterparty_name|note|notes|reason|description|title|code|otp|token|password|authorization|cookie|ip_address|email|username|amount|amount_minor|principal_minor|outstanding_minor|remaining_minor|due_minor|paid_minor)$/i;
const FILTERED = "[Filtered]";
const MAX_DEPTH = 12;

export function scrubText(text: string): string {
	return text
		.replace(JWT, "[token]")
		.replace(EMAIL, "[email]")
		.replace(LONG_TOKEN, (match) => (UUID.test(match) ? match : "[token]"))
		.replace(PHONE, "[phone]")
		.replace(AMOUNT, "[amount]");
}

function scrub(value: unknown, depth: number): unknown {
	if (typeof value === "string") {
		return scrubText(value);
	}
	if (value === null || typeof value !== "object" || depth > MAX_DEPTH) {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map((item) => scrub(item, depth + 1));
	}
	const result: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(value)) {
		result[key] = FILTERED_KEY.test(key) ? FILTERED : scrub(item, depth + 1);
	}
	return result;
}

function pick(source: unknown, keys: string[]): Record<string, unknown> | undefined {
	if (source === null || typeof source !== "object") {
		return undefined;
	}
	const result: Record<string, unknown> = {};
	for (const key of keys) {
		const value: unknown = (source as Record<string, unknown>)[key];
		if (value !== undefined) {
			result[key] = scrub(value, 1);
		}
	}
	return result;
}

// Returns a scrubbed copy: the user is reduced to its id, requests to their URL and method.
export function scrubTelemetryEvent<T extends object>(event: T): T {
	const scrubbed = scrub(event, 0) as Record<string, unknown>;
	const original = event as Record<string, unknown>;
	if ("user" in original) {
		scrubbed.user = pick(original.user, ["id"]);
	}
	if ("request" in original) {
		scrubbed.request = pick(original.request, ["url", "method"]);
	}
	return scrubbed as T;
}
