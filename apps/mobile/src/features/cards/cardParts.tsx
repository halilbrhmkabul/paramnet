import type { CardColor } from "@paramnet/shared";
import { StyleSheet, Text, View } from "react-native";

import { tr, fill } from "@/i18n/tr";
import type { ColorToken } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

export const CARD_FACE: Record<CardColor, ColorToken> = {
	navy: "cardNavy",
	graphite: "cardGraphite",
	midnight: "cardMidnight",
	bordeaux: "cardBordeaux",
};

// Design ".bank": the card as the user knows it, with only the last four digits.
export function CardFace({
	bank,
	name,
	last4,
	color,
	footer,
	testID,
}: {
	bank: string;
	name: string | null;
	last4: string;
	color: CardColor;
	footer: string;
	testID?: string;
}) {
	const { colors, fonts } = useAppTheme();
	const ink = colors.onCard;
	return (
		<View
			testID={testID}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			style={[styles.face, { backgroundColor: colors[CARD_FACE[color]] }]}
		>
			<View style={styles.between}>
				<View>
					<Text style={{ fontFamily: fonts.extrabold, fontSize: 16, color: ink }}>
						{bank}
					</Text>
					<Text
						style={{
							fontFamily: fonts.semibold,
							fontSize: 12,
							color: ink,
							opacity: 0.75,
						}}
					>
						{tr.cards.creditCard}
					</Text>
				</View>
				{name === null ? null : (
					<Text
						style={{
							fontFamily: fonts.extrabold,
							fontSize: 15,
							color: ink,
							opacity: 0.9,
						}}
					>
						{name}
					</Text>
				)}
			</View>
			<View style={[styles.chip, { backgroundColor: colors.cardChip }]} />
			<Text
				style={{
					marginTop: "auto",
					fontFamily: fonts.mono,
					fontSize: 17,
					letterSpacing: 2,
					color: ink,
				}}
			>
				{fill(tr.cards.masked, { last4 })}
			</Text>
			<Text
				style={{
					marginTop: 8,
					fontFamily: fonts.bold,
					fontSize: 11,
					letterSpacing: 0.6,
					color: ink,
					opacity: 0.85,
					textAlign: "right",
				}}
			>
				{footer}
			</Text>
		</View>
	);
}

export function MiniCard({
	color,
	bank,
	last4,
}: {
	color: CardColor;
	bank: string;
	last4: string;
}) {
	const { colors, fonts } = useAppTheme();
	return (
		<View
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			style={[styles.mini, { backgroundColor: colors[CARD_FACE[color]] }]}
		>
			<Text style={{ fontFamily: fonts.extrabold, fontSize: 10, color: colors.onCard }}>
				{bank}
			</Text>
			<View style={[styles.miniChip, { backgroundColor: colors.cardChip }]} />
			<Text
				style={{
					marginTop: "auto",
					fontFamily: fonts.mono,
					fontSize: 10,
					color: colors.onCard,
				}}
			>
				{`•••• ${last4}`}
			</Text>
		</View>
	);
}

// A card's colour as a 42 pt icon, for lists that mix accounts and cards.
export function MiniCardMark({ color }: { color: CardColor }) {
	const { colors } = useAppTheme();
	return (
		<View style={[styles.mark, { backgroundColor: colors[CARD_FACE[color]] }]}>
			<View style={[styles.markChip, { backgroundColor: colors.cardChip }]} />
		</View>
	);
}

const styles = StyleSheet.create({
	mark: { width: 42, height: 30, borderRadius: 6, padding: 5, justifyContent: "flex-end" },
	markChip: { width: 10, height: 7, borderRadius: 2 },
	face: { height: 196, borderRadius: 22, paddingHorizontal: 22, paddingVertical: 20 },
	between: { flexDirection: "row", justifyContent: "space-between" },
	chip: { width: 42, height: 31, borderRadius: 7, marginTop: 18 },
	mini: { width: 132, height: 82, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
	miniChip: { width: 22, height: 16, borderRadius: 4, marginTop: 8 },
});
