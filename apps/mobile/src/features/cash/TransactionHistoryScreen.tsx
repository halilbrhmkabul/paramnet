import { Ionicons } from "@expo/vector-icons";
import { formatSignedTRY, monthOf, shiftMonth, type IsoDate } from "@paramnet/shared";
import { router } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useTransactions } from "@/api/hooks";
import type { Transaction } from "@/api/types";
import { Chip } from "@/components/Chip";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { IconButton } from "@/components/TopBar";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { useAppTheme } from "@/theme/useAppTheme";

import {
	categoryLabel,
	dayLabel,
	filterTransactions,
	groupByDay,
	monthTitle,
	sourceName,
	type CashFilter,
} from "./cashModel";
import { TransactionRow } from "./parts";

const FILTERS: readonly CashFilter[] = ["all", "income", "expense", "transfer"];

function subOf(tx: Transaction): string {
	if (tx.kind === "transfer") {
		return tr.txHistory.transferSub;
	}
	const category = categoryLabel(tx);
	return category === null ? sourceName(tx) : `${category} · ${sourceName(tx)}`;
}

// Design 36: one month, searched and filtered on the device; planned items come with F4-10 (ADR-053).
export function TransactionHistoryScreen() {
	const { colors, typography, fonts, spacing, radius } = useAppTheme();
	const today = useToday();
	const [month, setMonth] = useState<IsoDate>(monthOf(today));
	const [filter, setFilter] = useState<CashFilter>("all");
	const [query, setQuery] = useState("");
	const list = useTransactions(month, null);
	const title = monthTitle(month);
	const yearTitle = `${title} ${month.slice(0, 4)}`;

	const items = list.data === undefined ? [] : filterTransactions(list.data.items, filter, query);
	const groups = groupByDay(items);

	return (
		<Screen
			testID="txHistory.screen"
			edges={["bottom"]}
			refreshControl={
				<RefreshControl
					refreshing={list.isRefetching}
					onRefresh={() => {
						void list.refetch();
					}}
				/>
			}
		>
			<View style={[styles.month, { gap: spacing.sm }]}>
				<IconButton
					icon="chevron-back"
					label={tr.txHistory.prev}
					onPress={() => {
						setMonth(shiftMonth(month, -1));
					}}
					testID="txHistory.prev.button"
				/>
				<Text
					testID="txHistory.month.text"
					accessibilityRole="header"
					style={[typography.headline, styles.monthText, { color: colors.text }]}
				>
					{yearTitle}
				</Text>
				<IconButton
					icon="chevron-forward"
					label={tr.txHistory.next}
					onPress={() => {
						setMonth(shiftMonth(month, 1));
					}}
					testID="txHistory.next.button"
				/>
			</View>

			<View
				style={[
					styles.search,
					{
						borderRadius: radius.sm,
						borderColor: colors.borderStrong,
						backgroundColor: colors.surface,
						gap: 10,
					},
				]}
			>
				<Ionicons name="search" size={18} color={colors.textMuted} />
				<TextInput
					testID="txHistory.search.input"
					accessibilityLabel={tr.txHistory.search}
					placeholder={tr.txHistory.search}
					placeholderTextColor={colors.textMuted}
					value={query}
					onChangeText={setQuery}
					style={[
						styles.grow,
						{ fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
					]}
				/>
			</View>

			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				accessibilityRole="tablist"
				contentContainerStyle={{ gap: spacing.sm }}
			>
				{FILTERS.map((option) => (
					<Chip
						key={option}
						label={tr.txHistory.filters[option]}
						selected={option === filter}
						onPress={() => {
							setFilter(option);
						}}
						testID={`txHistory.filter.${option}`}
					/>
				))}
			</ScrollView>

			{list.isPending ? (
				<LoadingState rows={4} testID="txHistory.loading" />
			) : list.isError ? (
				<ErrorState
					message={messageForError(list.error)}
					onRetry={() => {
						void list.refetch();
					}}
					testID="txHistory.error"
				/>
			) : (
				<>
					<View
						style={[
							styles.sum,
							{
								backgroundColor: colors.surface,
								borderColor: colors.border,
								borderRadius: radius.lg,
							},
						]}
					>
						<View style={styles.sumCell}>
							<Text
								style={[
									typography.caption,
									{ fontSize: 12, color: colors.textMuted },
								]}
							>
								{fill(tr.accounts.monthIncome, { month: title })}
							</Text>
							<Text
								testID="txHistory.income.amount"
								style={{
									fontFamily: fonts.extrabold,
									fontSize: 16,
									color: colors.receivable,
								}}
							>
								{formatSignedTRY(list.data.income_minor, "plus")}
							</Text>
						</View>
						<View
							style={[
								styles.sumCell,
								{ borderLeftWidth: 1, borderLeftColor: colors.divider },
							]}
						>
							<Text
								style={[
									typography.caption,
									{ fontSize: 12, color: colors.textMuted },
								]}
							>
								{fill(tr.accounts.monthExpense, { month: title })}
							</Text>
							<Text
								testID="txHistory.expense.amount"
								style={{
									fontFamily: fonts.extrabold,
									fontSize: 16,
									color: colors.text,
								}}
							>
								{formatSignedTRY(list.data.expense_minor, "minus")}
							</Text>
						</View>
					</View>

					{groups.length === 0 ? (
						<View
							testID="txHistory.empty"
							style={[
								styles.empty,
								{ borderColor: colors.borderStrong, borderRadius: 18 },
							]}
						>
							<Text
								style={[
									typography.callout,
									styles.centerText,
									{ color: colors.textMuted },
								]}
							>
								{fill(tr.txHistory.empty, { month: title })}
							</Text>
						</View>
					) : (
						groups.map((group) => (
							<View
								key={group.date}
								testID={`txHistory.group.${group.date}`}
								style={{ gap: spacing.sm }}
							>
								<View style={styles.groupHead}>
									<Text
										style={{
											fontFamily: fonts.extrabold,
											fontSize: 13,
											color: colors.textMuted,
										}}
									>
										{dayLabel(group.date)}
									</Text>
									<Text
										style={{
											fontFamily: fonts.extrabold,
											fontSize: 13,
											color: colors.textMuted,
										}}
									>
										{fill(tr.txHistory.count, {
											count: String(group.items.length),
										})}
									</Text>
								</View>
								<View
									style={{
										backgroundColor: colors.surface,
										borderColor: colors.border,
										borderWidth: 1,
										borderRadius: radius.lg,
									}}
								>
									{group.items.map((tx, index) => (
										<View key={tx.id}>
											{index > 0 ? (
												<View
													style={[
														styles.divider,
														{ backgroundColor: colors.divider },
													]}
												/>
											) : null}
											<TransactionRow
												tx={tx}
												sub={subOf(tx)}
												onPress={() => {
													router.push({
														pathname: "/transaction/[id]",
														params: { id: tx.id },
													});
												}}
												testID={`txHistory.item.${tx.id}`}
											/>
										</View>
									))}
								</View>
							</View>
						))
					)}
				</>
			)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	grow: { flex: 1, minWidth: 0 },
	month: { flexDirection: "row", alignItems: "center" },
	monthText: { flex: 1, textAlign: "center" },
	search: {
		flexDirection: "row",
		alignItems: "center",
		height: 48,
		borderWidth: 1,
		paddingHorizontal: 14,
	},
	sum: { flexDirection: "row", borderWidth: 1 },
	sumCell: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
	empty: { borderWidth: 1.5, borderStyle: "dashed", paddingVertical: 28, paddingHorizontal: 20 },
	centerText: { textAlign: "center" },
	groupHead: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 },
	divider: { height: 1 },
});
