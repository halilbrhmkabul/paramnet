import { formatDateTR, formatTRY } from "@paramnet/shared";
import { StyleSheet, Text, View } from "react-native";

import type { Loan } from "@/api/types";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

// Design 28 top card: remaining principal, a cell per installment, the next and the last date.
export function LoanPanel({ loan, testID }: { loan: Loan; testID?: string }) {
	const { colors, fonts, radius } = useAppTheme();
	const last = loan.schedule.at(-1);
	return (
		<View
			testID={testID}
			style={[styles.panel, { backgroundColor: colors.loanBg, borderRadius: radius.xl }]}
		>
			<View style={styles.between}>
				<Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.loanMuted }}>
					{`${loan.bank_name} · ${fill(tr.loanForm.termValue, { count: String(loan.term_months) })}`}
				</Text>
				<View style={[styles.badge, { backgroundColor: colors.loanTrack }]}>
					<Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.onCard }}>
						{loan.next === null
							? tr.loans.closed
							: fill(tr.loans.paidOf, {
									paid: String(loan.paid),
									count: String(loan.term_months),
								})}
					</Text>
				</View>
			</View>
			<Text
				style={{
					marginTop: 16,
					fontFamily: fonts.semibold,
					fontSize: 13,
					color: colors.loanMuted,
				}}
			>
				{tr.loans.remaining}
			</Text>
			<Text
				testID={testID === undefined ? undefined : `${testID}.remaining`}
				style={{
					fontFamily: fonts.extrabold,
					fontSize: 32,
					letterSpacing: -0.8,
					color: colors.onCard,
				}}
			>
				{formatTRY(loan.remaining_principal_minor)}
			</Text>
			<View
				accessible
				accessibilityRole="progressbar"
				accessibilityLabel={fill(tr.loans.progress, {
					count: String(loan.term_months),
					paid: String(loan.paid),
				})}
				style={[styles.cells, { gap: 2 }]}
			>
				{loan.schedule.map((row) => (
					<View
						key={row.seq}
						style={[
							styles.cell,
							{
								backgroundColor:
									row.seq <= loan.paid
										? colors.loanPaid
										: row.seq === loan.paid + 1
											? colors.loanNext
											: colors.loanTrack,
							},
						]}
					/>
				))}
			</View>
			<View style={[styles.between, { marginTop: 8 }]}>
				<Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.loanMuted }}>
					{loan.next === null
						? tr.loans.closed
						: fill(tr.loans.next, {
								date: formatDateTR(loan.next.due_date, "dayMonth"),
								amount: formatTRY(loan.next.payment_minor),
							})}
				</Text>
				{last === undefined ? null : (
					<Text
						style={{
							fontFamily: fonts.semibold,
							fontSize: 12,
							color: colors.loanMuted,
						}}
					>
						{fill(tr.loans.last, { date: formatDateTR(last.due_date, "short") })}
					</Text>
				)}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	panel: { padding: 20 },
	between: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		gap: 8,
	},
	badge: { height: 24, paddingHorizontal: 9, borderRadius: 999, justifyContent: "center" },
	cells: { flexDirection: "row", marginTop: 14 },
	cell: { flex: 1, height: 8, borderRadius: 2 },
});
