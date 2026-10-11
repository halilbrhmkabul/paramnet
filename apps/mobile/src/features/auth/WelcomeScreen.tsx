import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

// S01: promise + three skippable intro cards (spec 5.1).
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
			<Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
				{tr.welcome.title}
			</Text>
			<Text style={[typography.body, { color: colors.textMuted }]}>
				{tr.welcome.subtitle}
			</Text>
			<Card testID={`welcome.card.${String(index + 1)}`}>
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{fill(tr.welcome.cardPosition, {
						current: String(index + 1),
						total: String(cards.length),
					})}
				</Text>
				<Text style={[typography.headline, { color: colors.text }]}>{card.title}</Text>
				<Text style={[typography.body, { color: colors.textMuted }]}>{card.body}</Text>
			</Card>
		</Screen>
	);
}
