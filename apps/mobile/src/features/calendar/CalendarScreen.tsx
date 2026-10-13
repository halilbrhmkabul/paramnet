import {
	addDays,
	daysBetween,
	daysOfMonth,
	formatDateTR,
	isoWeekday,
	monthName,
	monthOf,
	shiftMonth,
	type IsoDate,
} from "@paramnet/shared";
import { router } from "expo-router";
import { Children, isValidElement, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useCalendar, useDashboard } from "@/api/hooks";
import type { DueItem } from "@/api/types";
import { AmountText } from "@/components/AmountText";
import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Badge, type BadgeTone } from "@/components/StatusBadge";
import { IconButton } from "@/components/TopBar";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import type { ColorToken } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

type Mode = "month" | "week" | "days30" | "overdue";

// Design 26 legend: what I pay, what I expect to receive, late, done.
function itemColor(item: DueItem): ColorToken {
	if (item.state.status === "paid") return "calDone";
	if (item.state.status === "overdue") return "overdue";
	return item.my_role === "creditor" ? "calIncoming" : "calPayment";
}

function itemBadge(item: DueItem, today: IsoDate): { label: string; tone: BadgeTone } {
	switch (item.state.status) {
		case "paid":
			return { label: tr.installment.status.paid, tone: "success" };
		case "overdue":
			return { label: tr.installment.status.overdue, tone: "overdue" };
		case "due_today":
			return { label: tr.installment.status.due_today, tone: "warning" };
		default:
			if (item.my_role === "creditor") {
				return { label: tr.calendar.expected, tone: "pending" };
			}
			return daysBetween(today, item.due_date) <= 7
				? { label: tr.installment.status.upcoming, tone: "warning" }
				: { label: tr.calendar.planned, tone: "neutral" };
	}
}

function itemTitle(item: DueItem): string {
	return item.installment_count > 1
		? `${item.title} ${String(item.seq)}/${String(item.installment_count)}`
		: item.title;
}

function dayLabel(day: IsoDate, items: DueItem[]): string {
	const date = formatDateTR(day, "dayMonth");
	if (items.length === 0) {
		return date;
	}
	const label = fill(tr.calendar.dayLabel, { date, count: String(items.length) });
	return items.some((item) => item.state.status === "overdue")
		? `${label}, ${tr.calendar.hasOverdue}`
		: label;
}

function dayTitle(day: IsoDate, today: IsoDate): string {
	const title = fill(tr.calendar.dayTitle, {
		date: formatDateTR(day, "dayMonth"),
		weekday: tr.calendar.weekdayNames[isoWeekday(day) - 1] ?? "",
	});
	return day === today ? `${title} · ${tr.calendar.today}` : title;
}

