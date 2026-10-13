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
	// Design "Butonlar": filled primary; secondary and destructive are outlined on the surface.
	const filled = variant === "primary";
	const textColor =
		variant === "primary"
			? colors.onPrimary
			: variant === "danger"
				? colors.overdue
				: variant === "ghost"
					? colors.accent
					: colors.primary;
	const background =
		variant === "primary"
			? colors.primary
			: variant === "ghost"
				? "transparent"
				: colors.surface;
	const borderColor =
		variant === "secondary"
			? colors.borderStrong
			: variant === "danger"
				? colors.dangerBorder
				: "transparent";

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
					minHeight:
						filled || variant === "danger"
							? sizes.buttonPrimary
							: sizes.buttonSecondary,
					borderRadius: radius.md,
					paddingHorizontal: spacing.lg,
					backgroundColor: background,
					borderColor,
					opacity: inactive ? 0.5 : pressed ? 0.8 : 1,
				},
			]}
		>
			{loading ? (
				<ActivityIndicator color={textColor} />
			) : (
				<Text style={[typography.button, { color: textColor }]}>{label}</Text>
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
