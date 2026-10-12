import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { useAppTheme } from "@/theme/useAppTheme";

// "danger" is the primary action of an irreversible step (account deletion).
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export type ButtonProps = {
	label: string;
	onPress: () => void;
	variant?: ButtonVariant;
	disabled?: boolean;
	loading?: boolean;
	accessibilityLabel?: string;
	accessibilityHint?: string;
	testID: string;
};

export function Button({
	label,
	onPress,
	variant = "primary",
	disabled = false,
	loading = false,
	accessibilityLabel,
	accessibilityHint,
	testID,
}: ButtonProps) {
	const { colors, typography, radius, sizes, spacing } = useAppTheme();
	const inactive = disabled || loading;
	const filled = variant === "primary" || variant === "danger";
	const fill = variant === "danger" ? colors.overdue : colors.primary;
	const textColor = filled ? colors.onPrimary : colors.primary;

	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? label}
			accessibilityHint={accessibilityHint}
			accessibilityState={{ disabled: inactive, busy: loading }}
			disabled={inactive}
			onPress={onPress}
			style={({ pressed }) => [
				styles.base,
				{
					minHeight: filled ? sizes.buttonPrimary : sizes.buttonSecondary,
					borderRadius: radius.md,
					paddingHorizontal: spacing.lg,
					backgroundColor: filled ? fill : "transparent",
					borderColor: variant === "secondary" ? colors.primary : "transparent",
					opacity: inactive ? 0.5 : pressed ? 0.8 : 1,
				},
			]}
		>
			{loading ? (
				<ActivityIndicator color={textColor} />
			) : (
				<Text style={[typography.headline, { color: textColor }]}>{label}</Text>
			)}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	base: {
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
	},
});
