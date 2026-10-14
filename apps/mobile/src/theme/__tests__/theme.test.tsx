import { render, screen } from "@testing-library/react-native";
import * as ReactNative from "react-native";

import { AmountText } from "@/components/AmountText";
import { palette, typography } from "@/theme/tokens";
import { themeFor } from "@/theme/useAppTheme";

describe("theme", () => {
	it("maps each scheme to its token palette", () => {
		expect(themeFor("light").colors.bg).toBe(palette.light.bg);
		expect(themeFor("dark").colors.text).toBe(palette.dark.text);
	});

	it("components follow the system dark mode", async () => {
		jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
		await render(<AmountText minor={100} testID="amount" />);
		expect(screen.getByTestId("amount")).toHaveStyle({ color: palette.dark.text });
	});
});

// F3-10 "Orman Defteri": readable in both schemes (WCAG AA 4.5:1 for text, 3:1 for large text and UI).
function luminance(hex: string): number {
	const channel = (i: number) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
	return (hi + 0.05) / (lo + 0.05);
}

describe.each(["light", "dark"] as const)("%s palette contrast", (scheme) => {
	const c = palette[scheme];

	it.each([
		["text", "bg"],
		["text", "surface"],
		["textMuted", "bg"],
		["textMuted", "surface"],
		["onPrimary", "primary"],
		["accent", "surface"],
		["receivable", "surface"],
		["payable", "surface"],
		["overdue", "surface"],
		["success", "successSoft"],
		["warning", "warningSoft"],
		["overdue", "overdueSoft"],
		["pending", "pendingSoft"],
		["neutral", "neutralSoft"],
		["primary", "primarySoft"],
		["heroText", "heroBg"],
		["heroSoft", "heroBg"],
		["heroMuted", "heroBg"],
		["heroAccent", "heroBg"],
		["onHeroAccent", "heroAccent"],
		["heroText", "heroStage"],
		["heroCardText", "heroCardSurface"],
		["heroCardMuted", "heroCardSurface"],
	] as const)("%s on %s ≥ 4.5", (fg, bg) => {
		expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5);
	});
});

describe("typography", () => {
	it("uses Manrope for text and IBM Plex Mono for ids", () => {
		expect(typography.body.fontFamily).toBe("Manrope_500Medium");
		expect(typography.amountXL.fontFamily).toBe("Manrope_800ExtraBold");
		expect(typography.mono.fontFamily).toBe("IBMPlexMono_500Medium");
	});
});
