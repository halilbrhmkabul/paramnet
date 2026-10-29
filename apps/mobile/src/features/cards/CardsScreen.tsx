import { Ionicons } from "@expo/vector-icons";
import { formatDateTR, formatTRY } from "@paramnet/shared";
import { router } from "expo-router";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useCards } from "@/api/hooks";
import type { Card } from "@/api/types";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { ProgressBar } from "@/components/ProgressBar";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { Badge } from "@/components/StatusBadge";
import { IconButton } from "@/components/TopBar";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { useAppTheme } from "@/theme/useAppTheme";

import { CardFace } from "./cardParts";
import { cutLabel, dueBadge, usedPercent } from "./cardModel";

function CardTile({ card, index }: { card: Card; index: number }) {
	const { colors, typography, fonts, radius } = useAppTheme();
	const today = useToday();
	const badge = dueBadge(card, today);
	const used = usedPercent(card);
	const cell = (label: string, value: string, extra?: React.ReactNode) => (
		<View style={styles.cell}>
			<Text style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}>
				{label}
			</Text>
			<View style={styles.valueRow}>
				<Text style={{ fontFamily: fonts.extrabold, fontSize: 16, color: colors.text }}>
					{value}
				</Text>
				{extra}
			</View>
		</View>
	);
	return (
		<Pressable
			testID={`cards.item.${String(index)}`}
			accessibilityRole="button"
			accessibilityLabel={fill(tr.cards.open, {
				label: card.label,
				amount: formatTRY(card.state.statement_remaining_minor),
				date: formatDateTR(card.state.due_date, "dayMonth"),
			})}
			onPress={() => {
				router.push({ pathname: "/cards/[id]", params: { id: card.id } });
			}}
		>
			<View style={styles.onTop}>
				<CardFace
					bank={card.bank_name}
					name={card.card_name}
					last4={card.last4}
					color={card.color}
					footer={cutLabel(card)}
				/>
			</View>
			<View
				style={[
					styles.info,
					{
						backgroundColor: colors.surface,
						borderColor: colors.border,
						borderRadius: radius.lg,
					},
				]}
			>
				<View style={styles.grid}>
					{cell(tr.cards.statementDebt, formatTRY(card.state.statement_remaining_minor))}
					{cell(tr.cards.minimum, formatTRY(card.state.minimum_remaining_minor))}
				</View>
				<View style={styles.grid}>
					{cell(
						tr.cards.due,
						formatDateTR(card.state.due_date, "dayMonth"),
						<Badge
							label={badge.label}
							tone={badge.tone}
							testID={`cards.item.${String(index)}.due`}
						/>,
					)}
					<View style={styles.cell}>
						<Text
							style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}
						>
							{tr.cards.availableLimit}
						</Text>
						<Text
							testID={`cards.item.${String(index)}.available`}
							style={{
								fontFamily: fonts.extrabold,
								fontSize: 16,
								color: colors.text,
							}}
						>
							{formatTRY(card.state.available_minor)}
						</Text>
						<View style={{ marginTop: 6 }}>
							<ProgressBar
								value={used / 100}
								label={fill(tr.cards.used, { percent: String(used) })}
							/>
						</View>
					</View>
				</View>
			</View>
		</Pressable>
	);
}

