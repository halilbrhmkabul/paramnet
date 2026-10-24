import { formatDateTR, formatTRY, monthOf } from "@paramnet/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { messageForError } from "@/api/errors";
import { useAccounts, useTransactions } from "@/api/hooks";
import type { Account } from "@/api/types";
import { AmountText } from "@/components/AmountText";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { Badge } from "@/components/StatusBadge";
import { IconButton } from "@/components/TopBar";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { useAppTheme } from "@/theme/useAppTheme";

import { accountSub, monthTitle } from "./cashModel";
import { AccountIcon, TransactionRow } from "./parts";

type IconName = keyof typeof Ionicons.glyphMap;

function ActionTile({
	label,
	icon,
	onPress,
	testID,
}: {
	label: string;
	icon: IconName;
	onPress: () => void;
	testID: string;
}) {
	const { colors, fonts, radius } = useAppTheme();
	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			style={({ pressed }) => [
				styles.tile,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderRadius: radius.md,
					opacity: pressed ? 0.7 : 1,
				},
			]}
		>
			<Ionicons name={icon} size={20} color={colors.primary} />
			<Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>
				{label}
			</Text>
		</Pressable>
	);
}

function AccountRow({
	account,
	selected,
	onPress,
	testID,
}: {
	account: Account;
	selected: boolean;
	onPress: () => void;
	testID: string;
}) {
	const { colors, typography, spacing } = useAppTheme();
	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityState={{ selected }}
			accessibilityLabel={fill(tr.accounts.select, {
				name: account.name,
				amount: formatTRY(account.balance_minor),
			})}
			onPress={onPress}
			style={({ pressed }) => [
				styles.row,
				{
					gap: spacing.md,
					paddingHorizontal: spacing.lg,
					backgroundColor: selected ? colors.surfaceSunken : "transparent",
					opacity: pressed ? 0.7 : 1,
				},
			]}
		>
			<AccountIcon kind={account.kind} />
			<View style={styles.grow}>
				<Text numberOfLines={1} style={[typography.rowTitle, { color: colors.text }]}>
					{account.name}
				</Text>
				<Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted }]}>
					{accountSub(account)}
				</Text>
			</View>
			<View style={styles.end}>
				<AmountText
					minor={account.balance_minor}
					variant="rowTitle"
					style={{ fontSize: 15 }}
					testID={`${testID}.balance`}
				/>
				<Badge
					label={account.include_in_total ? tr.accounts.manual : tr.accounts.excluded}
					tone="neutral"
				/>
			</View>
		</Pressable>
	);
}

function Movements({ account }: { account: Account }) {
	const { colors, typography, spacing, radius } = useAppTheme();
	const month = monthOf(useToday());
	const list = useTransactions(month, account.id);
	return (
		<View testID="accounts.movements" style={{ gap: spacing.sm }}>
			<View style={styles.between}>
				<Text
					accessibilityRole="header"
					style={[typography.headline, styles.grow, { color: colors.text }]}
				>
					{fill(tr.accounts.movements, { name: account.name, month: monthTitle(month) })}
				</Text>
				<IconButton
					icon="create-outline"
					label={fill(tr.accounts.edit, { name: account.name })}
					onPress={() => {
						router.push({
							pathname: "/accounts/[id]/edit",
							params: { id: account.id },
						});
					}}
					testID="accounts.edit.button"
				/>
			</View>
			{list.isPending ? (
				<LoadingState rows={2} testID="accounts.movements.loading" />
			) : list.isError ? (
				<ErrorState
					message={messageForError(list.error)}
					onRetry={() => {
						void list.refetch();
					}}
					testID="accounts.movements.error"
				/>
			) : list.data.items.length === 0 ? (
				<Text style={[typography.body, { color: colors.textMuted }]}>
					{tr.accounts.noMovements}
				</Text>
			) : (
				<View
					style={{
						backgroundColor: colors.surface,
						borderColor: colors.border,
						borderWidth: 1,
						borderRadius: radius.lg,
					}}
				>
					{list.data.items.map((tx, index) => (
						<View key={tx.id}>
							{index > 0 ? (
								<View
									style={[styles.divider, { backgroundColor: colors.divider }]}
								/>
							) : null}
							<TransactionRow
								tx={tx}
								sub={formatDateTR(tx.occurred_on, "dayMonth")}
								onPress={() => {
									router.push({
										pathname: "/transaction/[id]",
										params: { id: tx.id },
									});
								}}
								testID={`accounts.movement.${String(index)}`}
							/>
						</View>
					))}
				</View>
			)}
			<Pressable
				testID="accounts.allTransactions.link"
				accessibilityRole="link"
				onPress={() => {
					router.push("/transactions");
				}}
				style={styles.link}
			>
				<Text style={[typography.rowTitle, { color: colors.accent }]}>
					{tr.accounts.allTransactions}
				</Text>
			</Pressable>
		</View>
	);
}

