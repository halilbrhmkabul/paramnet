import { addDays, formatDateTR, formatTRY, monthName } from "@paramnet/shared";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useCard } from "@/api/hooks";
import type { CardDetail, Transaction } from "@/api/types";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Badge } from "@/components/StatusBadge";
import { IconButton } from "@/components/TopBar";
import { categoryLabel, dayLabel, titleOf } from "@/features/cash/cashModel";
import { TransactionRow } from "@/features/cash/parts";
import { dayWithSuffix } from "@/features/cash/planModel";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

import { MiniCard } from "./cardParts";

type Tab = "statement" | "installments" | "history";

function KV({
	label,
	value,
	tone,
	testID,
}: {
	label: string;
	value: string;
	tone?: string;
	testID?: string;
}) {
	const { colors, typography, fonts } = useAppTheme();
	return (
		<View style={styles.kv}>
			<Text style={[typography.callout, { color: colors.textMuted }]}>{label}</Text>
			<Text
				testID={testID}
				style={{ fontFamily: fonts.bold, fontSize: 14, color: tone ?? colors.text }}
			>
				{value}
			</Text>
		</View>
	);
}

function Panel({ children }: { children: React.ReactNode }) {
	const { colors, radius } = useAppTheme();
	return (
		<View
			style={{
				backgroundColor: colors.surface,
				borderColor: colors.border,
				borderWidth: 1,
				borderRadius: radius.lg,
			}}
		>
			{children}
		</View>
	);
}

function Rows({ items, prefix }: { items: Transaction[]; prefix: string }) {
	const { colors } = useAppTheme();
	return (
		<Panel>
			{items.map((tx, index) => (
				<View key={tx.id}>
					{index > 0 ? (
						<View style={[styles.divider, { backgroundColor: colors.divider }]} />
					) : null}
					<TransactionRow
						tx={tx}
						sub={`${dayLabel(tx.occurred_on)}${categoryLabel(tx) === null ? "" : ` · ${categoryLabel(tx) ?? ""}`}`}
						onPress={() => {
							router.push({ pathname: "/transaction/[id]", params: { id: tx.id } });
						}}
						testID={`${prefix}.${String(index)}`}
					/>
				</View>
			))}
		</Panel>
	);
}

