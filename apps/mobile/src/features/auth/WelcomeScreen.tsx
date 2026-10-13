import { router } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { Brand } from "@/components/Brand";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

const ICONS = ["albums-outline", "notifications-outline", "people-outline"] as const;

// S01: promise + three skippable intro cards (spec 5.1), design 01 / 31.
export function WelcomeScreen() {
	const { colors, typography, spacing } = useAppTheme();
	const [index, setIndex] = useState(0);
	const cards = tr.welcome.cards;
	const card = cards[index] ?? cards[0];
	const isLast = index === cards.length - 1;

	function goToPhone() {
		router.push("/phone");
	}

	return (
		<Screen
			testID="welcome.screen"
			edges={["top", "bottom"]}
			footer={
				<View style={{ gap: spacing.sm }}>
					<Button
						label={isLast ? tr.welcome.cta : tr.welcome.next}
						onPress={() => {
							if (isLast) {
								goToPhone();
							} else {
								setIndex(index + 1);
							}
						}}
						testID="welcome.next.button"
					/>
					{isLast ? null : (
						<Button
							label={tr.welcome.skip}
							variant="ghost"
							onPress={goToPhone}
							testID="welcome.skip.button"
						/>
					)}
				</View>
			}
		>
			<Brand size={22} testID="welcome.brand" />
			<Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
				{tr.welcome.title}
			</Text>
			<Text style={[typography.body, { color: colors.textMuted }]}>
				{tr.welcome.subtitle}
			</Text>
			<Card
				testID={`welcome.card.${String(index + 1)}`}
				style={{ gap: spacing.md, paddingVertical: spacing.xl }}
			>
				<View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
					<Ionicons
						name={ICONS[index] ?? "albums-outline"}
						size={26}
						color={colors.primary}
					/>
				</View>
				<Text style={[typography.headline, { color: colors.text }]}>{card.title}</Text>
				<Text style={[typography.body, { color: colors.textMuted }]}>{card.body}</Text>
			</Card>
			<View
				testID="welcome.dots"
				accessibilityLabel={fill(tr.welcome.cardPosition, {
					current: String(index + 1),
					total: String(cards.length),
				})}
				style={[styles.dots, { gap: spacing.xs }]}
			>
				{cards.map((item, i) => (
					<View
						key={item.title}
						style={[
							styles.dot,
							{
								width: i === index ? 22 : 8,
								backgroundColor: i === index ? colors.primary : colors.borderStrong,
							},
						]}
					/>
				))}
			</View>
			<Text style={[typography.caption, { color: colors.textMuted }]}>
				{tr.welcome.disclaimer}
			</Text>
		</Screen>
	);
}

const styles = StyleSheet.create({
	icon: {
		width: 56,
		height: 56,
		borderRadius: 18,
		alignItems: "center",
		justifyContent: "center",
	},
	dots: { flexDirection: "row", alignSelf: "center" },
	dot: { height: 8, borderRadius: 4 },
});
