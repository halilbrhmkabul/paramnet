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

export function ProgressBar({ value, label, tone = "accent", testID }: ProgressBarProps) {
	const { colors } = useAppTheme();
	const ratio = Math.min(Math.max(value, 0), 1);
	return (
		<View
			testID={testID}
			accessibilityRole="progressbar"
			accessibilityLabel={label}
			accessibilityValue={{ min: 0, max: 100, now: Math.floor(ratio * 100) }}
			style={{
				height: 8,
				borderRadius: 4,
				backgroundColor: colors.track,
				overflow: "hidden",
			}}
		>
			<View style={{ flex: ratio, backgroundColor: colors[tone], borderRadius: 4 }} />
			<View style={{ flex: 1 - ratio }} />
		</View>
	);
}
