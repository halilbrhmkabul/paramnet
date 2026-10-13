import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

// Design 07 "Kartlarım". The card module arrives with F4-05; until then the design's empty state.
export function CardsScreen() {
	const { colors, typography, spacing } = useAppTheme();
	return (
		<Screen testID="cards.screen">
			<ScreenTitle>{tr.cards.title}</ScreenTitle>
			<View testID="cards.empty" style={[styles.empty, { gap: spacing.md }]}>
				<View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
					<Icon name="card" size={28} tone="primary" />
				</View>
				<Text style={[typography.headline, styles.center, { color: colors.text }]}>
					{tr.cards.emptyTitle}
				</Text>
				<Text style={[typography.callout, styles.center, { color: colors.textMuted }]}>
					{tr.cards.emptyBody}
				</Text>
				<Button
					label={tr.cards.add}
					disabled
					onPress={() => undefined}
					testID="cards.add.button"
				/>
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	empty: { alignItems: "stretch", paddingTop: 48 },
	icon: {
		width: 64,
		height: 64,
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center",
		alignSelf: "center",
	},
	center: { textAlign: "center" },
});
