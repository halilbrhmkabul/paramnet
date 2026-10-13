// Single source for design tokens (paramnet-mobile design-tokens.md, "Orman Defteri" design, F3-10).
// Components never hard-code values. The light palette is the design's; dark is derived from the same
// forest hues and checked for contrast in theme.test.tsx.
export const palette = {
	light: {
		bg: "#F5F7F4",
		surface: "#FFFFFF",
		surfaceRaised: "#FFFFFF",
		surfaceSunken: "#F1F4F0",
		track: "#E8ECE8",
		border: "#E2E7E2",
		borderStrong: "#D5DCD6",
		divider: "#EDF0EC",
		text: "#13221B",
		textMuted: "#56645D",
		tabInactive: "#5E6B64",
		primary: "#0F3A2E",
		onPrimary: "#FFFFFF",
		primarySoft: "#DDEFE4",
		accent: "#146A4E",
		receivable: "#11613F",
		payable: "#13221B",
		overdue: "#A1291F",
		overdueSoft: "#FBE4E1",
		dangerBorder: "#EDC1BB",
		pending: "#24507D",
		pendingSoft: "#E3ECF6",
		warning: "#7A4E00",
		warningSoft: "#FBEFD5",
		// Design 25: the next installment's segment and its card.
		amber: "#D9A847",
		warningSurface: "#FDF6E6",
		warningBorder: "#EBD9AE",
		// Design 03 quick actions: expense (brick) and lending (violet); the logo's mint stroke.
		expense: "#8A3B2C",
		expenseSoft: "#F6ECE8",
		violet: "#4E3F86",
		violetSoft: "#ECE8F4",
		brandMark: "#7FD3AE",
		// Design 26 calendar dots and bars.
		calPayment: "#C98A12",
		calIncoming: "#2F6CA8",
		calDone: "#9AA69F",
		shadow: "#10281E",
		success: "#11613F",
		successSoft: "#E1F1E7",
		neutral: "#46534C",
		neutralSoft: "#ECEFEC",
	},
	dark: {
		bg: "#0D1411",
		surface: "#151E1A",
		surfaceRaised: "#1B2621",
		surfaceSunken: "#111915",
		track: "#24302A",
		border: "#26332C",
		borderStrong: "#34433B",
		divider: "#1F2A24",
		text: "#E6EEE9",
		textMuted: "#9AABA1",
		tabInactive: "#8A9A91",
		primary: "#7FD3AE",
		onPrimary: "#0B1F17",
		primarySoft: "#1C3A2D",
		accent: "#7FD3AE",
		receivable: "#6FCF9A",
		payable: "#E6EEE9",
		overdue: "#F08C82",
		overdueSoft: "#3A1D1A",
		dangerBorder: "#5C2C27",
		pending: "#8FB6E3",
		pendingSoft: "#1B2A3B",
		warning: "#E3B65E",
		warningSoft: "#352A12",
		amber: "#C9A04A",
		warningSurface: "#211B0E",
		warningBorder: "#4A3A18",
		expense: "#F0A08F",
		expenseSoft: "#3A221D",
		violet: "#B7AAF0",
		violetSoft: "#272240",
		brandMark: "#0B1F17",
		calPayment: "#E0A93A",
		calIncoming: "#6FA3DA",
		calDone: "#5E6B64",
		shadow: "#000000",
		success: "#6FCF9A",
		successSoft: "#163526",
		neutral: "#B3C0B8",
		neutralSoft: "#26302B",
	},
} as const;

export type ColorToken = keyof (typeof palette)["light"];
export type Colors = Record<ColorToken, string>;

// Manrope by weight (each weight is its own family, so no fontWeight: Android ignores it for custom
// fonts). Loaded in app/_layout.tsx before the splash screen hides.
export const fonts = {
	medium: "Manrope_500Medium",
	semibold: "Manrope_600SemiBold",
	bold: "Manrope_700Bold",
	extrabold: "Manrope_800ExtraBold",
	mono: "IBMPlexMono_500Medium",
} as const;

export const typography = {
	amountXL: { fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
	amountL: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
	title: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
	headline: { fontFamily: fonts.extrabold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
	rowTitle: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 },
	body: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22 },
	callout: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20 },
	label: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18 },
	caption: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
	micro: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14 },
	badge: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16 },
	button: { fontFamily: fonts.extrabold, fontSize: 16, lineHeight: 20 },
	mono: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16 },
} as const;

export type TypographyToken = keyof typeof typography;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
// Inputs 14, buttons 16, cards 20, large panels 24, badges and pills fully round.
export const radius = { sm: 14, md: 16, lg: 20, xl: 24, pill: 999 } as const;
export const sizes = {
	screenPadding: 16,
	cardPadding: 16,
	minTouch: 44,
	buttonPrimary: 54,
	buttonSecondary: 48,
	iconButton: 44,
	// Amounts and badges may scale with Dynamic Type, but not without limit.
	maxAmountFontScale: 1.4,
} as const;
