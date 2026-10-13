import type { ReactNode } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { useAppTheme } from "@/theme/useAppTheme";

export type TextFieldProps = Pick<
	TextInputProps,
	| "value"
	| "onChangeText"
	| "onBlur"
	| "keyboardType"
	| "autoComplete"
	| "textContentType"
	| "autoFocus"
	| "maxLength"
	| "placeholder"
	| "autoCapitalize"
	| "multiline"
	| "returnKeyType"
	| "onSubmitEditing"
> & {
	label: string;
	error?: string;
	helper?: string;
	prefix?: ReactNode;
	testID: string;
};

export function TextField({
	label,
	error,
	helper,
	prefix,
	testID,
	multiline,
	...inputProps
}: TextFieldProps) {
	const { colors, typography, radius, spacing, sizes } = useAppTheme();
	return (
		<View style={{ gap: spacing.xs }}>
			<Text style={[typography.label, { color: colors.textMuted }]}>{label}</Text>
			<View
				style={[
					styles.field,
					{
						minHeight:
							multiline === true ? sizes.buttonPrimary * 2 : sizes.buttonPrimary,
						borderRadius: radius.sm,
						borderColor: error === undefined ? colors.borderStrong : colors.overdue,
						backgroundColor: colors.surface,
						paddingHorizontal: spacing.md,
						gap: spacing.sm,
					},
				]}
			>
				{prefix}
				<TextInput
					testID={testID}
					accessibilityLabel={label}
					accessibilityHint={helper}
					placeholderTextColor={colors.textMuted}
					multiline={multiline}
					style={[styles.input, typography.body, { color: colors.text }]}
					{...inputProps}
				/>
			</View>
			{error !== undefined ? (
				<Text
					accessibilityLiveRegion="polite"
					style={[typography.caption, { color: colors.overdue }]}
				>
					{error}
				</Text>
			) : helper !== undefined ? (
				<Text style={[typography.caption, { color: colors.textMuted }]}>{helper}</Text>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	field: {
		flexDirection: "row",
		alignItems: "center",
		borderWidth: 1,
	},
	input: {
		flex: 1,
		paddingVertical: 8,
	},
});
