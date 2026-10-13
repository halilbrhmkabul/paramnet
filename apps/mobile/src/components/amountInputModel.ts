import { formatTRY, type MinorAmount } from "@paramnet/shared";

// Enough for 9.999.999.999.999,99 TL while staying a safe integer in kuruş.
const MAX_LIRA_DIGITS = 13;

export type AmountInputState = { text: string; value: MinorAmount | null };

function group(lira: string): string {
	return lira.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// "." is our own thousands separator, but some keyboards (non-TR locale) type "." as the decimal key:
// a single "." appended to the previous text is read as ",".
export function nextAmountState(raw: string, previousText: string): AmountInputState {
	let input = raw;
	if (raw === `${previousText}.` && !previousText.includes(",")) {
		input = `${previousText},`;
	}
	const commaIndex = input.indexOf(",");
	const hasComma = commaIndex !== -1;
	const integerPart = (hasComma ? input.slice(0, commaIndex) : input).replace(/\D/g, "");
	const fractionPart = hasComma
		? input
				.slice(commaIndex + 1)
				.replace(/\D/g, "")
				.slice(0, 2)
		: "";

	const lira = integerPart.replace(/^0+(?=\d)/, "").slice(0, MAX_LIRA_DIGITS);
	if (lira === "" && !hasComma) {
		return { text: "", value: null };
	}
	const shownLira = lira === "" ? "0" : lira;
	const text = hasComma ? `${group(shownLira)},${fractionPart}` : group(shownLira);
	return { text, value: Number(shownLira + fractionPart.padEnd(2, "0")) };
}

export function textForValue(value: MinorAmount | null): string {
	if (value === null) {
		return "";
	}
	const formatted = formatTRY(value).replace(/^₺/, "");
	// Show whole liras without ",00" so editing feels natural.
	return formatted.endsWith(",00") ? formatted.slice(0, -3) : formatted;
}