function Statement({ data }: { data: CardDetail }) {
	const { colors, typography, fonts, spacing, radius } = useAppTheme();
	const { card } = data;
	const s = card.state;
	const status =
		s.statement_minor === 0
			? "none"
			: s.statement_remaining_minor === 0
				? "paid"
				: s.paid_since_minor > 0
					? "partial"
					: "unpaid";
	const paidPercent =
		s.statement_minor === 0
			? 0
			: Math.min(100, Math.round((s.paid_since_minor / s.statement_minor) * 100));
	return (
		<View style={{ gap: spacing.lg }}>
			<View
				testID="cardDetail.statement"
				style={{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderWidth: 1,
					borderRadius: radius.lg,
					paddingHorizontal: 16,
					paddingTop: 18,
					paddingBottom: 16,
					gap: 6,
				}}
			>
				<View style={styles.between}>
					<Text style={[typography.label, styles.grow, { color: colors.textMuted }]}>
						{fill(tr.cardDetail.statementTitle, {
							month: monthName(Number(s.last_cut.slice(5, 7))),
							from: formatDateTR(previousCutNext(s.last_cut), "dayMonth"),
							to: formatDateTR(s.last_cut, "dayMonth"),
						})}
					</Text>
					<Badge
						label={tr.cardDetail.status[status]}
						tone={
							status === "paid"
								? "success"
								: status === "partial"
									? "warning"
									: s.overdue
										? "overdue"
										: "neutral"
						}
						testID="cardDetail.status"
					/>
				</View>
				<Text
					testID="cardDetail.statement.amount"
					style={[typography.amountL, { color: colors.primary }]}
				>
					{formatTRY(s.statement_minor)}
				</Text>
				<View
					accessible
					accessibilityRole="progressbar"
					accessibilityLabel={fill(tr.cardDetail.progress, {
						paid: String(paidPercent),
						min: String(card.min_payment_rate),
					})}
					style={[styles.track, { backgroundColor: colors.track }]}
				>
					<View
						style={{
							width: `${String(paidPercent)}%` as `${number}%`,
							height: "100%",
							borderRadius: 4,
							backgroundColor: colors.accent,
						}}
					/>
					<View
						style={[
							styles.minMark,
							{
								left: `${String(card.min_payment_rate)}%` as `${number}%`,
								backgroundColor: colors.warning,
							},
						]}
					/>
				</View>
				<View style={styles.between}>
					<Text style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}>
						{fill(tr.cardDetail.paidSoFar, { amount: formatTRY(s.paid_since_minor) })}
					</Text>
					<Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.warning }}>
						{fill(tr.cardDetail.minLine, { amount: formatTRY(s.minimum_minor) })}
					</Text>
				</View>
				<View
					style={{
						marginHorizontal: -16,
						marginTop: 8,
						borderTopWidth: 1,
						borderTopColor: colors.divider,
					}}
				>
					<KV
						label={tr.cardDetail.minimum}
						value={formatTRY(s.minimum_remaining_minor)}
						testID="cardDetail.minimum"
					/>
					<KV
						label={tr.cardDetail.remaining}
						value={formatTRY(s.statement_remaining_minor)}
						testID="cardDetail.remaining"
					/>
					<KV
						label={tr.cardDetail.dueDate}
						value={dayLabel(s.due_date)}
						tone={s.overdue ? colors.overdue : undefined}
						testID="cardDetail.due"
					/>
				</View>
				<Button
					label={tr.cardDetail.simulate}
					variant="secondary"
					disabled={s.statement_minor === 0}
					onPress={() => {
						router.push({ pathname: "/interest", params: { card: card.id } });
					}}
					testID="cardDetail.simulate.button"
				/>
				<Button
					label={tr.cardDetail.pay}
					disabled={s.statement_remaining_minor === 0 && s.period_spent_minor === 0}
					onPress={() => {
						router.push({ pathname: "/cards/[id]/pay", params: { id: card.id } });
					}}
					testID="cardDetail.pay.button"
				/>
			</View>
			<View style={{ gap: spacing.sm }}>
				<SectionHeader>{tr.cardDetail.period}</SectionHeader>
				{data.period_items.length === 0 ? (
					<Text style={[typography.body, { color: colors.textMuted }]}>
						{tr.cardDetail.periodEmpty}
					</Text>
				) : (
					<Rows items={data.period_items} prefix="cardDetail.period" />
				)}
				<Text
					style={[
						typography.caption,
						{ fontSize: 12, color: colors.textMuted, paddingHorizontal: 4 },
					]}
				>
					{tr.cardDetail.onceNote}
				</Text>
			</View>
			<View style={{ gap: spacing.sm }}>
				<SectionHeader>{tr.cardDetail.info}</SectionHeader>
				<Panel>
					<KV label={tr.cardDetail.limit} value={formatTRY(card.limit_minor)} />
					<KV
						label={tr.cardDetail.available}
						value={formatTRY(s.available_minor)}
						tone={colors.receivable}
						testID="cardDetail.available"
					/>
					<KV
						label={tr.cardDetail.cutDay}
						value={fill(tr.cardDetail.cutDayValue, {
							day: dayWithSuffix(card.statement_day),
						})}
					/>
					<KV
						label={tr.cardDetail.dueRule}
						value={fill(tr.cardDetail.dueRuleValue, {
							count: String(card.due_offset_days),
						})}
					/>
					<KV label={tr.cardDetail.minRate} value={`%${String(card.min_payment_rate)}`} />
					<KV label={tr.cardDetail.number} value={`•••• ${card.last4}`} />
				</Panel>
			</View>
		</View>
	);
}

