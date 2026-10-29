import { Ionicons } from "@expo/vector-icons";
import {
	addDays,
	daysOfMonth,
	formatDateTR,
	formatTRY,
	isoWeekday,
	monthName,
	monthOf,
	shiftMonth,
	type IsoDate,
} from "@paramnet/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { SegmentedControl } from "@/components/SegmentedControl";
import { IconButton } from "@/components/TopBar";
import { upperTR } from "@/features/cash/cashModel";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import type { ColorToken } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

import { barPoints, eventsByDay, isDone, projection, type FinanceEvent } from "./financeModel";
import { eventColor, FinanceList, KIND_COLOR } from "./parts";
import { useFinanceEvents } from "./useFinanceEvents";

type Range = "month" | "week" | "days30" | "overdue";

const PROJECTION_DAYS = 30;
const BAR_AREA = 98;
const BAR_COUNT = 8;

function dayTitle(day: IsoDate, today: IsoDate): string {
	const title = fill(tr.calendar.dayTitle, {
		date: formatDateTR(day, "dayMonth"),
		weekday: tr.txHistory.weekdays[isoWeekday(day) - 1] ?? "",
	});
	return day === today ? fill(tr.calendar.todayTitle, { title }) : title;
}

function dayLabel(day: IsoDate, items: FinanceEvent[]): string {
	const date = formatDateTR(day, "dayMonth");
	if (items.length === 0) {
		return date;
	}
	const label = fill(tr.calendar.dayLabel, { date, count: String(items.length) });
	return items.some((item) => item.status === "overdue")
		? `${label}, ${tr.calendar.hasOverdue}`
		: label;
}

function MonthGrid({
	month,
	days,
	selected,
	today,
	onSelect,
}: {
	month: IsoDate;
	days: Partial<Record<IsoDate, FinanceEvent[]>>;
	selected: IsoDate;
	today: IsoDate;
	onSelect: (day: IsoDate) => void;
}) {
	const { colors, typography, fonts, radius } = useAppTheme();
	const leading = isoWeekday(month) - 1;
	return (
		<View
			style={[
				styles.monthCard,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderRadius: radius.lg,
				},
			]}
		>
			<View style={styles.week}>
				{tr.calendar.weekdays.map((weekday) => (
					<Text
						key={weekday}
						style={[
							typography.micro,
							styles.cell,
							styles.weekday,
							{ color: colors.textMuted, fontFamily: fonts.extrabold },
						]}
					>
						{upperTR(weekday)}
					</Text>
				))}
			</View>
			<View style={styles.grid}>
				{Array.from({ length: leading }, (_, i) => (
					<View
						key={`blank-${String(i)}`}
						testID={`calendar.blank.${String(i)}`}
						style={styles.cell}
					/>
				))}
				{daysOfMonth(month).map((day) => {
					const items = days[day] ?? [];
					const isSelected = day === selected;
					const dots = [...new Set(items.map(eventColor))].slice(0, 3);
					return (
						<View key={day} style={styles.cell}>
							<Pressable
								testID={`calendar.day.${day}`}
								accessibilityRole="button"
								accessibilityLabel={dayLabel(day, items)}
								accessibilityState={{ selected: isSelected }}
								onPress={() => {
									onSelect(day);
								}}
								style={[
									styles.day,
									{
										backgroundColor: isSelected
											? colors.primary
											: "transparent",
										borderWidth: day === today && !isSelected ? 1.5 : 0,
										borderColor: colors.accent,
									},
								]}
							>
								<Text
									style={{
										fontFamily: day < today ? fonts.semibold : fonts.bold,
										fontSize: 15,
										color: isSelected
											? colors.onPrimary
											: day < today
												? colors.textMuted
												: colors.text,
									}}
								>
									{String(Number(day.slice(8)))}
								</Text>
								<View style={styles.dots}>
									{dots.map((tone) => (
										<View
											key={tone}
											style={[
												styles.dot,
												{
													backgroundColor: colors[tone],
													borderColor: isSelected
														? colors.onPrimary
														: colors[tone],
												},
											]}
										/>
									))}
								</View>
							</Pressable>
						</View>
					);
				})}
			</View>
			<View style={styles.legend}>
				{(["pay", "loan", "expected", "income"] as const).map((kind) => (
					<LegendItem
						key={kind}
						tone={KIND_COLOR[kind]}
						label={tr.calendar.legend[kind]}
					/>
				))}
				<LegendItem tone="calDone" label={tr.calendar.legend.done} />
			</View>
		</View>
	);
}

