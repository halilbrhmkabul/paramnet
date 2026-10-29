import { Ionicons } from "@expo/vector-icons";
import { formatDateTR, formatDateTimeTR, transactionRef } from "@paramnet/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useDeleteTransaction, useRestoreTransaction, useTransaction } from "@/api/hooks";
import type { Transaction, TransactionDetail } from "@/api/types";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { Badge } from "@/components/StatusBadge";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

import {
	categoryLabel,
	lastEditLine,
	monogram,
	sourceName,
	targetName,
	titleOf,
} from "./cashModel";
import { ConfirmSheet, amountTone, signedAmount } from "./parts";

// Design 37: "10 saniye içinde geri alabilirsin".
export const UNDO_MS = 10_000;

function InfoRow({
	label,
	value,
	mono = false,
	testID,
}: {
	label: string;
	value: string;
	mono?: boolean;
	testID: string;
}) {
	const { colors, typography, fonts } = useAppTheme();
	return (
		<View style={styles.kv}>
			<Text style={[typography.callout, { color: colors.textMuted }]}>{label}</Text>
			<Text
				testID={testID}
				style={[
					typography.rowTitle,
					styles.kvValue,
					{ color: colors.text },
					mono ? { fontFamily: fonts.mono } : null,
				]}
			>
				{value}
			</Text>
		</View>
	);
}

function rows(tx: Transaction): { label: string; value: string; key: string; mono?: boolean }[] {
	const list: { label: string; value: string; key: string; mono?: boolean }[] = [];
	const category = categoryLabel(tx);
	if (category !== null) {
		list.push({ label: tr.txDetail.category, value: category, key: "category" });
	}
	if (tx.kind === "transfer") {
		list.push({ label: tr.txDetail.from, value: sourceName(tx), key: "from" });
		list.push({ label: tr.txDetail.to, value: targetName(tx), key: "to" });
	} else {
		list.push({ label: tr.txDetail.account, value: sourceName(tx), key: "account" });
	}
	if (tx.installments > 1) {
		list.push({
			label: tr.txDetail.installments,
			value: fill(tr.txDetail.installmentsValue, { count: String(tx.installments) }),
			key: "installments",
		});
	}
	list.push({
		label: tr.txDetail.date,
		value: formatDateTR(tx.occurred_on, "long"),
		key: "date",
	});
	if (tx.note !== null) {
		list.push({ label: tr.txDetail.note, value: tx.note, key: "note" });
	}
	list.push({ label: tr.txDetail.ref, value: transactionRef(tx.id), key: "ref", mono: true });
	return list;
}

