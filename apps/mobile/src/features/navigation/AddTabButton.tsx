import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

export function AddTabButton() {
	const { colors } = useAppTheme();
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
						// Design "İşlem" FAB: a rounded square in the tab bar.
						width: 52,
						height: 40,
						borderRadius: 13,
						backgroundColor: colors.primary,
						opacity: pressed ? 0.85 : 1,
					},
				]}
			>
				<Ionicons name="add" size={24} color={colors.onPrimary} />
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