function LegendItem({ tone, label }: { tone: ColorToken; label: string }) {
	const { colors, typography } = useAppTheme();
	return (
		<View style={styles.legendItem}>
			<View style={[styles.legendDot, { backgroundColor: colors[tone] }]} />
			<Text style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}>
				{label}
			</Text>
		</View>
	);
}

// Several days at once (7 gün, 30 gün, Geciken): one titled card per day.
function DayGroups({
	events,
	today,
	empty,
}: {
	events: FinanceEvent[];
	today: IsoDate;
	empty: string;
}) {
	const { colors, typography, spacing } = useAppTheme();
	if (events.length === 0) {
		return (
			<Text
				testID="calendar.rangeEmpty"
				style={[typography.body, { color: colors.textMuted, textAlign: "center" }]}
			>
				{empty}
			</Text>
		);
	}
	const days = eventsByDay(events);
	return (
		<View testID="calendar.rangeList" style={{ gap: spacing.lg }}>
			{Object.keys(days)
				.sort()
				.map((day) => (
					<View key={day} style={{ gap: spacing.sm }}>
						<SectionHeader>{dayTitle(day, today)}</SectionHeader>
						<FinanceList events={days[day] ?? []} prefix="calendar.item" />
					</View>
				))}
		</View>
	);
}

