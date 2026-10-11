import { nextAmountState, textForValue } from "../amountInputModel";

describe("nextAmountState", () => {
	it.each([
		["", "", { text: "", value: null }],
		["1", "", { text: "1", value: 100 }],
		["12000", "1.200", { text: "12.000", value: 1200000 }],
		["12.0000", "12.000", { text: "120.000", value: 12000000 }],
		["12.000,", "12.000", { text: "12.000,", value: 1200000 }],
		["12.000,5", "12.000,", { text: "12.000,5", value: 1200050 }],
		["12.000,505", "12.000,50", { text: "12.000,50", value: 1200050 }],
		[",", "", { text: "0,", value: 0 }],
		["0012", "001", { text: "12", value: 1200 }],
		["12,3,4", "12,3", { text: "12,34", value: 1234 }],
		["1a2", "1", { text: "12", value: 1200 }],
	] as const)("%s (prev %s)", (raw, previous, expected) => {
		expect(nextAmountState(raw, previous)).toEqual(expected);
	});

	it("reads a single typed '.' as the decimal separator", () => {
		expect(nextAmountState("12.", "12")).toEqual({ text: "12,", value: 1200 });
	});

	it("caps the integer part to stay a safe integer", () => {
		const state = nextAmountState("9".repeat(20), "");
		expect(Number.isSafeInteger(state.value)).toBe(true);
		expect(state.text).toBe("9.999.999.999.999");
	});
});

describe("textForValue", () => {
	it.each([
		[null, ""],
		[0, "0"],
		[1200000, "12.000"],
		[1200050, "12.000,50"],
	] as const)("%s → %s", (value, text) => {
		expect(textForValue(value)).toBe(text);
	});
});