function Detail({ data }: { data: TransactionDetail }) {
	const { colors, typography, fonts, spacing, radius } = useAppTheme();
	const { transaction: tx, events } = data;
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [undoable, setUndoable] = useState<Transaction | null>(null);
	const remove = useDeleteTransaction();
	const restore = useRestoreTransaction();
	const title = titleOf(tx);
	const amount = signedAmount(tx);
	const deleted = tx.deleted_at !== null;
	const edit = lastEditLine(events, tx.kind);
	const created = events.find((event) => event.type === "created");

	// After the undo window the record is gone for this screen: back to where it was opened from.
	useEffect(() => {
		if (undoable === null) {
			return;
		}
		const timer = setTimeout(() => {
			router.back();
		}, UNDO_MS);
		return () => {
			clearTimeout(timer);
		};
	}, [undoable]);

	const error = remove.error ?? restore.error;

	return (
		<Screen testID="txDetail.screen" edges={["bottom"]}>
			<View style={styles.head}>
				<View style={[styles.bigIcon, { backgroundColor: colors.surfaceSunken }]}>
					{tx.kind === "transfer" ? (
						<Ionicons name="swap-horizontal" size={26} color={colors.pending} />
					) : (
						<Text
							style={{
								fontFamily: fonts.extrabold,
								fontSize: 18,
								color: colors.neutral,
							}}
						>
							{monogram(title)}
						</Text>
					)}
				</View>
				<Text
					testID="txDetail.title.text"
					style={[typography.headline, { color: colors.text, marginTop: 12 }]}
				>
					{title}
				</Text>
				<Text
					testID="txDetail.amount.text"
					style={[
						typography.amountXL,
						{ color: colors[amountTone(tx)], fontVariant: ["tabular-nums"] },
					]}
				>
					{amount}
				</Text>
				<View style={[styles.badges, { gap: 6 }]}>
					<Badge label={tr.txHistory.tags[tx.kind]} tone="neutral" />
					{deleted ? (
						<Badge
							label={tr.txDetail.deletedBadge}
							tone="overdue"
							testID="txDetail.deleted.badge"
						/>
					) : (
						<Badge label={tr.txDetail.done} tone="success" />
					)}
				</View>
			</View>

			<View
				style={{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderWidth: 1,
					borderRadius: radius.lg,
				}}
			>
				{rows(tx).map((row, index) => (
					<View key={row.key}>
						{index > 0 ? (
							<View style={[styles.divider, { backgroundColor: colors.divider }]} />
						) : null}
						<InfoRow
							label={row.label}
							value={row.value}
							mono={row.mono}
							testID={`txDetail.${row.key}.value`}
						/>
					</View>
				))}
			</View>

			<View
				style={[
					styles.note,
					{ backgroundColor: colors.pendingSoft, borderRadius: radius.sm, gap: 10 },
				]}
			>
				<Ionicons name="information-circle-outline" size={18} color={colors.pending} />
				<Text
					testID="txDetail.effect.text"
					style={[typography.caption, styles.grow, { color: colors.pending }]}
				>
					{tx.card_id !== null
						? tr.txDetail.effectCard
						: tx.to_card_id !== null
							? tr.txDetail.effectCardPayment
							: fill(tr.txDetail.effect[tx.kind], { account: sourceName(tx) })}
				</Text>
			</View>

			{undoable !== null ? (
				<View
					testID="txDetail.deleted.banner"
					accessibilityLiveRegion="polite"
					style={[
						styles.banner,
						{
							backgroundColor: colors.primary,
							borderRadius: radius.md,
							gap: spacing.md,
						},
					]}
				>
					<Text style={[typography.rowTitle, styles.grow, { color: colors.onPrimary }]}>
						{tr.txDetail.deleted}
					</Text>
					<Pressable
						testID="txDetail.undo.button"
						accessibilityRole="button"
						accessibilityLabel={tr.txDetail.undo}
						onPress={() => {
							restore.mutate(
								{ id: undoable.id, rowVersion: undoable.row_version },
								{
									onSuccess: () => {
										setUndoable(null);
									},
								},
							);
						}}
						style={styles.undo}
					>
						<Text
							style={{
								fontFamily: fonts.extrabold,
								fontSize: 15,
								color: colors.onPrimary,
							}}
						>
							{tr.txDetail.undo}
						</Text>
					</Pressable>
				</View>
			) : deleted ? null : (
				<View style={[styles.actions, { gap: spacing.sm }]}>
					{tx.kind === "adjustment" ? null : (
						<ActionButton
							label={tr.txDetail.edit}
							icon="create-outline"
							onPress={() => {
								router.push({
									pathname: "/transaction/[id]/edit",
									params: { id: tx.id },
								});
							}}
							testID="txDetail.edit.button"
						/>
					)}
					<ActionButton
						label={tr.txDetail.delete}
						icon="trash-outline"
						danger
						onPress={() => {
							setConfirmOpen(true);
						}}
						testID="txDetail.delete.button"
					/>
				</View>
			)}

			{error === null ? null : (
				<Text
					accessibilityLiveRegion="polite"
					style={[typography.caption, { color: colors.overdue }]}
				>
					{messageForError(error)}
				</Text>
			)}

			<View style={{ gap: 2, paddingHorizontal: 4 }}>
				{created === undefined ? null : (
					<Text
						testID="txDetail.created.text"
						style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}
					>
						{fill(tr.txDetail.created, { time: formatDateTimeTR(created.created_at) })}
					</Text>
				)}
				{edit === null ? null : (
					<Text
						testID="txDetail.lastEdit.text"
						style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}
					>
						{edit}
					</Text>
				)}
			</View>

			<ConfirmSheet
				visible={confirmOpen}
				title={tr.txDetail.deleteTitle}
				body={fill(tr.txDetail.deleteBody, { title, amount, account: sourceName(tx) })}
				confirmLabel={tr.txDetail.delete}
				busy={remove.isPending}
				onCancel={() => {
					setConfirmOpen(false);
				}}
				onConfirm={() => {
					remove.mutate(
						{ id: tx.id, rowVersion: tx.row_version },
						{
							onSuccess: (result) => {
								setConfirmOpen(false);
								setUndoable(result);
							},
							onError: () => {
								setConfirmOpen(false);
							},
						},
					);
				}}
				testID="txDetail.delete.sheet"
			/>
		</Screen>
	);
}

function ActionButton({
	label,
	icon,
	danger = false,
	onPress,
	testID,
}: {
	label: string;
	icon: keyof typeof Ionicons.glyphMap;
	danger?: boolean;
	onPress: () => void;
	testID: string;
}) {
	const { colors, fonts, radius } = useAppTheme();
	const tone = danger ? colors.overdue : colors.primary;
	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			style={({ pressed }) => [
				styles.action,
				{
					borderRadius: radius.md,
					backgroundColor: colors.surface,
					borderColor: danger ? colors.dangerBorder : colors.border,
					opacity: pressed ? 0.7 : 1,
				},
			]}
		>
			<Ionicons name={icon} size={20} color={tone} />
			<Text style={{ fontFamily: fonts.bold, fontSize: 13, color: tone }}>{label}</Text>
		</Pressable>
	);
}

export function TransactionDetailScreen({ id }: { id: string }) {
	const detail = useTransaction(id);
	if (detail.isPending) {
		return (
			<Screen testID="txDetail.screen" edges={["bottom"]}>
				<LoadingState rows={4} testID="txDetail.loading" />
			</Screen>
		);
	}
	if (detail.isError) {
		return (
			<Screen testID="txDetail.screen" edges={["bottom"]}>
				<ErrorState
					message={messageForError(detail.error)}
					onRetry={() => {
						void detail.refetch();
					}}
					testID="txDetail.error"
				/>
			</Screen>
		);
	}
	return <Detail data={detail.data} />;
}

const styles = StyleSheet.create({
	grow: { flex: 1, minWidth: 0 },
	head: { alignItems: "center" },
	bigIcon: {
		width: 60,
		height: 60,
		borderRadius: 18,
		alignItems: "center",
		justifyContent: "center",
	},
	badges: { flexDirection: "row", marginTop: 8 },
	kv: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 12,
		minHeight: 48,
	},
	kvValue: { flexShrink: 1, textAlign: "right" },
	divider: { height: 1 },
	note: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 12 },
	banner: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, minHeight: 56 },
	undo: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" },
	actions: { flexDirection: "row" },
	action: {
		flex: 1,
		height: 72,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
	},
});
