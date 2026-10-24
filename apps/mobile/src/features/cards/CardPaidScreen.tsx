import { Ionicons } from "@expo/vector-icons";
import { formatDateTimeTR, formatTRY, monthName, transactionRef } from "@paramnet/shared";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { messageForError } from "@/api/errors";
import { useDeleteTransaction, useTransaction } from "@/api/hooks";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

// Design 11 after a card payment: what was recorded and what is left; "Geri al" deletes the record.
export function CardPaidScreen({
	txId,
	beforeMinor,
	remainingMinor,
}: {
	txId: string;
	beforeMinor: number;
	remainingMinor: number;
}) {
	const { colors, typography, fonts, spacing, radius, sizes } = useAppTheme();
	const detail = useTransaction(txId);
	const undo = useDeleteTransaction();
	const shell = (children: React.ReactNode) => (
		<SafeAreaView
			testID="cardPaid.screen"
			edges={["top", "bottom"]}
			style={{
				flex: 1,
				backgroundColor: colors.bg,
				paddingHorizontal: sizes.screenPadding,
				paddingBottom: spacing.xl,
			}}
		>
			{children}
		</SafeAreaView>
	);
	if (detail.isPending) {
		return shell(<LoadingState rows={3} testID="cardPaid.loading" />);
	}
	if (detail.isError) {
		return shell(
			<ErrorState
				message={messageForError(detail.error)}
				onRetry={() => {
					void detail.refetch();
				}}
				testID="cardPaid.error"
			/>,
		);
	}
	const tx = detail.data.transaction;
	const kv = (label: string, value: string, tone: string, testID: string, first = false) => (
		<View
			style={[
				styles.kv,
				first ? null : { borderTopWidth: 1, borderTopColor: colors.divider },
			]}
		>
			<Text style={[typography.callout, { color: colors.textMuted }]}>{label}</Text>
			<Text
				testID={testID}
				style={{
					fontFamily: fonts.bold,
					fontSize: 14,
					color: tone,
					textAlign: "right",
					flexShrink: 1,
				}}
			>
				{value}
			</Text>
		</View>
	);
	return shell(
		<>
			<View style={styles.top}>
				<View style={[styles.ring, { backgroundColor: colors.primarySoft }]}>
					<View style={[styles.check, { backgroundColor: colors.accent }]}>
						<Ionicons name="checkmark" size={32} color={colors.onPrimary} />
					</View>
				</View>
				<Text
					accessibilityRole="header"
					style={[typography.title, { fontSize: 24, color: colors.text, marginTop: 22 }]}
				>
					{tr.cardPaid.title}
				</Text>
				<Text
					testID="cardPaid.amount"
					style={[typography.amountXL, { color: colors.primary, marginTop: 6 }]}
				>
					{formatTRY(tx.amount_minor)}
				</Text>
				<Text
					style={[
						typography.callout,
						{ color: colors.textMuted, marginTop: 4, textAlign: "center" },
					]}
				>
					{fill(tr.cardPaid.line, {
						card: tx.to_card_name ?? "",
						month: monthName(Number(tx.occurred_on.slice(5, 7))),
					})}
				</Text>
			</View>
			<View
				style={{
					marginTop: 28,
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderWidth: 1,
					borderRadius: radius.lg,
				}}
			>
				{kv(
					tr.cardPaid.remaining,
					remainingMinor === 0
						? fill(tr.cardPaid.closed, { amount: formatTRY(0) })
						: formatTRY(remainingMinor),
					remainingMinor === 0 ? colors.receivable : colors.text,
					"cardPaid.remaining",
					true,
				)}
				{kv(
					tx.account_name ?? "",
					fill(tr.cardPaid.move, {
						from: formatTRY(beforeMinor),
						to: formatTRY(beforeMinor - tx.amount_minor),
					}),
					colors.text,
					"cardPaid.account",
				)}
				{kv(
					tr.cardPaid.date,
					formatDateTimeTR(tx.created_at),
					colors.text,
					"cardPaid.date",
				)}
				{kv(tr.cardPaid.ref, transactionRef(tx.id), colors.text, "cardPaid.ref")}
			</View>
			<View
				style={[
					styles.note,
					{ backgroundColor: colors.surfaceSunken, borderRadius: radius.sm, gap: 10 },
				]}
			>
				<Ionicons name="information-circle-outline" size={18} color={colors.accent} />
				<Text style={[typography.caption, { flex: 1, color: colors.text }]}>
					{tr.cardPaid.note}
				</Text>
			</View>
			<View style={{ marginTop: "auto", gap: 10 }}>
				{undo.error === null ? null : (
					<Text
						accessibilityLiveRegion="polite"
						style={[typography.caption, { color: colors.overdue }]}
					>
						{messageForError(undo.error)}
					</Text>
				)}
				<Button
					label={tr.cardPaid.home}
					onPress={() => {
						router.dismissAll();
						router.navigate("/");
					}}
					testID="cardPaid.home.button"
				/>
				<Button
					label={tr.cardPaid.undo}
					variant="secondary"
					loading={undo.isPending}
					onPress={() => {
						undo.mutate(
							{ id: tx.id, rowVersion: tx.row_version },
							{
								onSuccess: () => {
									router.back();
								},
							},
						);
					}}
					testID="cardPaid.undo.button"
				/>
			</View>
		</>,
	);
}

const styles = StyleSheet.create({
	top: { alignItems: "center", paddingTop: 72 },
	ring: {
		width: 88,
		height: 88,
		borderRadius: 44,
		alignItems: "center",
		justifyContent: "center",
	},
	check: {
		width: 60,
		height: 60,
		borderRadius: 30,
		alignItems: "center",
		justifyContent: "center",
	},
	kv: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 12,
		minHeight: 48,
	},
	note: {
		flexDirection: "row",
		alignItems: "flex-start",
		marginTop: 12,
		paddingHorizontal: 14,
		paddingVertical: 12,
	},
});
