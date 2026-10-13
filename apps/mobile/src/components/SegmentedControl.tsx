import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/theme/useAppTheme";

// `testID` names the option's text, for screens that read it (the calendar's month label).
export type SegmentOption<T extends string> = { value: T; label: string; testID?: string };

export type SegmentedControlProps<T extends string> = {
	label: string;
	options: readonly SegmentOption<T>[];
	value: T;
	onChange: (value: T) => void;
	// The label still names the group for screen readers; hidden when the screen title says it.
	hideLabel?: boolean;
	// Design 26: four short options at 14 pt instead of two at 15.
	compact?: boolean;
	testID: string;
};

export function SegmentedControl<T extends string>({
	label,
	options,
	value,
	onChange,
	hideLabel = false,
	compact = false,
	testID,
}: SegmentedControlProps<T>) {
	const { colors, typography, fonts, radius, spacing, sizes } = useAppTheme();
	return (
		<View style={{ gap: spacing.xs }}>
			{hideLabel ? null : (
				<Text style={[typography.label, { color: colors.textMuted }]}>{label}</Text>
			)}
			<View
				accessibilityRole="radiogroup"
				accessibilityLabel={label}
				style={[
					styles.row,
					{
						borderRadius: radius.sm,
						backgroundColor: colors.track,
						gap: spacing.xs,
						padding: spacing.xs,
					},
				]}
			>
				{options.map((option) => {
					const selected = option.value === value;
					return (
						<Pressable
							key={option.value}
							testID={`${testID}.${option.value}`}
							accessibilityRole="radio"
							accessibilityLabel={option.label}
							accessibilityState={{ selected, checked: selected }}
							onPress={() => {
								onChange(option.value);
							}}
							style={[
								styles.segment,
								{
									minHeight: sizes.minTouch,
									borderRadius: 11,
									backgroundColor: selected ? colors.surface : "transparent",
								},
								selected ? [styles.raised, { shadowColor: colors.shadow }] : null,
							]}
						>
							<Text
								testID={option.testID}
								numberOfLines={1}
								style={[
									typography.rowTitle,
									compact ? { fontFamily: fonts.bold, fontSize: 14 } : null,
									{ color: selected ? colors.primary : colors.neutral },
								]}
							>
								{option.label}
							</Text>
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
	},
	segment: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 4,
	},
	// Design ".seg>.on": a hairline lift under the selected option.
	raised: {
		shadowOpacity: 0.1,
		shadowRadius: 2,
		shadowOffset: { width: 0, height: 1 },
		elevation: 1,
	},
});