// Design 07: the cards, what is owed and what is left. Limits never join Toplam Nakit (ADR-055).
export function CardsScreen() {
	const { colors, typography, fonts, radius, spacing } = useAppTheme();
	const cards = useCards();
	const header = (
		<View style={[styles.header, { gap: spacing.sm }]}>
			<View style={styles.grow}>
				<ScreenTitle>{tr.cards.title}</ScreenTitle>
			</View>
			<IconButton
				icon="add"
				label={tr.cards.add}
				onPress={() => {
					router.push("/cards/new");
				}}
				testID="cards.add.button"
			/>
		</View>
	);
	if (cards.isPending) {
		return (
			<Screen testID="cards.screen">
				{header}
				<LoadingState rows={3} testID="cards.loading" />
			</Screen>
		);
	}
	if (cards.isError) {
		return (
			<Screen testID="cards.screen">
				{header}
				<ErrorState
					message={messageForError(cards.error)}
					onRetry={() => {
						void cards.refetch();
					}}
					testID="cards.error"
				/>
			</Screen>
		);
	}
	if (cards.data.cards.length === 0) {
		return (
			<Screen testID="cards.screen">
				{header}
				<EmptyState
					title={tr.cards.emptyTitle}
					body={tr.cards.emptyBody}
					actionLabel={tr.cards.add}
					onAction={() => {
						router.push("/cards/new");
					}}
					actionTestID="cards.empty.action"
					testID="cards.empty"
				/>
			</Screen>
		);
	}
	const total = (label: string, value: string, tone: string, testID: string) => (
		<View style={styles.grow}>
			<Text style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}>
				{label}
			</Text>
			{/* Three amounts share one row; a long one shrinks instead of wrapping (F4-12). */}
			<Text
				testID={testID}
				numberOfLines={1}
				adjustsFontSizeToFit
				minimumFontScale={0.7}
				style={{ fontFamily: fonts.extrabold, fontSize: 16, color: tone }}
			>
				{value}
			</Text>
		</View>
	);
	return (
		<Screen
			testID="cards.screen"
			refreshControl={
				<RefreshControl
					refreshing={cards.isRefetching}
					onRefresh={() => {
						void cards.refetch();
					}}
				/>
			}
		>
			{header}
			<View style={{ gap: spacing.sm }}>
				<View
					style={[
						styles.totals,
						{
							backgroundColor: colors.surface,
							borderColor: colors.border,
							borderRadius: radius.lg,
						},
					]}
				>
					{total(
						tr.cards.totalDebt,
						formatTRY(cards.data.total_debt_minor),
						colors.text,
						"cards.totalDebt",
					)}
					{total(
						tr.cards.available,
						formatTRY(cards.data.available_minor),
						colors.receivable,
						"cards.available",
					)}
					{total(
						tr.cards.totalLimit,
						formatTRY(cards.data.limit_minor),
						colors.text,
						"cards.limit",
					)}
				</View>
				<View style={[styles.note, { gap: 6 }]}>
					<Ionicons
						name="information-circle-outline"
						size={14}
						color={colors.textMuted}
					/>
					<Text
						style={[
							typography.caption,
							styles.grow,
							{ fontSize: 12, color: colors.textMuted },
						]}
					>
						{tr.cards.note}
					</Text>
				</View>
			</View>
			{cards.data.cards.map((card, index) => (
				<CardTile key={card.id} card={card} index={index} />
			))}
			<Pressable
				testID="cards.addTile"
				accessibilityRole="button"
				accessibilityLabel={tr.cards.add}
				onPress={() => {
					router.push("/cards/new");
				}}
				style={[styles.addTile, { borderColor: colors.borderStrong, gap: spacing.sm }]}
			>
				<Ionicons name="add" size={20} color={colors.accent} />
				<Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.accent }}>
					{tr.cards.add}
				</Text>
			</Pressable>
		</Screen>
	);
}

const styles = StyleSheet.create({
	grow: { flex: 1, minWidth: 0 },
	// The face sits over the top edge of its info panel (design 07).
	onTop: { zIndex: 1 },
	header: { flexDirection: "row", alignItems: "center" },
	totals: { flexDirection: "row", borderWidth: 1, padding: 16, gap: 8 },
	note: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
	info: {
		marginTop: -18,
		marginHorizontal: 8,
		paddingTop: 26,
		paddingBottom: 4,
		borderWidth: 1,
		borderTopWidth: 0,
	},
	grid: { flexDirection: "row" },
	cell: { flex: 1, paddingHorizontal: 16, paddingVertical: 10 },
	valueRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
	addTile: {
		height: 64,
		borderRadius: 18,
		borderWidth: 1.5,
		borderStyle: "dashed",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
});
