import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

// The wordmark from the design: a forest mark, "Param" heavy, "net" light in emerald.
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
				<Ionicons name="leaf-outline" size={mark * 0.58} color={colors.onPrimary} />
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
