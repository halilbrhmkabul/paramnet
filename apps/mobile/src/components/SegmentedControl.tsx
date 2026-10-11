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
			<Text style={[typography.callout, { color: colors.textMuted }]}>{label}</Text>
			<View
				accessibilityRole="radiogroup"
				accessibilityLabel={label}
				style={[
					styles.row,
					{
						borderRadius: radius.sm,
						borderColor: colors.border,
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
									minHeight: sizes.minTouch - 8,
									borderRadius: radius.sm,
									backgroundColor: selected ? colors.primary : "transparent",
								},
							]}
						>
							<Text
								style={[
									typography.callout,
									{ color: selected ? colors.onPrimary : colors.text },
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
		borderWidth: 1,
	},
	segment: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 4,
	},
});
