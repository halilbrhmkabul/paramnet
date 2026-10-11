import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

import type { Terms } from "./schemas";

// Canonical form (ADR-014): object keys sorted, no whitespace, strings escaped exactly like
// JSON.stringify, integers only. plpgsql must build the same string by hand: jsonb::text adds
// spaces and orders keys by length first, so it cannot be hashed directly.
export function canonicalJson(value: unknown): string {
	if (value === null) {
		return "null";
	}
	if (typeof value === "string") {
		return JSON.stringify(value);
	}
	if (typeof value === "number") {
		if (!Number.isSafeInteger(value)) {
			throw new TypeError("canonical JSON allows only safe integers");
		}
		return String(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map((item: unknown) => canonicalJson(item)).join(",")}]`;
	}
	if (typeof value === "object") {
		// Keys are ASCII snake_case, so UTF-16 order equals code point order.
		const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
	}
	throw new TypeError(`canonical JSON does not support ${typeof value}`);
}

// BR-06: approvals carry this hash; the server recomputes it and rejects a mismatch.
export function termsHash(terms: Terms): string {
	return bytesToHex(sha256(utf8ToBytes(canonicalJson(terms))));
}
