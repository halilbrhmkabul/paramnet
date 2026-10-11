import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/theme/useAppTheme";

export type CheckboxProps = {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	testID: string;
};

export function Checkbox({ label, checked, onChange, testID }: CheckboxProps) {
	const { colors, typography, radius, spacing, sizes } = useAppTheme();
	return (
		<Pressable
			testID={testID}
			accessibilityRole="checkbox"
			accessibilityLabel={label}
			accessibilityState={{ checked }}
			onPress={() => {
				onChange(!checked);
			}}
			style={[styles.row, { minHeight: sizes.minTouch, gap: spacing.md }]}
		>
			<View
				style={[
					styles.box,
					{
						borderRadius: radius.sm / 2,
						borderColor: checked ? colors.primary : colors.border,
						backgroundColor: checked ? colors.primary : "transparent",
					},
				]}
			>
				{checked ? <Ionicons name="checkmark" size={18} color={colors.onPrimary} /> : null}
			</View>
			<Text style={[typography.callout, styles.label, { color: colors.text }]}>{label}</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
	},
	box: {
		width: 24,
		height: 24,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
	},
	label: {
		flex: 1,
	},
});
