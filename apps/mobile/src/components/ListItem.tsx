import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/theme/useAppTheme";

export type ListItemProps = {
	title: string;
	subtitle?: string;
	right?: ReactNode;
	onPress?: () => void;
	accessibilityLabel?: string;
	testID: string;
};

export function ListItem({
	title,
	subtitle,
	right,
	onPress,
	accessibilityLabel,
	testID,
}: ListItemProps) {
	const { colors, typography, spacing, sizes } = useAppTheme();
	const content = (
		<>
			<View style={styles.text}>
				<Text style={[typography.headline, { color: colors.text }]} numberOfLines={1}>
					{title}
				</Text>
				{subtitle !== undefined ? (
					<Text
						style={[typography.caption, { color: colors.textMuted }]}
						numberOfLines={2}
					>
						{subtitle}
					</Text>
				) : null}
			</View>
			{right}
		</>
	);
	const rowStyle = [
		styles.row,
		{ minHeight: sizes.minTouch, gap: spacing.md, paddingVertical: spacing.sm },
	];

	if (onPress === undefined) {
		return (
			<View testID={testID} style={rowStyle}>
				{content}
			</View>
		);
	}
	return (
		<Pressable
			testID={testID}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? title}
			style={({ pressed }) => [rowStyle, { opacity: pressed ? 0.7 : 1 }]}
		>
			{content}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
	},
	text: {
		flex: 1,
		gap: 2,
	},
});
