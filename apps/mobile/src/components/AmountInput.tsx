import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { nextAmountState, textForValue } from "./amountInputModel";
import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

export type AmountInputProps = {
	label: string;
	value: number | null;
	onChangeValue: (value: number | null) => void;
	error?: string;
	helper?: string;
	editable?: boolean;
	testID: string;
};

// Holds the typed text locally (e.g. "12,"), but the only value that leaves is integer kuruş.
export function AmountInput({
	label,
	value,
	onChangeValue,
	error,
	helper,
	editable = true,
	testID,
}: AmountInputProps) {
	const { colors, typography, radius, spacing, sizes } = useAppTheme();
	const [text, setText] = useState(() => textForValue(value));
	const [lastValue, setLastValue] = useState(value);

	// A value set from outside (form reset, plan edit) replaces what was typed.
	if (value !== lastValue) {
		setLastValue(value);
		if (nextAmountState(text, text).value !== value) {
			setText(textForValue(value));
		}
	}

	return (
		<View style={{ gap: spacing.xs }}>
			<Text style={[typography.label, { color: colors.textMuted }]}>{label}</Text>
			<View
				style={[
					styles.field,
					{
						minHeight: sizes.buttonPrimary,
						borderRadius: radius.sm,
						borderColor: error === undefined ? colors.borderStrong : colors.overdue,
						backgroundColor: colors.surface,
						paddingHorizontal: spacing.md,
					},
				]}
			>
				<Text style={[typography.headline, { color: colors.textMuted }]}>
					{tr.amountInput.currency}
				</Text>
				<TextInput
					testID={testID}
					accessibilityLabel={label}
					accessibilityHint={helper}
					value={text}
					editable={editable}
					onChangeText={(raw) => {
						const next = nextAmountState(raw, text);
						setText(next.text);
						setLastValue(next.value);
						onChangeValue(next.value);
					}}
					keyboardType="decimal-pad"
					placeholder={tr.amountInput.placeholder}
					placeholderTextColor={colors.textMuted}
					maxFontSizeMultiplier={sizes.maxAmountFontScale}
					style={[
						styles.input,
						typography.headline,
						{ color: colors.text, fontVariant: ["tabular-nums"] },
					]}
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
