// ADR-046: the account PIN. Same rule in the app and in supabase/functions/_shared/pin.ts
// (pin.contract.test.ts keeps them equal).
export const PIN_LENGTH = 6;

export type PinProblem = "pin_format" | "pin_weak";

const ASCENDING = "0123456789";
const DESCENDING = "9876543210";

export function pinProblem(pin: string): PinProblem | null {
	if (!/^[0-9]{6}$/.test(pin)) {
		return "pin_format";
	}
	// A repeated digit or a straight run is the first thing anyone tries.
	const repeated = pin === (pin[0] ?? "").repeat(PIN_LENGTH);
	const run = ASCENDING.includes(pin) || DESCENDING.includes(pin);
	return repeated || run ? "pin_weak" : null;
}
