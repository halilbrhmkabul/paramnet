import { formatSignedTRY } from "@paramnet/shared";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Badge, type BadgeTone } from "@/components/StatusBadge";
import { fill, tr } from "@/i18n/tr";
import type { ColorToken } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

import { isDone, type FinanceEvent, type FinanceKind, type FinanceStatus } from "./financeModel";

export const KIND_COLOR: Record<FinanceKind, ColorToken> = {
	pay: "calPay",
	loan: "calLoan",
	expected: "calExpected",
	income: "calIncome",
};

export const STATUS_TONE: Record<FinanceStatus, BadgeTone> = {
	paid: "success",
	received: "success",
	info: "neutral",
	planned: "neutral",
	soon: "warning",
	today: "warning",
	waiting: "warning",
	expected: "pending",
	overdue: "overdue",
};

// Done items and notes are grey; the legend's colour says what is still to come.
export function eventColor(event: FinanceEvent): ColorToken {
	return isDone(event) ? "calDone" : KIND_COLOR[event.kind];
}

export function eventAmount(event: FinanceEvent): string {
	return event.amount_minor === null ? "" : formatSignedTRY(event.amount_minor, event.sign);
}

// Design 26 ".ev": a colour strip, the item and its day's amount with a status label.
export function FinanceRow({ event, testID }: { event: FinanceEvent; testID: string }) {
	const { colors, typography, fonts, spacing } = useAppTheme();
	const amount = eventAmount(event);
	const status = tr.calendar.status[event.status];
	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={fill(tr.calendar.eventLabel, {
				title: event.title,
				sub: event.sub,
				amount,
				status,
			})}
			onPress={() => {
				router.push(event.href);
			}}
			style={({ pressed }) => [
				styles.row,
				{ gap: spacing.md, paddingHorizontal: spacing.lg, opacity: pressed ? 0.7 : 1 },
			]}
		>
			<View style={[styles.strip, { backgroundColor: colors[eventColor(event)] }]} />
			<View style={styles.grow}>
				<Text numberOfLines={2} style={[typography.rowTitle, { color: colors.text }]}>
					{event.title}
				</Text>
				<Text
					numberOfLines={1}
					style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}
				>
					{event.sub}
				</Text>
			</View>
			<View style={styles.end}>
				{amount === "" ? null : (
					<Text
						testID={`${testID}.amount`}
						style={{
							fontFamily: fonts.extrabold,
							fontSize: 15,
							color: event.sign === "plus" ? colors.receivable : colors.text,
							fontVariant: ["tabular-nums"],
						}}
					>
						{amount}
					</Text>
				)}
				<Badge
					label={status}
					tone={STATUS_TONE[event.status]}
					testID={`${testID}.status`}
				/>
			</View>
		</Pressable>
	);
}

// Rows in one card, divided like the design's list.
export function FinanceList({ events, prefix }: { events: FinanceEvent[]; prefix: string }) {
	const { colors, radius } = useAppTheme();
	return (
		<View
			style={[
				styles.card,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderRadius: radius.lg,
				},
			]}
		>
			{events.map((event, index) => (
				<View
					key={event.key}
					style={
						index === 0
							? undefined
							: { borderTopWidth: 1, borderTopColor: colors.divider }
					}
				>
					<FinanceRow event={event} testID={`${prefix}.${event.key}`} />
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", alignItems: "center", minHeight: 64, paddingVertical: 12 },
	strip: { width: 8, alignSelf: "stretch", borderRadius: 4 },
	grow: { flex: 1, minWidth: 0 },
	end: { alignItems: "flex-end", gap: 4 },
	card: { borderWidth: 1, overflow: "hidden" },
});
