import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { scrubTelemetryEvent, scrubText } from "./telemetry";

describe("scrubText (CLAUDE.md: no phone, name, note or amount in telemetry)", () => {
	it.each([
		["+905551234567 aradı", "[phone] aradı"],
		["0555 123 45 67", "[phone]"],
		["555 123 45 67", "[phone]"],
		["(0555) 123-45-67", "[phone]"],
		["Kalan: 12.000,00 TL", "Kalan: [amount]"],
		["4.000 TL ödeme", "[amount] ödeme"],
		["Kalan: ₺12.000,00", "Kalan: [amount]"],
		["₺ 4.000 ödeme", "[amount] ödeme"],
		["Fark -₺1.500,00", "Fark -[amount]"],
		["ayse@example.com yazdı", "[email] yazdı"],
	])("%s", (input, expected) => {
		expect(scrubText(input)).toBe(expected);
	});

	it("masks invite tokens and JWTs but keeps record ids for debugging", () => {
		const token = "Q2hhbmdlTWVQbGVhc2VUaGlzSXNBVG9rZW5WYWx1ZTEyMw";
		expect(scrubText(`/i/${token}`)).toBe("/i/[token]");
		expect(scrubText("Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc")).toBe(
			"Bearer [token]",
		);
		expect(scrubText("agreement 00000000-0000-4000-8000-0000000000c1 not_found")).toBe(
			"agreement 00000000-0000-4000-8000-0000000000c1 not_found",
		);
	});

	it("leaves ordinary error text alone", () => {
		expect(scrubText("TypeError: Cannot read properties of undefined (reading 'id')")).toBe(
			"TypeError: Cannot read properties of undefined (reading 'id')",
		);
	});

	it("never lets a Turkish mobile number through, whatever surrounds it", () => {
		fc.assert(
			fc.property(
				fc.string({ maxLength: 20 }),
				fc.stringMatching(/^5\d{9}$/),
				fc.constantFrom("+90", "0", ""),
				(noise, number, prefix) => {
					const scrubbed = scrubText(`${noise} ${prefix}${number} ${noise}`);
					expect(scrubbed).not.toContain(number);
				},
			),
		);
	});
});

describe("scrubTelemetryEvent", () => {
	const event = {
		event_id: "e1",
		message: "Ödeme kaydedilemedi: 1.500,00 TL",
		user: { id: "u1", phone: "+905551234567", username: "Ayşe", ip_address: "1.2.3.4" },
		request: {
			url: "https://onay.example/i/Q2hhbmdlTWVQbGVhc2VUaGlzSXNBVG9rZW5WYWx1ZTEyMw",
			data: { phone: "5551234567", code: "123456" },
			cookies: { pn_csrf: "x" },
			headers: { authorization: "Bearer x", "user-agent": "Mozilla" },
			query_string: "token=abc",
		},
		extra: { note: "Kira payı", amount_minor: 150000, display_name: "Bora", status: 409 },
		breadcrumbs: [{ category: "fetch", data: { url: "/rest/v1/rpc/record_payment" } }],
		exception: {
			values: [{ type: "ApiError", value: "conflict", stacktrace: { frames: [] } }],
		},
	};

	it("keeps only the user id and drops request bodies, cookies, headers and queries", () => {
		const scrubbed = scrubTelemetryEvent(event);
		expect(scrubbed.user).toEqual({ id: "u1" });
		expect(scrubbed.request).toEqual({ url: "https://onay.example/i/[token]" });
	});

	it("filters personal fields anywhere in the event", () => {
		const scrubbed = scrubTelemetryEvent(event);
		expect(scrubbed.extra).toEqual({
			note: "[Filtered]",
			amount_minor: "[Filtered]",
			display_name: "[Filtered]",
			status: 409,
		});
		expect(scrubbed.message).toBe("Ödeme kaydedilemedi: [amount]");
	});

	it("keeps what debugging needs", () => {
		const scrubbed = scrubTelemetryEvent(event);
		expect(scrubbed.event_id).toBe("e1");
		expect(scrubbed.exception).toEqual(event.exception);
		expect(scrubbed.breadcrumbs).toEqual(event.breadcrumbs);
	});

	it("does not change the original", () => {
		const copy = structuredClone(event);
		scrubTelemetryEvent(event);
		expect(event).toEqual(copy);
	});
});

// Edge functions cannot import packages/shared; they carry a copy that must stay identical.
it("supabase/functions/_shared/telemetry.ts is the same code", () => {
	const read = (path: string) =>
		readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
	expect(read("../../../supabase/functions/_shared/telemetry.ts")).toBe(read("./telemetry.ts"));
});
