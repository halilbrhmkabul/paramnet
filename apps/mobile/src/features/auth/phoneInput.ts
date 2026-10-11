// Display mask for the national part after the fixed +90: "555 123 45 67".
export function formatPhoneDigits(raw: string): string {
	const digits = raw.replace(/\D/g, "").replace(/^0/, "").slice(0, 10);
	const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)];
	return parts.filter((part) => part !== "").join(" ");
}

export function phoneDigits(display: string): string {
	return display.replace(/\D/g, "");
}
