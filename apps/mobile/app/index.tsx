import { useTheme } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { tr } from "@/i18n/tr";

export default function IndexScreen() {
	const { colors } = useTheme();

	return (
		<View style={styles.container}>
			<Text
				testID="home.appName.text"
				accessibilityRole="header"
				style={[styles.title, { color: colors.text }]}
			>
				{tr.common.appName}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	title: {
		fontSize: 28,
		fontWeight: "600",
	},
});
