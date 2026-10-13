import type { ReactNode } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";

import { useAppTheme } from "@/theme/useAppTheme";

export type CardProps = {
	children: ReactNode;
	onPress?: () => void;
	accessibilityLabel?: string;
	style?: StyleProp<ViewStyle>;
	testID?: string;
};

export function Card({ children, onPress, accessibilityLabel, style, testID }: CardProps) {
	const { colors, radius, sizes, spacing } = useAppTheme();
	const cardStyle = {
		backgroundColor: colors.surface,
		borderColor: colors.border,
		borderWidth: 1,
		borderRadius: radius.lg,
		padding: sizes.cardPadding,
		gap: spacing.sm,
	};

	if (onPress === undefined) {
		return (
			<View testID={testID} style={[cardStyle, style]}>
				{children}
			</View>
		);
	}
	return (
		<Pressable
			testID={testID}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			style={({ pressed }) => [cardStyle, { opacity: pressed ? 0.85 : 1 }, style]}
		>
			{children}
		</Pressable>
	);
}
