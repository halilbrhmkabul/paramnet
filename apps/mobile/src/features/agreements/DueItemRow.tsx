import { daysBetween, formatDateTR, type IsoDate } from "@paramnet/shared";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { DueItem } from "@/api/types";
import { AmountText } from "@/components/AmountText";
import { Badge, type BadgeTone } from "@/components/StatusBadge";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { useAppTheme } from "@/theme/useAppTheme";

export function installmentPosition(seq: number, count: number): string {
	return count === 1
		? tr.installment.single
		: fill(tr.installment.position, { seq: String(seq), count: String(count) });
}

// Design 03 ".dt": the day and month in a small sunken box.
export function DateChip({ date }: { date: string }) {
	const { colors, fonts } = useAppTheme();
	const [day = "", month = ""] = formatDateTR(date, "short").split(" ");
	return (
		<View style={[styles.chip, { backgroundColor: colors.surfaceSunken }]}>
			<Text
				style={{
					fontFamily: fonts.extrabold,
					fontSize: 17,
					lineHeight: 20,
					color: colors.text,
				}}
			>
				{day}
			</Text>
			<Text
				style={{
					fontFamily: fonts.bold,
					fontSize: 10,
					lineHeight: 12,
					marginTop: 1,
					letterSpacing: 0.4,
					color: colors.textMuted,
				}}
			>
				{month.toLocaleUpperCase("tr-TR")}
			</Text>
		</View>
	);
}

// "Yaklaşıyor · 2 gün", "7 gün", "Bugün", "Gecikti · 10 gün" (design 03).
export function dueBadge(item: DueItem, today: IsoDate): { label: string; tone: BadgeTone } {
	const days = daysBetween(today, item.due_date);
	if (item.state.status === "overdue" || days < 0) {
		return {
			label: fill(tr.home.badgeLate, { days: String(Math.abs(days)) }),
			tone: "overdue",
		};
	}
	if (days === 0) {
		return { label: tr.installment.status.due_today, tone: "warning" };
	}
	return days <= 7
		? { label: fill(tr.home.badgeSoon, { days: String(days) }), tone: "warning" }
		: { label: fill(tr.home.badgeDays, { days: String(days) }), tone: "neutral" };
}

// One unpaid installment: date box, who and what, how soon, the amount.
export function DueItemRow({ item, testID }: { item: DueItem; testID: string }) {
	const { colors, fonts } = useAppTheme();
	const today = useToday();
	const title = `${item.counterparty_name} · ${item.title}`;
	const badge = dueBadge(item, today);
	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={`${title}, ${badge.label}`}
			onPress={() => {
				router.push({ pathname: "/agreement/[id]", params: { id: item.agreement_id } });
			}}
			style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
		>
			<DateChip date={item.due_date} />
			<View style={styles.grow}>
				<Text
					numberOfLines={1}
					style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text }}
				>
					{title}
				</Text>
				<View style={styles.line}>
					<Badge label={badge.label} tone={badge.tone} />
					{item.installment_count > 1 ? (
						<Text
							style={{
								fontFamily: fonts.medium,
								fontSize: 12,
								color: colors.textMuted,
							}}
						>
							{installmentPosition(item.seq, item.installment_count)}
						</Text>
					) : null}
				</View>
			</View>
			<AmountText
				minor={item.due_minor}
				tone={item.my_role === "creditor" ? "receivable" : "text"}
				style={{ fontFamily: fonts.extrabold, fontSize: 15 }}
			/>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		minHeight: 66,
		paddingVertical: 12,
		paddingHorizontal: 16,
	},
	grow: { flex: 1, minWidth: 0 },
	line: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 2 },
	chip: {
		width: 44,
		height: 48,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
	},
});
