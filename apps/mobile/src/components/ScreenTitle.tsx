import { Text } from "react-native";

import { useAppTheme } from "@/theme/useAppTheme";

export function ScreenTitle({ children, testID }: { children: string; testID?: string }) {
	const { colors, typography } = useAppTheme();
	return (
		<Text
			testID={testID}
			accessibilityRole="header"
			style={[typography.title, { color: colors.text }]}
		>
			{children}
		</Text>
	);
}
