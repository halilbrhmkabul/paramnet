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
		success: "#11613F",
		successSoft: "#E1F1E7",
		neutral: "#46534C",
		neutralSoft: "#ECEFEC",
		// Behind a bottom sheet (design 37).
		scrim: "rgba(13,28,22,0.45)",
		// Card faces (design 07, 32): the card's own colour, the same in both themes.
		cardNavy: "#33305E",
		cardGraphite: "#2F3B33",
		cardMidnight: "#18466A",
		cardBordeaux: "#5A2232",
		cardChip: "#D4BE7F",
		onCard: "#FFFFFF",
		// Welcome (01) and the intro illustrations (31) stay dark forest in both themes.
		heroBg: "#0C2F25",
		heroStage: "#0F3A2E",
		heroCard: "#146A4E",
		heroText: "#FFFFFF",
		heroSoft: "#B7CEC4",
		heroMuted: "#9FBAAE",
		heroAccent: "#7FD3AE",
		onHeroAccent: "#0C2F25",
		heroLine: "rgba(255,255,255,0.28)",
		heroGlow: "rgba(127,211,174,0.4)",
		heroChip: "rgba(255,255,255,0.12)",
		heroCardSurface: "#FFFFFF",
		heroCardText: "#13221B",
		heroCardMuted: "#56645D",
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
		success: "#6FCF9A",
		successSoft: "#163526",
		neutral: "#B3C0B8",
		neutralSoft: "#26302B",
		scrim: "rgba(0,0,0,0.6)",
		// Card faces (design 07, 32): the card's own colour, the same in both themes.
		cardNavy: "#33305E",
		cardGraphite: "#2F3B33",
		cardMidnight: "#18466A",
		cardBordeaux: "#5A2232",
		cardChip: "#D4BE7F",
		onCard: "#FFFFFF",
		// Welcome (01) and the intro illustrations (31) stay dark forest in both themes.
		heroBg: "#0C2F25",
		heroStage: "#0F3A2E",
		heroCard: "#146A4E",
		heroText: "#FFFFFF",
		heroSoft: "#B7CEC4",
		heroMuted: "#9FBAAE",
		heroAccent: "#7FD3AE",
		onHeroAccent: "#0C2F25",
		heroLine: "rgba(255,255,255,0.28)",
		heroGlow: "rgba(127,211,174,0.4)",
		heroChip: "rgba(255,255,255,0.12)",
		heroCardSurface: "#FFFFFF",
		heroCardText: "#13221B",
		heroCardMuted: "#56645D",
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
