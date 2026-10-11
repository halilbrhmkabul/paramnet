import { describe, expect, it } from "vitest";

import vectors from "../test-vectors/terms-hash.json";
import { canonicalJson, termsHash } from "./terms-hash";

describe("termsHash — shared test vectors", () => {
	it.each(vectors.vectors.map((vector) => [vector.name, vector] as const))("%s", (_, vector) => {
		expect(canonicalJson(vector.terms)).toBe(vector.canonical);
		expect(termsHash(vector.terms)).toBe(vector.sha256);
	});
});

describe("canonicalJson", () => {
	it("sorts nested keys and keeps array order", () => {
		expect(canonicalJson({ b: [{ z: 1, a: 2 }, 3], a: null })).toBe(
			'{"a":null,"b":[{"a":2,"z":1},3]}',
		);
	});

	it.each([
		["a fractional number", { a: 1.5 }],
		["an unsafe integer", { a: Number.MAX_SAFE_INTEGER + 1 }],
		["NaN", { a: Number.NaN }],
		["undefined", { a: undefined }],
		["a boolean", { a: true }],
	])("rejects %s", (_, value) => {
		expect(() => canonicalJson(value)).toThrow(TypeError);
	});
});