// Design 29: Toplam Nakit, three actions, the accounts and the selected one's month.
export function AccountsScreen() {
	const { colors, typography, spacing, radius } = useAppTheme();
	const accounts = useAccounts();
	const [selectedId, setSelectedId] = useState<string | null>(null);

	if (accounts.isPending) {
		return (
			<Screen testID="accounts.screen" edges={["bottom"]}>
				<LoadingState rows={4} testID="accounts.loading" />
			</Screen>
		);
	}
	if (accounts.isError) {
		return (
			<Screen testID="accounts.screen" edges={["bottom"]}>
				<ErrorState
					message={messageForError(accounts.error)}
					onRetry={() => {
						void accounts.refetch();
					}}
					testID="accounts.error"
				/>
			</Screen>
		);
	}
	const { accounts: items, total_cash_minor, included_count } = accounts.data;
	if (items.length === 0) {
		return (
			<Screen testID="accounts.screen" edges={["bottom"]}>
				<EmptyState
					title={tr.accounts.emptyTitle}
					body={tr.accounts.emptyBody}
					actionLabel={tr.accounts.add}
					onAction={() => {
						router.push("/accounts/new");
					}}
					actionTestID="accounts.empty.action"
					testID="accounts.empty"
				/>
			</Screen>
		);
	}
	const selected = items.find((a) => a.id === selectedId) ?? items[0];

	return (
		<Screen
			testID="accounts.screen"
			edges={["bottom"]}
			refreshControl={
				<RefreshControl
					refreshing={accounts.isRefetching}
					onRefresh={() => {
						void accounts.refetch();
					}}
				/>
			}
		>
			<View style={styles.center}>
				<Text style={[typography.label, { color: colors.textMuted }]}>
					{fill(tr.accounts.totalWithCount, { count: String(included_count) })}
				</Text>
				<AmountText
					minor={total_cash_minor}
					variant="amountXL"
					tone="primary"
					testID="accounts.total.amount"
				/>
				<Text style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}>
					{tr.accounts.manualNote}
				</Text>
			</View>

			<View style={[styles.tiles, { gap: spacing.sm }]}>
				<ActionTile
					label={tr.accounts.add}
					icon="add"
					onPress={() => {
						router.push("/accounts/new");
					}}
					testID="accounts.add.button"
				/>
				<ActionTile
					label={tr.accounts.transfer}
					icon="swap-horizontal"
					onPress={() => {
						router.push({
							pathname: "/transaction/new",
							params: { kind: "transfer", account: selected?.id ?? "" },
						});
					}}
					testID="accounts.transfer.button"
				/>
				<ActionTile
					label={tr.accounts.adjust}
					icon="options-outline"
					onPress={() => {
						if (selected !== undefined) {
							router.push({
								pathname: "/accounts/[id]/adjust",
								params: { id: selected.id },
							});
						}
					}}
					testID="accounts.adjust.button"
				/>
			</View>

			<View
				style={{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderWidth: 1,
					borderRadius: radius.lg,
					overflow: "hidden",
				}}
			>
				{items.map((account, index) => (
					<View key={account.id}>
						{index > 0 ? (
							<View style={[styles.divider, { backgroundColor: colors.divider }]} />
						) : null}
						<AccountRow
							account={account}
							selected={account.id === selected?.id}
							onPress={() => {
								setSelectedId(account.id);
							}}
							testID={`accounts.item.${String(index)}`}
						/>
					</View>
				))}
			</View>

			{selected === undefined ? null : <Movements account={selected} />}
		</Screen>
	);
}

const styles = StyleSheet.create({
	center: { alignItems: "center", gap: 2 },
	tiles: { flexDirection: "row" },
	tile: {
		flex: 1,
		height: 72,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
	},
	row: { flexDirection: "row", alignItems: "center", minHeight: 66, paddingVertical: 12 },
	grow: { flex: 1, minWidth: 0 },
	end: { alignItems: "flex-end", gap: 3 },
	divider: { height: 1 },
	between: { flexDirection: "row", alignItems: "center", gap: 8 },
	link: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
});