// The day after the previous cut: where this statement's period starts.
function previousCutNext(lastCut: string): string {
	const [y, m, d] = lastCut.split("-").map(Number) as [number, number, number];
	const year = m === 1 ? y - 1 : y;
	const month = m === 1 ? 12 : m - 1;
	return addDays(
		`${String(year)}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
		1,
	);
}

function Installments({ data }: { data: CardDetail }) {
	const { colors, typography, fonts, spacing } = useAppTheme();
	const progress = new Map(data.card.state.installments.map((i) => [i.id, i]));
	const open = data.installment_items.filter((tx) => progress.has(tx.id));
	if (open.length === 0) {
		return (
			<Text
				testID="cardDetail.installments.empty"
				style={[typography.body, { color: colors.textMuted }]}
			>
				{tr.cardDetail.noInstallments}
			</Text>
		);
	}
	return (
		<Panel>
			{open.map((tx, index) => {
				const p = progress.get(tx.id);
				const billed = p?.billed ?? 0;
				const count = p?.count ?? tx.installments;
				return (
					<View
						key={tx.id}
						testID={`cardDetail.installment.${String(index)}`}
						style={[
							styles.inst,
							index > 0
								? { borderTopWidth: 1, borderTopColor: colors.divider }
								: null,
							{ gap: spacing.md },
						]}
					>
						<View style={styles.grow}>
							<Text style={[typography.rowTitle, { color: colors.text }]}>
								{titleOf(tx)}
							</Text>
							<Text style={[typography.caption, { color: colors.textMuted }]}>
								{fill(tr.cardDetail.installmentLine, {
									billed: String(billed),
									count: String(count),
								})}
							</Text>
							<View
								style={[
									styles.track,
									{ marginTop: 8, height: 5, backgroundColor: colors.track },
								]}
							>
								<View
									style={{
										width: `${String(Math.round((billed / count) * 100))}%` as `${number}%`,
										height: "100%",
										borderRadius: 3,
										backgroundColor: colors.pending,
									}}
								/>
							</View>
						</View>
						<View style={styles.end}>
							<Text
								style={{
									fontFamily: fonts.extrabold,
									fontSize: 15,
									color: colors.text,
								}}
							>
								{formatTRY(p?.part_minor ?? 0)}
							</Text>
							<Text
								style={[
									typography.caption,
									{ fontSize: 12, color: colors.textMuted },
								]}
							>
								{tr.cardDetail.perMonth}
							</Text>
						</View>
					</View>
				);
			})}
		</Panel>
	);
}

function History({ data }: { data: CardDetail }) {
	const { colors, typography, fonts, spacing } = useAppTheme();
	const { history } = data.card.state;
	return (
		<View style={{ gap: spacing.lg }}>
			<View style={{ gap: spacing.sm }}>
				<SectionHeader>{tr.cardDetail.history}</SectionHeader>
				{history.length === 0 ? (
					<Text
						testID="cardDetail.history.empty"
						style={[typography.body, { color: colors.textMuted }]}
					>
						{tr.cardDetail.historyEmpty}
					</Text>
				) : (
					<Panel>
						{history.map((h, index) => (
							<View
								key={h.cut}
								testID={`cardDetail.history.${String(index)}`}
								style={[
									styles.inst,
									index > 0
										? { borderTopWidth: 1, borderTopColor: colors.divider }
										: null,
								]}
							>
								<View style={styles.grow}>
									<Text style={[typography.rowTitle, { color: colors.text }]}>
										{fill(tr.cardDetail.historyTitle, {
											month: monthName(Number(h.cut.slice(5, 7))),
										})}
									</Text>
									<Text style={[typography.caption, { color: colors.textMuted }]}>
										{fill(tr.cardDetail.historyLine, {
											date: formatDateTR(h.cut, "dayMonth"),
										})}
									</Text>
								</View>
								<View style={styles.end}>
									<Text
										style={{
											fontFamily: fonts.extrabold,
											fontSize: 15,
											color: colors.text,
										}}
									>
										{formatTRY(h.amount_minor)}
									</Text>
									<Badge
										label={tr.cardDetail.status[h.status]}
										tone={
											h.status === "paid"
												? "success"
												: h.status === "partial"
													? "warning"
													: "neutral"
										}
									/>
								</View>
							</View>
						))}
					</Panel>
				)}
			</View>
			<View style={{ gap: spacing.sm }}>
				<SectionHeader>{tr.cardDetail.payments}</SectionHeader>
				{data.payments.length === 0 ? (
					<Text style={[typography.body, { color: colors.textMuted }]}>
						{tr.cardDetail.paymentsEmpty}
					</Text>
				) : (
					<Rows items={data.payments} prefix="cardDetail.payment" />
				)}
			</View>
		</View>
	);
}

// Design 08: one card's statement, instalments and history.
export function CardDetailScreen({ id }: { id: string }) {
	const { colors, typography, spacing } = useAppTheme();
	const detail = useCard(id);
	const [tab, setTab] = useState<Tab>("statement");
	if (detail.isPending) {
		return (
			<Screen testID="cardDetail.screen" edges={["bottom"]}>
				<LoadingState rows={4} testID="cardDetail.loading" />
			</Screen>
		);
	}
	if (detail.isError) {
		return (
			<Screen testID="cardDetail.screen" edges={["bottom"]}>
				<ErrorState
					message={messageForError(detail.error)}
					onRetry={() => {
						void detail.refetch();
					}}
					testID="cardDetail.error"
				/>
			</Screen>
		);
	}
	const { card } = detail.data;
	const s = card.state;
	return (
		<Screen testID="cardDetail.screen" edges={["bottom"]}>
			{/* Design 08: the card's name and the edit button live in the top bar. */}
			<Stack.Screen
				options={{
					title: [card.bank_name, card.card_name]
						.filter((p) => p !== null && p !== "")
						.join(" "),
					headerRight: () => (
						<IconButton
							icon="create-outline"
							label={tr.cardDetail.edit}
							onPress={() => {
								router.push({
									pathname: "/cards/[id]/edit",
									params: { id: card.id },
								});
							}}
							testID="cardDetail.edit.button"
						/>
					),
				}}
			/>
			<View style={[styles.head, { gap: 14 }]}>
				<MiniCard color={card.color} bank={card.bank_name} last4={card.last4} />
				<View style={styles.grow}>
					<Text style={[typography.label, { color: colors.textMuted }]}>
						{tr.cardDetail.totalDebt}
					</Text>
					<Text
						testID="cardDetail.totalDebt"
						numberOfLines={1}
						adjustsFontSizeToFit
						minimumFontScale={0.6}
						style={[typography.amountL, { color: colors.text }]}
					>
						{formatTRY(s.total_debt_minor)}
					</Text>
					<Text style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}>
						{fill(tr.cardDetail.debtLine, {
							statement: formatTRY(s.statement_remaining_minor),
							period: formatTRY(s.period_spent_minor),
						})}
					</Text>
				</View>
			</View>
			<SegmentedControl
				label={tr.cardDetail.tabs.statement}
				hideLabel
				options={(["statement", "installments", "history"] as const).map((value) => ({
					value,
					label: tr.cardDetail.tabs[value],
				}))}
				value={tab}
				onChange={setTab}
				testID="cardDetail.tab"
			/>
			<View style={{ gap: spacing.lg }}>
				{tab === "statement" ? <Statement data={detail.data} /> : null}
				{tab === "installments" ? <Installments data={detail.data} /> : null}
				{tab === "history" ? <History data={detail.data} /> : null}
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	grow: { flex: 1, minWidth: 0 },
	head: { flexDirection: "row", alignItems: "center" },
	between: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		gap: 8,
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
	track: { height: 8, borderRadius: 4, overflow: "visible", flexDirection: "row" },
	minMark: { position: "absolute", top: -4, width: 2, height: 16, borderRadius: 1 },
	divider: { height: 1 },
	inst: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		minHeight: 62,
	},
	end: { alignItems: "flex-end", gap: 3 },
});
