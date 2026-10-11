import {
	daysOfMonth,
	formatDateTR,
	isoWeekday,
	monthName,
	monthOf,
	shiftMonth,
	type IsoDate,
} from "@paramnet/shared";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useCalendar } from "@/api/hooks";
import type { DueItem } from "@/api/types";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { DueItemRow } from "@/features/agreements/DueItemRow";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import type { ColorToken } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

// The most urgent item decides the dot colour; the label always says it too.
function dotTone(items: DueItem[]): ColorToken {
	const statuses = new Set(items.map((item) => item.state.status));
	if (statuses.has("overdue")) return "overdue";
	if (statuses.has("due_today")) return "warning";
	if (statuses.has("upcoming")) return "primary";
	return "success";
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
	const { colors, typography, radius, sizes } = useAppTheme();
	const leading = isoWeekday(month) - 1;
	return (
		<View>
			<View style={styles.week}>
				{tr.calendar.weekdays.map((weekday) => (
					<Text
						key={weekday}
						style={[typography.caption, styles.cell, { color: colors.textMuted }]}
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
					return (
						<Pressable
							key={day}
							testID={`calendar.day.${day}`}
							accessibilityRole="button"
							accessibilityLabel={dayLabel(day, items)}
							accessibilityState={{ selected: isSelected }}
							onPress={() => {
								onSelect(day);
							}}
							style={[
								styles.cell,
								{
									minHeight: sizes.minTouch,
									borderRadius: radius.sm,
									backgroundColor: isSelected ? colors.primary : "transparent",
									borderWidth: day === today && !isSelected ? 1 : 0,
									borderColor: colors.primary,
								},
							]}
						>
							<Text
								style={[
									typography.callout,
									{ color: isSelected ? colors.onPrimary : colors.text },
								]}
							>
								{String(Number(day.slice(8)))}
							</Text>
							{items.length > 0 ? (
								<View
									style={[
										styles.dot,
										{
											backgroundColor: isSelected
												? colors.onPrimary
												: colors[dotTone(items)],
										},
									]}
								/>
							) : null}
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}

// S18
export function CalendarScreen() {
	const { colors, typography, spacing } = useAppTheme();
	const today = useToday();
	const [month, setMonth] = useState(() => monthOf(today));
	const [selected, setSelected] = useState(today);
	const calendar = useCalendar(month);
	const year = month.slice(0, 4);
	const items = calendar.data?.days[selected] ?? [];

	function goTo(delta: number) {
		const next = shiftMonth(month, delta);
		setMonth(next);
		setSelected(next === monthOf(today) ? today : next);
	}

	return (
		<Screen testID="calendar.screen">
			<ScreenTitle>{tr.tabs.calendar}</ScreenTitle>
			<View style={styles.header}>
				<Button
					label="‹"
					variant="ghost"
					accessibilityLabel={tr.calendar.prev}
					onPress={() => {
						goTo(-1);
					}}
					testID="calendar.prev.button"
				/>
				<Text
					testID="calendar.month.text"
					accessibilityRole="header"
					style={[typography.headline, { color: colors.text }]}
				>
					{`${monthName(Number(month.slice(5, 7)))} ${year}`}
				</Text>
				<Button
					label="›"
					variant="ghost"
					accessibilityLabel={tr.calendar.next}
					onPress={() => {
						goTo(1);
					}}
					testID="calendar.next.button"
				/>
			</View>
			{calendar.isPending ? (
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
					<View testID="calendar.dayList" style={{ gap: spacing.xs }}>
						<Text
							accessibilityRole="header"
							style={[typography.headline, { color: colors.text }]}
						>
							{formatDateTR(selected, "long")}
						</Text>
						{items.length === 0 ? (
							<Text style={[typography.body, { color: colors.textMuted }]}>
								{tr.calendar.dayEmpty}
							</Text>
						) : (
							items.map((item) => (
								<DueItemRow
									key={`${item.agreement_id}.${String(item.seq)}`}
									item={item}
									testID={`calendar.item.${item.agreement_id}.${String(item.seq)}`}
								/>
							))
						)}
					</View>
				</>
			)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	week: {
		flexDirection: "row",
	},
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
	},
	cell: {
		// Seven equal columns.
		width: "14.2857%",
		alignItems: "center",
		justifyContent: "center",
		textAlign: "center",
		paddingVertical: 4,
	},
	dot: {
		width: 6,
		height: 6,
		borderRadius: 3,
		marginTop: 2,
	},
});
