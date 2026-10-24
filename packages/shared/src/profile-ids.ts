// ADR-050 / ADR-051: the ParamNet ID and the @username. The same rules live in plpgsql
// (private.normalize_paramnet_id, private.normalize_username); test-vectors/profile-ids.json checks both.

// 0, 1, I and O are left out: an ID is read aloud and typed from a screenshot.
export const PARAMNET_ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const PARAMNET_ID_LENGTH = 6;
export const PARAMNET_ID_PREFIX = "PN-";

const CODE = new RegExp(`^[${PARAMNET_ID_ALPHABET}]{${String(PARAMNET_ID_LENGTH)}}$`);

// "pn 7k4-qx9", "7K4QX9" and "PN-7K4QX9" are the same ID; anything else is null.
export function normalizeParamnetId(input: string): string | null {
	let code = input.replace(/[\s-]/g, "").toUpperCase();
	// Only an eight-character input carries the prefix: a code may itself start with "PN".
	if (code.length === PARAMNET_ID_LENGTH + 2 && code.startsWith("PN")) {
		code = code.slice(2);
	}
	return CODE.test(code) ? PARAMNET_ID_PREFIX + code : null;
}

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

// Names that would read as the app speaking.
export const RESERVED_USERNAMES: readonly string[] = [
	"paramnet",
	"admin",
	"destek",
	"support",
	"yardim",
	"help",
];

export type UsernameProblem = "username_length" | "username_format" | "username_reserved";

function cleanUsername(input: string): string {
	return input.trim().replace(/^@/, "").toLowerCase();
}

export function usernameProblem(input: string): UsernameProblem | null {
	const name = cleanUsername(input);
	if (name.length < USERNAME_MIN || name.length > USERNAME_MAX) {
		return "username_length";
	}
	if (
		!/^[a-z0-9_.]+$/.test(name) ||
		name.startsWith(".") ||
		name.endsWith(".") ||
		name.includes("..")
	) {
		return "username_format";
	}
	return RESERVED_USERNAMES.includes(name) ? "username_reserved" : null;
}

export function normalizeUsername(input: string): string | null {
	return usernameProblem(input) === null ? cleanUsername(input) : null;
}
