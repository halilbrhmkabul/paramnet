import { formatDateTR } from "@paramnet/shared";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { DueItem } from "@/api/types";
import { AmountText } from "@/components/AmountText";
import { InstallmentStatusBadge } from "@/components/StatusBadge";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

export function installmentPosition(seq: number, count: number): string {
	return count === 1
		? tr.installment.single
		: fill(tr.installment.position, { seq: String(seq), count: String(count) });
}

// Design "dt": the day and month in a small sunken box.
function DateChip({ date }: { date: string }) {
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
					color: colors.textMuted,
				}}
			>
				{month.toLocaleUpperCase("tr-TR")}
			</Text>
		</View>
	);
}

// One unpaid installment (home, calendar): date, who and what, amount; status always written out.
export function DueItemRow({ item, testID }: { item: DueItem; testID: string }) {
	const { colors, typography, spacing } = useAppTheme();
	const title = `${item.counterparty_name} · ${item.title}`;
	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={title}
			onPress={() => {
				router.push({ pathname: "/agreement/[id]", params: { id: item.agreement_id } });
			}}
			style={({ pressed }) => [styles.row, { gap: spacing.md, opacity: pressed ? 0.7 : 1 }]}
		>
			<DateChip date={item.due_date} />
			<View style={[styles.grow, { gap: spacing.xs }]}>
				<Text style={[typography.rowTitle, { color: colors.text }]} numberOfLines={1}>
					{title}
				</Text>
				<View style={[styles.line, { gap: spacing.sm }]}>
					<InstallmentStatusBadge
						status={item.state.status}
						partial={item.state.partial}
					/>
					<Text style={[typography.caption, { color: colors.textMuted }]}>
						{installmentPosition(item.seq, item.installment_count)}
					</Text>
				</View>
			</View>
			<AmountText
				minor={item.due_minor}
				variant="rowTitle"
				tone={item.my_role === "creditor" ? "receivable" : "payable"}
			/>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", alignItems: "center", minHeight: 66, paddingVertical: 10 },
	grow: { flex: 1, minWidth: 0 },
	line: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
	chip: {
		width: 44,
		height: 48,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
	},
});
