import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import type { Account, Card } from "@/api/types";
import { AmountText } from "@/components/AmountText";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

import { MiniCardMark } from "@/features/cards/cardParts";

import { accountSub } from "./cashModel";
import { AccountIcon } from "./parts";

export function AccountPickerSheet({
	visible,
	title,
	accounts,
	cards = [],
	selectedId,
	onSelect,
	onSelectCard,
	onClose,
}: {
	visible: boolean;
	title: string;
	accounts: readonly Account[];
	// Card purchases and card payments pick a card here too (ADR-055).
	cards?: readonly Card[];
	selectedId: string | null;
	onSelect: (account: Account) => void;
	onSelectCard?: (card: Card) => void;
	onClose: () => void;
}) {
	const { colors, typography, spacing, radius } = useAppTheme();
	return (
		<Modal
			visible={visible}
			animationType="slide"
			presentationStyle="pageSheet"
			onRequestClose={onClose}
		>
			<Screen
				testID="accountPicker.screen"
				edges={["top", "bottom"]}
				footer={
					<Button
						label={tr.common.close}
						variant="secondary"
						onPress={onClose}
						testID="accountPicker.close.button"
					/>
				}
			>
				<ScreenTitle>{title}</ScreenTitle>
				<View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
					{accounts.map((account, index) => {
						const selected = account.id === selectedId;
						return (
							<Pressable
								key={account.id}
								testID={`accountPicker.item.${String(index)}`}
								accessibilityRole="radio"
								accessibilityLabel={account.name}
								accessibilityState={{ checked: selected }}
								onPress={() => {
									onSelect(account);
								}}
								style={[
									styles.row,
									{
										gap: spacing.md,
										borderRadius: radius.md,
										borderColor: selected ? colors.accent : colors.border,
										borderWidth: selected ? 2 : 1,
										backgroundColor: colors.surface,
									},
								]}
							>
								<AccountIcon kind={account.kind} />
								<View style={styles.grow}>
									<Text style={[typography.rowTitle, { color: colors.text }]}>
										{account.name}
									</Text>
									<Text style={[typography.caption, { color: colors.textMuted }]}>
										{accountSub(account)}
									</Text>
								</View>
								<AmountText minor={account.balance_minor} variant="caption" />
							</Pressable>
						);
					})}
					{cards.map((card, index) => {
						const selected = card.id === selectedId;
						return (
							<Pressable
								key={card.id}
								testID={`accountPicker.card.${String(index)}`}
								accessibilityRole="radio"
								accessibilityLabel={card.label}
								accessibilityState={{ checked: selected }}
								onPress={() => {
									onSelectCard?.(card);
								}}
								style={[
									styles.row,
									{
										gap: spacing.md,
										borderRadius: radius.md,
										borderColor: selected ? colors.accent : colors.border,
										borderWidth: selected ? 2 : 1,
										backgroundColor: colors.surface,
									},
								]}
							>
								<MiniCardMark color={card.color} />
								<View style={styles.grow}>
									<Text style={[typography.rowTitle, { color: colors.text }]}>
										{card.label}
									</Text>
									<Text style={[typography.caption, { color: colors.textMuted }]}>
										{tr.cards.creditCard}
									</Text>
								</View>
								<AmountText minor={card.state.available_minor} variant="caption" />
							</Pressable>
						);
					})}
				</View>
			</Screen>
		</Modal>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", alignItems: "center", minHeight: 64, paddingHorizontal: 14 },
	grow: { flex: 1, minWidth: 0 },
});