function MonthGrid({
	month,
	days,
	selected,
	today,
	onSelect,
}: {
	month: IsoDate;
	days: Partial<Record<IsoDate, DueItem[]>>;
	selected: IsoDate;
	today: IsoDate;
	onSelect: (day: IsoDate) => void;
}) {
	const { colors, fonts } = useAppTheme();
	const leading = isoWeekday(month) - 1;
	const legend: [ColorToken, string][] = [
		["calPayment", tr.calendar.legendPayment],
		["calIncoming", tr.calendar.legendIncoming],
		["overdue", tr.calendar.legendOverdue],
		["calDone", tr.calendar.legendDone],
	];
	return (
		<Card style={styles.gridCard}>
			<View style={styles.week}>
				{tr.calendar.weekdays.map((weekday) => (
					<Text
						key={weekday}
						style={[
							styles.cell,
							styles.weekday,
							{ fontFamily: fonts.extrabold, color: colors.textMuted },
						]}
					>
						{weekday}
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
					const isToday = day === today;
					const past = day < today;
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
										borderWidth: isToday && !isSelected ? 1.5 : 0,
										borderColor: colors.accent,
									},
								]}
							>
								<Text
									style={{
										fontFamily:
											past && !isSelected ? fonts.semibold : fonts.bold,
										fontSize: 15,
										color: isSelected
											? colors.onPrimary
											: past
												? colors.tabInactive
												: isToday
													? colors.primary
													: colors.text,
									}}
								>
									{String(Number(day.slice(8)))}
								</Text>
								<View style={styles.dots}>
									{items.slice(0, 3).map((item) => (
										<View
											key={`${item.agreement_id}.${String(item.seq)}`}
											style={[
												styles.dot,
												{ backgroundColor: colors[itemColor(item)] },
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
				{legend.map(([tone, label]) => (
					<View key={label} style={styles.legendItem}>
						<View style={[styles.legendDot, { backgroundColor: colors[tone] }]} />
						<Text
							style={{
								fontFamily: fonts.semibold,
								fontSize: 12,
								color: colors.neutral,
							}}
						>
							{label}
						</Text>
					</View>
				))}
			</View>
		</Card>
	);
}

// Design 26 ".ev": a colour bar, what and who, the amount with its state.
function EventRow({ item, showDate }: { item: DueItem; showDate: boolean }) {
	const { colors, fonts } = useAppTheme();
	const today = useToday();
	const badge = itemBadge(item, today);
	const title = itemTitle(item);
	const subtitle = showDate
		? `${item.counterparty_name} · ${formatDateTR(item.due_date, "dayMonth")}`
		: item.counterparty_name;
	return (
		<Pressable
			testID={`calendar.item.${item.agreement_id}.${String(item.seq)}`}
			accessibilityRole="button"
			accessibilityLabel={`${title}, ${subtitle}, ${badge.label}`}
			onPress={() => {
				router.push({ pathname: "/agreement/[id]", params: { id: item.agreement_id } });
			}}
			style={({ pressed }) => [styles.event, { opacity: pressed ? 0.7 : 1 }]}
		>
			<View style={[styles.bar, { backgroundColor: colors[itemColor(item)] }]} />
			<View style={styles.grow}>
				<Text
					numberOfLines={1}
					style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text }}
				>
					{title}
				</Text>
				<Text
					numberOfLines={1}
					style={{
						fontFamily: fonts.medium,
						fontSize: 13,
						marginTop: 2,
						color: colors.textMuted,
					}}
				>
					{subtitle}
				</Text>
			</View>
			<View style={styles.end}>
				<AmountText
					minor={item.due_minor}
					tone={item.my_role === "creditor" ? "receivable" : "text"}
					style={{ fontFamily: fonts.extrabold, fontSize: 15 }}
				/>
				<View style={{ marginTop: 4 }}>
					<Badge label={badge.label} tone={badge.tone} />
				</View>
			</View>
		</Pressable>
	);
}

function EventList({
	title,
	empty,
	items,
	showDate,
}: {
	title: string;
	empty: string;
	items: DueItem[];
	showDate: boolean;
}) {
	const { colors, fonts, typography } = useAppTheme();
	return (
		<View testID="calendar.dayList">
			<Text
				accessibilityRole="header"
				style={[typography.headline, styles.h2, { color: colors.text }]}
			>
				{title}
			</Text>
			<Card style={styles.flush}>
				{items.length === 0 ? (
					<Text
						style={[
							styles.empty,
							{ fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
						]}
					>
						{empty}
					</Text>
				) : (
					<Rows>
						{items.map((item) => (
							<EventRow
								key={`${item.agreement_id}.${String(item.seq)}`}
								item={item}
								showDate={showDate}
							/>
						))}
					</Rows>
				)}
			</Card>
		</View>
	);
}

function Rows({ children }: { children: ReactNode }) {
	const { colors } = useAppTheme();
	return (
		<>
			{Children.toArray(children).map((child, index) => (
				<View
					key={isValidElement(child) ? child.key : index}
					style={
						index === 0
							? undefined
							: { borderTopWidth: 1, borderTopColor: colors.divider }
					}
				>
					{child}
				</View>
			))}
		</>
	);
}

// Items in [today, today + days], from this month and the next (a window never spans more).
function Window({ days, title }: { days: number; title: string }) {
	const today = useToday();
	const thisMonth = useCalendar(monthOf(today));
	const nextMonth = useCalendar(shiftMonth(monthOf(today), 1));
	if (thisMonth.isPending || nextMonth.isPending) {
		return <LoadingState rows={3} testID="calendar.loading" />;
	}
	if (thisMonth.isError || nextMonth.isError) {
		const error = thisMonth.error ?? nextMonth.error;
		return (
			<ErrorState
				message={messageForError(error)}
				onRetry={() => {
					void thisMonth.refetch();
					void nextMonth.refetch();
				}}
				testID="calendar.error"
			/>
		);
	}
	const end = addDays(today, days);
	const items = [thisMonth.data, nextMonth.data]
		.flatMap((month) => Object.entries(month.days))
		.filter(([day]) => day >= today && day <= end)
		.sort(([a], [b]) => (a < b ? -1 : 1))
		.flatMap(([, list]) => list ?? [])
		.filter((item) => item.state.status !== "paid");
	return <EventList title={title} empty={tr.calendar.windowEmpty} items={items} showDate />;
}

function Overdue() {
	const dashboard = useDashboard();
	if (dashboard.isPending) {
		return <LoadingState rows={3} testID="calendar.loading" />;
	}
	if (dashboard.isError) {
		return (
			<ErrorState
				message={messageForError(dashboard.error)}
				onRetry={() => {
					void dashboard.refetch();
				}}
				testID="calendar.error"
			/>
		);
	}
	return (
		<EventList
			title={tr.calendar.overdueTitle}
			empty={tr.calendar.overdueEmpty}
			items={dashboard.data.overdue}
			showDate
		/>
	);
}

// S18 · design 26
export function CalendarScreen() {
	const today = useToday();
	const [mode, setMode] = useState<Mode>("month");
	const [month, setMonth] = useState(() => monthOf(today));
	const [selected, setSelected] = useState(today);
	const calendar = useCalendar(month);
	const monthLabel = `${monthName(Number(month.slice(5, 7)))} ${month.slice(0, 4)}`;

	function goTo(delta: number) {
		const next = shiftMonth(month, delta);
		setMonth(next);
		setSelected(next === monthOf(today) ? today : next);
		setMode("month");
	}

	return (
		<Screen testID="calendar.screen" gap={18}>
			<View style={styles.top}>
				<View style={styles.grow}>
					<ScreenTitle>{tr.tabs.calendar}</ScreenTitle>
				</View>
				<IconButton
					icon="back"
					label={tr.calendar.prev}
					onPress={() => {
						goTo(-1);
					}}
					testID="calendar.prev.button"
				/>
				<IconButton
					icon="chevronRight"
					label={tr.calendar.next}
					onPress={() => {
						goTo(1);
					}}
					testID="calendar.next.button"
				/>
			</View>
			<SegmentedControl
				label={tr.tabs.calendar}
				hideLabel
				compact
				options={[
					{ value: "month", label: monthLabel, testID: "calendar.month.text" },
					{ value: "week", label: tr.calendar.modeWeek },
					{ value: "days30", label: tr.calendar.modeMonth30 },
					{ value: "overdue", label: tr.calendar.modeOverdue },
				]}
				value={mode}
				onChange={setMode}
				testID="calendar.mode"
			/>
			{mode === "week" ? (
				<Window days={7} title={tr.calendar.windowTitleWeek} />
			) : mode === "days30" ? (
				<Window days={30} title={tr.calendar.windowTitle30} />
			) : mode === "overdue" ? (
				<Overdue />
			) : calendar.isPending ? (
				<LoadingState rows={5} testID="calendar.loading" />
			) : calendar.isError ? (
				<ErrorState
					message={messageForError(calendar.error)}
					onRetry={() => {
						void calendar.refetch();
					}}
					testID="calendar.error"
				/>
			) : (
				<>
					<MonthGrid
						month={month}
						days={calendar.data.days}
						selected={selected}
						today={today}
						onSelect={setSelected}
					/>
					<EventList
						title={dayTitle(selected, today)}
						empty={tr.calendar.dayEmpty}
						items={calendar.data.days[selected] ?? []}
						showDate={false}
					/>
				</>
			)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	top: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 4 },
	grow: { flex: 1, minWidth: 0 },
	end: { alignItems: "flex-end" },
	gridCard: { paddingTop: 10, paddingHorizontal: 10, paddingBottom: 14, gap: 0 },
	week: { flexDirection: "row", paddingTop: 4, paddingBottom: 6 },
	weekday: { fontSize: 11, letterSpacing: 0.4, textAlign: "center" },
	grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 2 },
	cell: {
		// Seven equal columns.
		width: "14.2857%",
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 1,
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
	dot: { width: 5, height: 5, borderRadius: 2.5 },
	legend: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 12,
		paddingTop: 12,
		paddingHorizontal: 4,
	},
	legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
	legendDot: { width: 8, height: 8, borderRadius: 4 },
	h2: { marginHorizontal: 4, marginBottom: 10 },
	flush: { padding: 0, gap: 0 },
	empty: { paddingVertical: 24, paddingHorizontal: 16, textAlign: "center" },
	event: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingVertical: 12,
		paddingHorizontal: 16,
		minHeight: 64,
	},
	bar: { width: 8, alignSelf: "stretch", borderRadius: 4 },
});
