import { Ionicons } from "@expo/vector-icons";
import { formatSignedTRY, type AccountKind } from "@paramnet/shared";
import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import type { Transaction } from "@/api/types";
import { Badge, type BadgeTone } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { tr } from "@/i18n/tr";
import type { ColorToken } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

import { monogram, signOf, titleOf } from "./cashModel";

type IconName = keyof typeof Ionicons.glyphMap;

// Design 29 / 33 ".ic": bank blue, cash green, savings violet-ish (pending tone keeps contrast), other grey.
export const ACCOUNT_LOOK: Record<AccountKind, { icon: IconName; tone: [ColorToken, ColorToken] }> =
	{
		bank: { icon: "business-outline", tone: ["pending", "pendingSoft"] },
		cash: { icon: "wallet-outline", tone: ["success", "successSoft"] },
		savings: { icon: "trending-up-outline", tone: ["primary", "primarySoft"] },
		other: { icon: "ellipsis-horizontal", tone: ["neutral", "neutralSoft"] },
	};

export function AccountIcon({ kind, size = 42 }: { kind: AccountKind; size?: number }) {
	const { colors } = useAppTheme();
	const { icon, tone } = ACCOUNT_LOOK[kind];
	return (
		<View
			style={[
				styles.icon,
				{ width: size, height: size, borderRadius: 12, backgroundColor: colors[tone[1]] },
			]}
		>
			<Ionicons name={icon} size={20} color={colors[tone[0]]} />
		</View>
	);
}

const KIND_LOOK: Record<Transaction["kind"], { tone: [ColorToken, ColorToken]; badge: BadgeTone }> =
	{
		income: { tone: ["success", "successSoft"], badge: "success" },
		expense: { tone: ["neutral", "surfaceSunken"], badge: "neutral" },
		transfer: { tone: ["pending", "pendingSoft"], badge: "pending" },
		adjustment: { tone: ["warning", "warningSoft"], badge: "warning" },
	};

export function amountTone(tx: Transaction): ColorToken {
	return tx.kind === "income" ? "receivable" : tx.kind === "transfer" ? "pending" : "text";
}

export function signedAmount(tx: Transaction): string {
	return formatSignedTRY(tx.amount_minor, signOf(tx));
}

// Design 36 ".row": a two-letter mark, title, a line under it, the signed amount and its kind.
export function TransactionRow({
	tx,
	sub,
	onPress,
	testID,
}: {
	tx: Transaction;
	sub: string;
	onPress: () => void;
	testID: string;
}) {
	const { colors, typography, fonts, spacing } = useAppTheme();
	const look = KIND_LOOK[tx.kind];
	const title = titleOf(tx);
	const amount = signedAmount(tx);
	const tag = tr.txHistory.tags[tx.kind];
	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={`${title}, ${sub}, ${amount}, ${tag}`}
			onPress={onPress}
			style={({ pressed }) => [
				styles.row,
				{ gap: spacing.md, paddingHorizontal: spacing.lg, opacity: pressed ? 0.7 : 1 },
			]}
		>
			<View style={[styles.icon, styles.mark, { backgroundColor: colors[look.tone[1]] }]}>
				{tx.kind === "transfer" ? (
					<Ionicons name="swap-horizontal" size={18} color={colors[look.tone[0]]} />
				) : (
					<Text
						style={{
							fontFamily: fonts.extrabold,
							fontSize: 13,
							color: colors[look.tone[0]],
						}}
					>
						{monogram(title)}
					</Text>
				)}
			</View>
			<View style={styles.grow}>
				<Text numberOfLines={1} style={[typography.rowTitle, { color: colors.text }]}>
					{title}
				</Text>
				<Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted }]}>
					{sub}
				</Text>
			</View>
			<View style={styles.end}>
				<Text
					testID={`${testID}.amount`}
					style={[
						typography.rowTitle,
						{
							fontFamily: fonts.extrabold,
							color: colors[amountTone(tx)],
							fontVariant: ["tabular-nums"],
						},
					]}
				>
					{amount}
				</Text>
				<Badge label={tag} tone={look.badge} />
			</View>
		</Pressable>
	);
}

// Design 37 ".sheet": a bottom confirmation for a destructive step (delete, archive).
export function ConfirmSheet({
	visible,
	title,
	body,
	confirmLabel,
	onConfirm,
	onCancel,
	busy,
	children,
	testID,
}: {
	visible: boolean;
	title: string;
	body: string;
	confirmLabel: string;
	onConfirm: () => void;
	onCancel: () => void;
	busy: boolean;
	children?: ReactNode;
	testID: string;
}) {
	const { colors, typography, spacing } = useAppTheme();
	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
			<View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
				<View
					testID={testID}
					accessibilityViewIsModal
					style={[styles.sheet, { backgroundColor: colors.surface, gap: spacing.md }]}
				>
					<View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
					<Text
						accessibilityRole="header"
						style={[typography.headline, { fontSize: 19, color: colors.text }]}
					>
						{title}
					</Text>
					<Text style={[typography.callout, { color: colors.textMuted }]}>{body}</Text>
					{children}
					<View style={[styles.buttons, { gap: spacing.sm }]}>
						<View style={styles.grow}>
							<Button
								label={tr.common.cancel}
								variant="secondary"
								onPress={onCancel}
								testID={`${testID}.cancel.button`}
							/>
						</View>
						<View style={styles.grow}>
							<Button
								label={confirmLabel}
								variant="danger"
								loading={busy}
								onPress={onConfirm}
								testID={`${testID}.confirm.button`}
							/>
						</View>
					</View>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	icon: { alignItems: "center", justifyContent: "center" },
	mark: { width: 40, height: 40, borderRadius: 12 },
	row: { flexDirection: "row", alignItems: "center", minHeight: 64, paddingVertical: 12 },
	grow: { flex: 1, minWidth: 0 },
	end: { alignItems: "flex-end", gap: 3 },
	scrim: { flex: 1, justifyContent: "flex-end" },
	sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 },
	handle: { width: 40, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: 6 },
	buttons: { flexDirection: "row", marginTop: 8 },
});
