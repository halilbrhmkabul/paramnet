// Single source for design tokens (paramnet-mobile design-tokens.md). Components never hard-code values.
export const palette = {
	light: {
		bg: "#FFFFFF",
		surface: "#F6F7F9",
		surfaceRaised: "#FFFFFF",
		border: "#E5E7EB",
		text: "#111827",
		textMuted: "#6B7280",
		primary: "#1F4E79",
		onPrimary: "#FFFFFF",
		receivable: "#15803D",
		payable: "#C2410C",
		overdue: "#B91C1C",
		pending: "#6B7280",
		warning: "#B45309",
		success: "#15803D",
	},
	dark: {
		bg: "#0B0F14",
		surface: "#151A21",
		surfaceRaised: "#1C222B",
		border: "#262C35",
		text: "#F3F4F6",
		textMuted: "#9CA3AF",
		primary: "#6FA8DC",
		onPrimary: "#0B0F14",
		receivable: "#4ADE80",
		payable: "#FB923C",
		overdue: "#F87171",
		pending: "#9CA3AF",
		warning: "#FBBF24",
		success: "#4ADE80",
	},
} as const;

export type ColorToken = keyof (typeof palette)["light"];
export type Colors = Record<ColorToken, string>;

export const typography = {
	amountXL: { fontSize: 34, lineHeight: 40, fontWeight: "700" },
	amountL: { fontSize: 24, lineHeight: 30, fontWeight: "700" },
	title: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
	headline: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
	body: { fontSize: 16, lineHeight: 22, fontWeight: "400" },
	callout: { fontSize: 15, lineHeight: 20, fontWeight: "400" },
	caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
	micro: { fontSize: 11, lineHeight: 14, fontWeight: "600" },
} as const;

export type TypographyToken = keyof typeof typography;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;
export const sizes = {
	screenPadding: 16,
	cardPadding: 16,
	minTouch: 44,
	buttonPrimary: 52,
	buttonSecondary: 44,
	// Amounts and badges may scale with Dynamic Type, but not without limit.
	maxAmountFontScale: 1.4,
} as const;
