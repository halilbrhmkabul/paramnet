import { formatSignedTRY, formatTRY, monthOf, shiftMonth, type IsoDate } from "@paramnet/shared";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useDashboard, useMonthlyReport } from "@/api/hooks";
import type { MonthlyReport } from "@/api/types";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { IconButton } from "@/components/TopBar";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { useAppTheme } from "@/theme/useAppTheme";

import { categoryLabel, monthTitle } from "./cashModel";
import { barWidth, percentOf } from "./planModel";

const SHORT = [
	"Oca",
	"Şub",
	"Mar",
	"Nis",
	"May",
	"Haz",
	"Tem",
	"Ağu",
	"Eyl",
	"Eki",
	"Kas",
	"Ara",
] as const;

function Kpi({ data }: { data: MonthlyReport }) {
	const { colors, typography, fonts, radius } = useAppTheme();
	const net = data.income_minor - data.expense_minor;
	const cell = (label: string, value: string, tone: string, testID: string, first = false) => (
		<View
			style={[
				styles.kpiCell,
				first ? null : { borderLeftWidth: 1, borderLeftColor: colors.divider },
			]}
		>
			<Text style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}>
				{label}
			</Text>
			<Text
				testID={testID}
				style={{ fontFamily: fonts.extrabold, fontSize: 16, color: tone }}
			>
				{value}
			</Text>
		</View>
	);
	return (
		<View
			style={[
				styles.kpi,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderRadius: radius.lg,
				},
			]}
		>
			{cell(
				tr.report.income,
				formatTRY(data.income_minor),
				colors.receivable,
				"report.income.amount",
				true,
			)}
			{cell(
				tr.report.expense,
				formatTRY(data.expense_minor),
				colors.text,
				"report.expense.amount",
			)}
			{cell(
				tr.report.net,
				formatSignedTRY(net, net < 0 ? "minus" : net > 0 ? "plus" : "none"),
				net < 0 ? colors.overdue : colors.receivable,
				"report.net.amount",
			)}
		</View>
	);
}

function Trend({ data }: { data: MonthlyReport }) {
	const { colors, fonts, radius } = useAppTheme();
	const top = Math.max(1, ...data.series.flatMap((m) => [m.income_minor, m.expense_minor]));
	const height = (minor: number) => barWidth(Math.max(2, Math.round((minor / top) * 100)));
	return (
		<View
			style={{
				backgroundColor: colors.surface,
				borderColor: colors.border,
				borderWidth: 1,
				borderRadius: radius.lg,
				padding: 16,
				gap: 14,
			}}
		>
			<View style={[styles.legend, { gap: 14 }]}>
				<View style={styles.legendItem}>
					<View style={[styles.swatch, { backgroundColor: colors.accent }]} />
					<Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted }}>
						{tr.report.income}
					</Text>
				</View>
				<View style={styles.legendItem}>
					<View style={[styles.swatch, { backgroundColor: colors.warning }]} />
					<Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted }}>
						{tr.report.expense}
					</Text>
				</View>
			</View>
			<View testID="report.trend" style={[styles.cols, { gap: 8 }]}>
				{data.series.map((m) => {
					const name = SHORT[Number(m.month.slice(5, 7)) - 1] ?? "";
					const current = m.month === data.month;
					return (
						<View
							key={m.month}
							accessible
							accessibilityLabel={fill(tr.report.trendLabel, {
								month: monthTitle(m.month),
								income: formatTRY(m.income_minor),
								expense: formatTRY(m.expense_minor),
							})}
							style={styles.col}
						>
							<View style={styles.pair}>
								<View
									style={[
										styles.bar,
										{
											height: height(m.income_minor),
											backgroundColor: colors.accent,
										},
									]}
								/>
								<View
									style={[
										styles.bar,
										{
											height: height(m.expense_minor),
											backgroundColor: colors.warning,
										},
									]}
								/>
							</View>
							<Text
								style={{
									fontFamily: current ? fonts.extrabold : fonts.bold,
									fontSize: 11,
									color: current ? colors.text : colors.textMuted,
								}}
							>
								{name}
							</Text>
						</View>
					);
				})}
			</View>
		</View>
	);
}

function Breakdown({ data }: { data: MonthlyReport }) {
	const { colors, typography, fonts, radius } = useAppTheme();
	if (data.by_category.length === 0) {
		return (
			<Text
				testID="report.breakdown.empty"
				style={[typography.body, { color: colors.textMuted }]}
			>
				{tr.report.breakdownEmpty}
			</Text>
		);
	}
	return (
		<View
			style={{
				backgroundColor: colors.surface,
				borderColor: colors.border,
				borderWidth: 1,
				borderRadius: radius.lg,
				paddingHorizontal: 16,
				paddingVertical: 6,
			}}
		>
			{data.by_category.map((row, index) => {
				const percent = percentOf(row.amount_minor, data.expense_minor);
				return (
					<View
						key={row.category}
						testID={`report.category.${row.category}`}
						style={[
							styles.cat,
							index > 0
								? { borderTopWidth: 1, borderTopColor: colors.divider }
								: null,
						]}
					>
						<View style={styles.catHead}>
							<Text
								style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.text }}
							>
								{categoryLabel({ kind: "expense", category: row.category }) ??
									row.category}
							</Text>
							<Text
								style={{
									fontFamily: fonts.extrabold,
									fontSize: 14,
									color: colors.text,
								}}
							>
								{`${formatTRY(row.amount_minor)} · %${String(percent)}`}
							</Text>
						</View>
						<View style={[styles.track, { backgroundColor: colors.track }]}>
							<View
								style={{
									width: barWidth(percent),
									height: "100%",
									borderRadius: 4,
									backgroundColor: colors.accent,
								}}
							/>
						</View>
					</View>
				);
			})}
		</View>
	);
}

