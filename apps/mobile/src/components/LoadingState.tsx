import { View } from "react-native";

import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

export type LoadingStateProps = {
	rows?: number;
	testID: string;
};

// Skeleton instead of a spinner so the layout does not jump when data arrives.
export function LoadingState({ rows = 3, testID }: LoadingStateProps) {
	const { colors, radius, spacing } = useAppTheme();
	return (
		<View
			testID={testID}
			accessible
			accessibilityLabel={tr.common.loading}
			accessibilityState={{ busy: true }}
			style={{ gap: spacing.md }}
		>
			{Array.from({ length: rows }, (_, i) => (
				<View
					key={i}
					style={{ height: 72, borderRadius: radius.md, backgroundColor: colors.surface }}
				/>
			))}
		</View>
	);
}
