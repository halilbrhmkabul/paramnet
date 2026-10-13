import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/theme/useAppTheme";

export type SegmentOption<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
	label: string;
	options: readonly SegmentOption<T>[];
	value: T;
	onChange: (value: T) => void;
	testID: string;
};

export function SegmentedControl<T extends string>({
	label,
	options,
	value,
	onChange,
	testID,
}: SegmentedControlProps<T>) {
	const { colors, typography, radius, spacing, sizes } = useAppTheme();
	return (
		<View style={{ gap: spacing.xs }}>
			<Text style={[typography.label, { color: colors.textMuted }]}>{label}</Text>
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
							]}
						>
							<Text
								style={[
									typography.rowTitle,
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
});