// Debts from the agreements; cards and bank loans join when their modules exist (F4-05, F4-06).
function Balance() {
	const { colors, typography, fonts, radius } = useAppTheme();
	const dashboard = useDashboard();
	if (dashboard.data === undefined) {
		return null;
	}
	const rows = [
		{
			label: tr.report.payable,
			value: formatTRY(dashboard.data.payable_minor),
			tone: colors.text,
			id: "payable",
		},
		{
			label: tr.report.receivable,
			value: formatTRY(dashboard.data.receivable_minor),
			tone: colors.receivable,
			id: "receivable",
		},
		{
			label: tr.report.dueThisMonth,
			value: formatTRY(dashboard.data.due_this_month_minor),
			tone: colors.text,
			id: "due",
		},
	];
	return (
		<View
			style={{
				backgroundColor: colors.surface,
				borderColor: colors.border,
				borderWidth: 1,
				borderRadius: radius.lg,
			}}
		>
			{rows.map((row, index) => (
				<View
					key={row.id}
					style={[
						styles.kv,
						index > 0 ? { borderTopWidth: 1, borderTopColor: colors.divider } : null,
					]}
				>
					<Text style={[typography.callout, { color: colors.textMuted }]}>
						{row.label}
					</Text>
					<Text
						testID={`report.balance.${row.id}`}
						style={{ fontFamily: fonts.extrabold, fontSize: 14, color: row.tone }}
					>
						{row.value}
					</Text>
				</View>
			))}
		</View>
	);
}

// Design 27: opens on the last finished month; the current one reads "bugüne kadar".
export function ReportScreen() {
	const { colors, typography, spacing } = useAppTheme();
	const current = monthOf(useToday());
	const [month, setMonth] = useState<IsoDate>(shiftMonth(current, -1));
	const report = useMonthlyReport(month);
	const name = monthTitle(month);
	return (
		<Screen testID="report.screen" edges={["bottom"]}>
			<View style={[styles.month, { gap: spacing.sm }]}>
				<IconButton
					icon="chevron-back"
					label={tr.report.prev}
					onPress={() => {
						setMonth(shiftMonth(month, -1));
					}}
					testID="report.prev.button"
				/>
				<View style={styles.grow}>
					<Text
						testID="report.month.text"
						accessibilityRole="header"
						style={[typography.headline, styles.center, { color: colors.text }]}
					>
						{`${name} ${month.slice(0, 4)}`}
					</Text>
					<Text
						style={[
							typography.caption,
							styles.center,
							{ fontSize: 12, color: colors.textMuted },
						]}
					>
						{month === current ? tr.report.thisMonth : tr.report.lastComplete}
					</Text>
				</View>
				<IconButton
					icon="chevron-forward"
					label={tr.report.next}
					onPress={() => {
						if (month < current) {
							setMonth(shiftMonth(month, 1));
						}
					}}
					testID="report.next.button"
				/>
			</View>
			{report.isPending ? (
				<LoadingState rows={4} testID="report.loading" />
			) : report.isError ? (
				<ErrorState
					message={messageForError(report.error)}
					onRetry={() => {
						void report.refetch();
					}}
					testID="report.error"
				/>
			) : (
				<>
					<View style={{ gap: spacing.sm }}>
						<Kpi data={report.data} />
						<Text
							style={[
								typography.caption,
								{ fontSize: 12, color: colors.textMuted, paddingHorizontal: 4 },
							]}
						>
							{tr.report.note}
						</Text>
					</View>
					<View style={{ gap: spacing.sm }}>
						<SectionHeader>{tr.report.trend}</SectionHeader>
						<Trend data={report.data} />
					</View>
					<View style={{ gap: spacing.sm }}>
						<SectionHeader>{fill(tr.report.breakdown, { month: name })}</SectionHeader>
						<Breakdown data={report.data} />
					</View>
					<View style={{ gap: spacing.sm }}>
						<SectionHeader>{tr.report.balance}</SectionHeader>
						<Balance />
					</View>
				</>
			)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	grow: { flex: 1 },
	center: { textAlign: "center" },
	month: { flexDirection: "row", alignItems: "center" },
	kpi: { flexDirection: "row", borderWidth: 1 },
	kpiCell: { flex: 1, paddingHorizontal: 12, paddingVertical: 14, gap: 3 },
	legend: { flexDirection: "row" },
	legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
	swatch: { width: 10, height: 10, borderRadius: 3 },
	cols: { flexDirection: "row", height: 150, alignItems: "flex-end" },
	col: { flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 6 },
	pair: {
		flex: 1,
		width: "100%",
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "center",
		gap: 3,
	},
	bar: { width: 14, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
	cat: { paddingVertical: 10, gap: 6 },
	catHead: { flexDirection: "row", justifyContent: "space-between" },
	track: { height: 8, borderRadius: 4, overflow: "hidden" },
	kv: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		minHeight: 48,
	},
});
