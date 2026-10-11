import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

export function AddTabButton() {
	const { colors, sizes } = useAppTheme();
	return (
		<View style={styles.slot}>
			<Pressable
				testID="tabs.new.button"
				accessibilityRole="button"
				accessibilityLabel={tr.tabs.new}
				onPress={() => {
					router.push("/new");
				}}
				style={({ pressed }) => [
					styles.button,
					{
						width: sizes.buttonPrimary,
						height: sizes.buttonPrimary,
						borderRadius: sizes.buttonPrimary / 2,
						backgroundColor: colors.primary,
						opacity: pressed ? 0.85 : 1,
					},
				]}
			>
				<Ionicons name="add" size={28} color={colors.onPrimary} />
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	slot: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	button: {
		alignItems: "center",
		justifyContent: "center",
	},
});
