import { formatTRY } from "@paramnet/shared";
import { Text, type StyleProp, type TextStyle } from "react-native";

import type { ColorToken, TypographyToken } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

export type AmountTextProps = {
	minor: number;
	variant?: TypographyToken;
	tone?: ColorToken;
	style?: StyleProp<TextStyle>;
	testID?: string;
};

export function AmountText({
	minor,
	variant = "body",
	tone = "text",
	style,
	testID,
}: AmountTextProps) {
	const { colors, typography, sizes } = useAppTheme();
	return (
		<Text
			testID={testID}
			maxFontSizeMultiplier={sizes.maxAmountFontScale}
			style={[
				typography[variant],
				{ color: colors[tone], fontVariant: ["tabular-nums"] },
				style,
			]}
		>
			{formatTRY(minor)}
		</Text>
	);
}
