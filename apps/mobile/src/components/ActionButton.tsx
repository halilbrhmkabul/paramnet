import { Pressable, StyleSheet, Text } from "react-native";

import { Icon, type IconName } from "@/components/Icon";
import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

// Design ".act": a 48 pt outlined button with a small icon, used in pairs under a total.
// `soon` keeps a planned action in its place but disabled, so the layout matches the design.
export function ActionButton({
	label,
	icon,
	onPress,
	soon = false,
	strokeWidth = 2,
	testID,
}: {
	label: string;
	icon: IconName;
	onPress: () => void;
	soon?: boolean;
	strokeWidth?: number;
	testID: string;
}) {
	const { colors, fonts, radius } = useAppTheme();
	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={soon ? `${label}, ${tr.common.soon}` : label}
			accessibilityState={{ disabled: soon }}
			disabled={soon}
			onPress={onPress}
			style={({ pressed }) => [
				styles.act,
				{
					borderRadius: radius.sm,
					backgroundColor: colors.surface,
					borderColor: colors.borderStrong,
					opacity: soon ? 0.55 : pressed ? 0.8 : 1,
				},
			]}
		>
			<Icon name={icon} size={16} tone="primary" strokeWidth={strokeWidth} />
			<Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>
				{label}
			</Text>
			{soon ? (
				<Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted }}>
					{tr.common.soon}
				</Text>
			) : null}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	act: {
		flex: 1,
		minHeight: 48,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		borderWidth: 1,
		paddingHorizontal: 8,
	},
});
