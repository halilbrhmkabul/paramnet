import { Text } from "react-native";

import { useAppTheme } from "@/theme/useAppTheme";

export function SectionHeader({ children }: { children: string }) {
	const { colors, typography } = useAppTheme();
	return (
		<Text accessibilityRole="header" style={[typography.headline, { color: colors.text }]}>
			{children}
		</Text>
	);
}
