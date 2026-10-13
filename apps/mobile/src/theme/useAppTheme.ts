import { useColorScheme } from "react-native";

import { fonts, palette, radius, sizes, spacing, typography, type Colors } from "./tokens";

export type ColorScheme = "light" | "dark";

export type AppTheme = {
	scheme: ColorScheme;
	colors: Colors;
	typography: typeof typography;
	fonts: typeof fonts;
	spacing: typeof spacing;
	radius: typeof radius;
	sizes: typeof sizes;
};

export function themeFor(scheme: ColorScheme): AppTheme {
	return { scheme, colors: palette[scheme], typography, fonts, spacing, radius, sizes };
}

export function useAppTheme(): AppTheme {
	return themeFor(useColorScheme() === "dark" ? "dark" : "light");
}
