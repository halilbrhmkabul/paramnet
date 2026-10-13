// BR-01: amounts are integer kuruş. Never divide by 100 into a float; formatting works on the digit string.
export type MinorAmount = number;

export type ParseTRYError =
	"empty" | "invalid_format" | "negative" | "too_many_decimals" | "out_of_range";

export type ParseTRYResult = { ok: true; value: MinorAmount } | { ok: false; error: ParseTRYError };

export function isMinorAmount(value: number): value is MinorAmount {
	return Number.isSafeInteger(value) && value >= 0;
}

function assertMinorAmount(value: number, name: string): void {
	if (!isMinorAmount(value)) {
		throw new RangeError(`${name} must be a non-negative safe integer (kuruş)`);
	}
}

export function addMinor(a: MinorAmount, b: MinorAmount): MinorAmount {
	assertMinorAmount(a, "a");
	assertMinorAmount(b, "b");
	const sum = a + b;
	assertMinorAmount(sum, "sum");
	return sum;
}

export function subtractMinor(a: MinorAmount, b: MinorAmount): MinorAmount {
	assertMinorAmount(a, "a");
	assertMinorAmount(b, "b");
	const difference = a - b;
	assertMinorAmount(difference, "difference");
	return difference;
}

// Hand-rolled instead of Intl: Hermes/device ICU separators and the ₺ spacing vary, while every
// runtime must print exactly "₺12.000,00" (ADR-047, the design's format).
// Negative values are allowed only for display, e.g. a plan's difference from the remaining amount.
export function formatTRY(minor: number): string {
	if (!Number.isSafeInteger(minor)) {
		throw new RangeError("amount must be a safe integer (kuruş)");
	}
	const sign = minor < 0 ? "-" : "";
	const digits = String(Math.abs(minor)).padStart(3, "0");
	const lira = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
	const kurus = digits.slice(-2);
	return `${sign}₺${lira},${kurus}`;
}

// "." is only a thousands separator and "," only the decimal separator (tr-TR).
// Leading zeros and partial input such as "12," are rejected; AmountInput handles in-progress typing.
const AMOUNT_PATTERN = /^(0|[1-9]\d*|[1-9]\d{0,2}(?:\.\d{3})+)(?:,(\d+))?$/;

export function parseTRY(text: string): ParseTRYResult {
	// Accepts the current "₺12.000,00" and the legacy "12.000,00 TL" (pasted or older shares), not both.
	const trimmed = text.trim();
	const input = trimmed.startsWith("₺")
		? trimmed.slice(1).trimStart()
		: trimmed.replace(/\s*TL$/, "");
	if (input === "") {
		return { ok: false, error: "empty" };
	}
	if (input.startsWith("-")) {
		return { ok: false, error: "negative" };
	}
	const match = AMOUNT_PATTERN.exec(input);
	if (match === null) {
		return { ok: false, error: "invalid_format" };
	}
	const lira = (match[1] ?? "").replaceAll(".", "");
	const fraction = match[2] ?? "";
	if (fraction.length > 2) {
		return { ok: false, error: "too_many_decimals" };
	}
	// Any digit string above MAX_SAFE_INTEGER rounds to >= 2^53, which isSafeInteger rejects.
	const value = Number(lira + fraction.padEnd(2, "0"));
	if (!Number.isSafeInteger(value)) {
		return { ok: false, error: "out_of_range" };
	}
	return { ok: true, value };
}