// Design 26 "Nakit projeksiyonu · 30 gün": Toplam Nakit walked forward through the planned items.
function ProjectionCard({ today }: { today: IsoDate }) {
	const { colors, typography, fonts, spacing, radius } = useAppTheme();
	const data = useFinanceEvents(today, addDays(today, PROJECTION_DAYS));
	if (data.isPending || data.error !== null) {
		return null;
	}
	const p = projection(data.events, today, data.cashMinor ?? 0, PROJECTION_DAYS);
	const bars = barPoints(p.points, BAR_COUNT);
	const lowest = p.lowest;
	return (
		<View style={{ gap: 10 }} testID="calendar.projection">
			<SectionHeader>{tr.calendar.projection.title}</SectionHeader>
			<View
				style={[
					styles.panel,
					{
						backgroundColor: colors.surface,
						borderColor: colors.border,
						borderRadius: radius.lg,
					},
				]}
			>
				<View style={[styles.row, { gap: 10 }]}>
					<View style={styles.grow}>
						<Text style={[typography.label, { fontSize: 12, color: colors.textMuted }]}>
							{tr.calendar.projection.out}
						</Text>
						<Text
							testID="calendar.projection.out"
							style={{
								fontFamily: fonts.extrabold,
								fontSize: 18,
								color: colors.text,
							}}
						>
							{formatTRY(p.out_minor)}
						</Text>
					</View>
					<View style={styles.grow}>
						<Text style={[typography.label, { fontSize: 12, color: colors.textMuted }]}>
							{tr.calendar.projection.in}
						</Text>
						<Text
							testID="calendar.projection.in"
							style={{
								fontFamily: fonts.extrabold,
								fontSize: 18,
								color: colors.receivable,
							}}
						>
							{formatTRY(p.in_minor)}
						</Text>
					</View>
				</View>
				{data.cashMinor === null ? (
					<Pressable
						testID="calendar.projection.addAccount"
						accessibilityRole="link"
						onPress={() => {
							router.push("/accounts/new");
						}}
						style={styles.link}
					>
						<Text style={[typography.rowTitle, { fontSize: 14, color: colors.accent }]}>
							{tr.calendar.projection.noAccounts}
						</Text>
					</Pressable>
				) : (
					<>
						<View
							testID="calendar.projection.bars"
							accessible
							accessibilityRole="image"
							accessibilityLabel={fill(tr.calendar.projection.chart, {
								points: bars
									.map((b) =>
										fill(tr.calendar.projection.point, {
											date: formatDateTR(b.date, "dayMonth"),
											amount: formatTRY(b.balance_minor),
										}),
									)
									.join(", "),
							})}
							style={[styles.bars, { marginTop: 14 }]}
						>
							{bars.map((bar) => (
								<View key={bar.date} style={styles.barCol}>
									<View
										style={{
											width: "100%",
											// The label takes the rest of the column.
											height: Math.round((bar.percent / 100) * BAR_AREA),
											borderTopLeftRadius: 6,
											borderTopRightRadius: 6,
											borderBottomLeftRadius: 2,
											borderBottomRightRadius: 2,
											backgroundColor: bar.low
												? colors.calPay
												: bar.high
													? colors.accent
													: colors.barSoft,
										}}
									/>
									<Text
										numberOfLines={1}
										style={{
											fontFamily: fonts.bold,
											fontSize: 10,
											color: bar.low ? colors.warning : colors.textMuted,
										}}
									>
										{bar.label}
									</Text>
								</View>
							))}
							{/* Eight columns always, as in the design, so few points do not make wide bars. */}
							{Array.from(
								{ length: Math.max(0, BAR_COUNT - bars.length) },
								(_, i) => (
									<View key={`pad-${String(i)}`} style={styles.barCol} />
								),
							)}
						</View>
						{lowest === null || bars.length < 2 ? null : (
							<View
								testID="calendar.projection.note"
								style={[
									styles.note,
									{
										gap: 10,
										marginTop: 14,
										borderRadius: 14,
										backgroundColor:
											p.risk === null
												? colors.surfaceSunken
												: colors.warningTint,
									},
								]}
							>
								<Ionicons
									name={
										p.risk === null
											? "trending-down-outline"
											: "warning-outline"
									}
									size={18}
									color={p.risk === null ? colors.textMuted : colors.warning}
								/>
								<Text
									style={[
										typography.caption,
										styles.grow,
										{
											lineHeight: 19,
											color:
												p.risk === null ? colors.textMuted : colors.warning,
										},
									]}
								>
									<Text style={{ fontFamily: fonts.extrabold }}>
										{fill(tr.calendar.projection.lowest, {
											date: formatDateTR(lowest.date, "dayMonth"),
											amount: formatTRY(lowest.balance_minor),
										})}
									</Text>
									{p.risk === null ? "" : ` ${tr.calendar.projection[p.risk]}`}
								</Text>
							</View>
						)}
						<Text
							style={[
								typography.caption,
								{ fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
							]}
						>
							{tr.calendar.projection.basis}
						</Text>
					</>
				)}
			</View>
		</View>
	);
}

function viewRange(range: Range, month: IsoDate, today: IsoDate): [IsoDate, IsoDate] {
	if (range === "week") return [today, addDays(today, 6)];
	if (range === "days30") return [today, addDays(today, PROJECTION_DAYS - 1)];
	if (range === "overdue") return [today, today];
	const days = daysOfMonth(month);
	return [month, days[days.length - 1] ?? month];
}

// Design 26: every module's dated items in one calendar, then the 30-day cash projection.
export function CalendarScreen() {
	const { colors, typography, spacing } = useAppTheme();
	const today = useToday();
	const [range, setRange] = useState<Range>("month");
	const [month, setMonth] = useState(() => monthOf(today));
	const [selected, setSelected] = useState(today);
	const [from, to] = viewRange(range, month, today);
	const data = useFinanceEvents(from, to);
	const days = eventsByDay(data.events);
	const items = days[selected] ?? [];
	const monthText = `${monthName(Number(month.slice(5, 7)))} ${month.slice(0, 4)}`;

	function goTo(delta: number) {
		const next = shiftMonth(month, delta);
		setRange("month");
		setMonth(next);
		setSelected(next === monthOf(today) ? today : next);
	}

	return (
		<Screen
			testID="calendar.screen"
			refreshControl={
				<RefreshControl
					refreshing={false}
					onRefresh={() => {
						data.refetch();
					}}
				/>
			}
		>
			<View style={[styles.row, { gap: spacing.sm }]}>
				<Text
					accessibilityRole="header"
					style={[typography.title, styles.grow, { color: colors.text, paddingLeft: 4 }]}
				>
					{tr.tabs.calendar}
				</Text>
				<IconButton
					icon="chevron-back"
					label={tr.calendar.prev}
					onPress={() => {
						goTo(-1);
					}}
					testID="calendar.prev.button"
				/>
				<IconButton
					icon="chevron-forward"
					label={tr.calendar.next}
					onPress={() => {
						goTo(1);
					}}
					testID="calendar.next.button"
				/>
			</View>
			<SegmentedControl
				label={tr.calendar.range}
				hideLabel
				options={[
					{ value: "month", label: monthText },
					{ value: "week", label: tr.calendar.ranges.week },
					{ value: "days30", label: tr.calendar.ranges.days30 },
					{ value: "overdue", label: tr.calendar.ranges.overdue },
				]}
				value={range}
				onChange={setRange}
				testID="calendar.range"
			/>
			{data.isPending ? (
				<LoadingState rows={5} testID="calendar.loading" />
			) : data.error !== null ? (
				<ErrorState
					message={messageForError(data.error)}
					onRetry={data.refetch}
					testID="calendar.error"
				/>
			) : range === "month" ? (
				<>
					<MonthGrid
						month={month}
						days={days}
						selected={selected}
						today={today}
						onSelect={setSelected}
					/>
					<View testID="calendar.dayList" style={{ gap: 10 }}>
						<SectionHeader>{dayTitle(selected, today)}</SectionHeader>
						{items.length === 0 ? (
							<View
								style={[
									styles.emptyDay,
									{ backgroundColor: colors.surface, borderColor: colors.border },
								]}
							>
								<Text
									style={[
										typography.callout,
										{
											fontSize: 14,
											color: colors.textMuted,
											textAlign: "center",
										},
									]}
								>
									{tr.calendar.dayEmpty}
								</Text>
							</View>
						) : (
							<FinanceList events={items} prefix="calendar.item" />
						)}
					</View>
				</>
			) : (
				<DayGroups
					events={
						range === "overdue" ? data.overdue : data.events.filter((e) => !isDone(e))
					}
					today={today}
					empty={range === "overdue" ? tr.calendar.overdueEmpty : tr.calendar.rangeEmpty}
				/>
			)}
			<ProjectionCard today={today} />
		</Screen>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", alignItems: "center" },
	grow: { flex: 1, minWidth: 0 },
	monthCard: { borderWidth: 1, paddingTop: 10, paddingHorizontal: 10, paddingBottom: 14 },
	week: { flexDirection: "row", paddingTop: 4, paddingBottom: 6 },
	weekday: { letterSpacing: 0.4 },
	grid: { flexDirection: "row", flexWrap: "wrap" },
	cell: {
		// Seven equal columns.
		width: "14.2857%",
		alignItems: "center",
		textAlign: "center",
		padding: 1,
	},
	day: {
		width: "100%",
		height: 48,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
		gap: 4,
	},
	dots: { flexDirection: "row", gap: 3, height: 5 },
	dot: { width: 5, height: 5, borderRadius: 2.5, borderWidth: 0.5 },
	legend: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 12,
		paddingTop: 12,
		paddingHorizontal: 4,
	},
	legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
	legendDot: { width: 8, height: 8, borderRadius: 4 },
	panel: { borderWidth: 1, padding: 16 },
	bars: { flexDirection: "row", alignItems: "flex-end", height: 120, gap: 6 },
	barCol: { flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "center", gap: 4 },
	note: { flexDirection: "row", alignItems: "flex-start", padding: 12 },
	link: { minHeight: 44, justifyContent: "center", marginTop: 8 },
	emptyDay: { borderWidth: 1, borderRadius: 20, paddingVertical: 24, paddingHorizontal: 16 },
});
