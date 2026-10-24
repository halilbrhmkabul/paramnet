import { describe, expect, it } from "vitest";

import vectors from "../test-vectors/profile-ids.json";
import {
	PARAMNET_ID_ALPHABET,
	normalizeParamnetId,
	normalizeUsername,
	usernameProblem,
} from "./profile-ids";

describe("normalizeParamnetId (ADR-050)", () => {
	it.each(vectors.paramnet_id)("$name", ({ input, expected }) => {
		expect(normalizeParamnetId(input)).toBe(expected);
	});

	it("uses 32 unambiguous characters", () => {
		expect(PARAMNET_ID_ALPHABET).toHaveLength(32);
		expect(new Set(PARAMNET_ID_ALPHABET).size).toBe(32);
		for (const confusable of ["0", "1", "I", "O"]) {
			expect(PARAMNET_ID_ALPHABET).not.toContain(confusable);
		}
	});
});

describe("normalizeUsername (ADR-051)", () => {
	it.each(vectors.username)("$name", ({ input, expected }) => {
		expect(normalizeUsername(input)).toBe(expected);
	});

	it("names the problem for the form", () => {
		expect(usernameProblem("ab")).toBe("username_length");
		expect(usernameProblem("abcdefghijklmnopqrstu")).toBe("username_length");
		expect(usernameProblem("denizyılmaz")).toBe("username_format");
		expect(usernameProblem("deniz..y")).toBe("username_format");
		expect(usernameProblem("destek")).toBe("username_reserved");
		expect(usernameProblem("@Deniz")).toBeNull();
	});
});
