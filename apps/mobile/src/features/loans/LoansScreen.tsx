import { formatTRY } from "@paramnet/shared";
import { router } from "expo-router";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useLoans } from "@/api/hooks";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

import { LoanPanel } from "./LoanPanel";

// The loans list (the design opens 28 directly; with more than one loan the user picks here).
export function LoansScreen() {
	const { colors, typography, fonts, radius } = useAppTheme();
	const loans = useLoans();
	const add = () => {
		router.push("/loans/new");
	};
	if (loans.isPending) {
		return (
			<Screen testID="loans.screen" edges={["bottom"]}>
				<LoadingState rows={3} testID="loans.loading" />
			</Screen>
		);
	}
	if (loans.isError) {
		return (
			<Screen testID="loans.screen" edges={["bottom"]}>
				<ErrorState
					message={messageForError(loans.error)}
					onRetry={() => {
						void loans.refetch();
					}}
					testID="loans.error"
				/>
			</Screen>
		);
	}
	if (loans.data.loans.length === 0) {
		return (
			<Screen testID="loans.screen" edges={["bottom"]}>
				<EmptyState
					title={tr.loans.emptyTitle}
					body={tr.loans.emptyBody}
					actionLabel={tr.loans.add}
					onAction={add}
					actionTestID="loans.empty.action"
					testID="loans.empty"
				/>
			</Screen>
		);
	}
	return (
		<Screen
			testID="loans.screen"
			edges={["bottom"]}
			footer={<Button label={tr.loans.add} onPress={add} testID="loans.add.button" />}
			refreshControl={
				<RefreshControl
					refreshing={loans.isRefetching}
					onRefresh={() => {
						void loans.refetch();
					}}
				/>
			}
		>
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
				<View style={styles.grow}>
					<Text style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}>
						{tr.loans.remaining}
					</Text>
					<Text
						testID="loans.remaining"
						style={{ fontFamily: fonts.extrabold, fontSize: 17, color: colors.text }}
					>
						{formatTRY(loans.data.remaining_principal_minor)}
					</Text>
				</View>
				<View style={styles.grow}>
					<Text style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}>
						{tr.loans.monthly}
					</Text>
					<Text
						testID="loans.monthly"
						style={{ fontFamily: fonts.extrabold, fontSize: 17, color: colors.text }}
					>
						{formatTRY(loans.data.monthly_minor)}
					</Text>
				</View>
			</View>
			<Text style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}>
				{tr.loans.note}
			</Text>
			{loans.data.loans.map((loan, index) => (
				<Pressable
					key={loan.id}
					testID={`loans.item.${String(index)}`}
					accessibilityRole="button"
					accessibilityLabel={fill(tr.loans.open, {
						name: `${loan.bank_name} ${loan.loan_type}`,
						amount: formatTRY(loan.remaining_principal_minor),
					})}
					onPress={() => {
						router.push({ pathname: "/loans/[id]", params: { id: loan.id } });
					}}
					style={{ gap: 8 }}
				>
					<Text style={[typography.headline, { color: colors.text }]}>
						{loan.loan_type}
					</Text>
					<LoanPanel loan={loan} />
				</Pressable>
			))}
		</Screen>
	);
}

const styles = StyleSheet.create({
	grow: { flex: 1 },
	totals: { flexDirection: "row", borderWidth: 1, padding: 16, gap: 8 },
});
