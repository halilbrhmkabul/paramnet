import { View } from "react-native";

import type { ColorToken } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

export type ProgressBarProps = {
	// 0..1
	value: number;
	label: string;
	tone?: ColorToken;
	testID?: string;
};

export function ProgressBar({ value, label, tone = "primary", testID }: ProgressBarProps) {
	const { colors, radius } = useAppTheme();
	const ratio = Math.min(Math.max(value, 0), 1);
	return (
		<View
			testID={testID}
			accessibilityRole="progressbar"
			accessibilityLabel={label}
			accessibilityValue={{ min: 0, max: 100, now: Math.floor(ratio * 100) }}
			style={{
				height: 8,
				borderRadius: radius.sm,
				backgroundColor: colors.border,
				overflow: "hidden",
			}}
		>
			<View style={{ flex: ratio, backgroundColor: colors[tone] }} />
			<View style={{ flex: 1 - ratio }} />
		</View>
	);
}
