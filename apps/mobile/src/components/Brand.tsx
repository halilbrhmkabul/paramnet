import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

// The wordmark from the design: a forest mark with a mint "R", "Param" heavy, "Net" light in emerald.
export function Brand({ size = 18, testID }: { size?: number; testID?: string }) {
	const { colors, fonts } = useAppTheme();
	const mark = Math.round(size * 1.45);
	return (
		<View
			testID={testID}
			style={styles.brand}
			accessibilityRole="header"
			accessibilityLabel={tr.common.appName}
		>
			<View
				style={[
					styles.mark,
					{
						width: mark,
						height: mark,
						borderRadius: mark * 0.3,
						backgroundColor: colors.primary,
					},
				]}
			>
				<Icon name="brand" size={mark * 0.62} tone="brandMark" strokeWidth={2.4} />
			</View>
			<Text style={{ fontFamily: fonts.extrabold, fontSize: size, color: colors.primary }}>
				{tr.brand.first}
				<Text style={{ fontFamily: fonts.medium, color: colors.accent }}>
					{tr.brand.second}
				</Text>
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	brand: { flexDirection: "row", alignItems: "center", gap: 8 },
	mark: { alignItems: "center", justifyContent: "center" },
});
