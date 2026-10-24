import { formatDateTR, formatRateBps, formatTRY } from "@paramnet/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useLoan } from "@/api/hooks";
import type { LoanDetail } from "@/api/types";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { IconButton } from "@/components/TopBar";
import { dayLabel } from "@/features/cash/cashModel";
import { TransactionRow } from "@/features/cash/parts";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

import { LoanPanel } from "./LoanPanel";

// Rows around the next installment; the whole plan on request (design "Tüm 24 taksiti göster").
const AROUND = { before: 2, after: 3 };

function Plan({ data }: { data: LoanDetail }) {
	const { colors, fonts, radius } = useAppTheme();
	const { loan } = data;
	const [all, setAll] = useState(false);
	const start = Math.max(0, loan.paid - AROUND.before);
	const rows = all ? loan.schedule : loan.schedule.slice(start, loan.paid + AROUND.after + 1);
	const cell = (
		text: string,
		bold: boolean,
		tone: string,
		flex = 1,
		align: "left" | "right" = "right",
	) => (
		<Text
			style={{
				flex,
				textAlign: align,
				fontFamily: bold ? fonts.extrabold : fonts.semibold,
				fontSize: 13,
				color: tone,
			}}
		>
			{text}
		</Text>
	);
	return (
		<View
			style={{
				backgroundColor: colors.surface,
				borderColor: colors.border,
				borderWidth: 1,
				borderRadius: radius.lg,
				overflow: "hidden",
			}}
		>
			<View style={[styles.tr, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
				{cell(tr.loans.columns.seq, true, colors.textMuted, 1.3, "left")}
				{cell(tr.loans.columns.principal, true, colors.textMuted)}
				{cell(tr.loans.columns.interest, true, colors.textMuted)}
				{cell(tr.loans.columns.balance, true, colors.textMuted)}
			</View>
			{rows.map((row) => {
				const paid = row.seq <= loan.paid;
				const next = row.seq === loan.paid + 1;
				const tone = paid ? colors.textMuted : colors.text;
				return (
					<View
						key={row.seq}
						testID={`loanDetail.row.${String(row.seq)}`}
						style={[
							styles.tr,
							{
								borderBottomWidth: 1,
								borderBottomColor: colors.divider,
								backgroundColor: next ? colors.warningSoft : "transparent",
							},
						]}
					>
						{cell(
							`${String(row.seq)} · ${formatDateTR(row.due_date, "dayMonth")}`,
							next,
							tone,
							1.3,
							"left",
						)}
						{cell(formatTRY(row.principal_minor), next, tone)}
						{cell(formatTRY(row.interest_minor), next, tone)}
						{cell(formatTRY(row.balance_minor), next, tone)}
					</View>
				);
			})}
			{loan.schedule.length > rows.length || all ? (
				<Pressable
					testID="loanDetail.showAll"
					accessibilityRole="button"
					onPress={() => {
						setAll((value) => !value);
					}}
					style={styles.more}
				>
					<Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.accent }}>
						{all
							? tr.loans.showLess
							: fill(tr.loans.showAll, { count: String(loan.term_months) })}
					</Text>
				</Pressable>
			) : null}
		</View>
	);
}

// Design 28: the loan, its plan and the installments recorded so far.
export function LoanDetailScreen({ id }: { id: string }) {
	const { colors, typography, fonts, spacing, radius } = useAppTheme();
	const detail = useLoan(id);
	if (detail.isPending) {
		return (
			<Screen testID="loanDetail.screen" edges={["bottom"]}>
				<LoadingState rows={4} testID="loanDetail.loading" />
			</Screen>
		);
	}
	if (detail.isError) {
		return (
			<Screen testID="loanDetail.screen" edges={["bottom"]}>
				<ErrorState
					message={messageForError(detail.error)}
					onRetry={() => {
						void detail.refetch();
					}}
					testID="loanDetail.error"
				/>
			</Screen>
		);
	}
	const { loan, payments } = detail.data;
	const kv = (label: string, value: string, testID?: string) => (
		<View style={styles.kv}>
			<Text style={[typography.callout, { color: colors.textMuted }]}>{label}</Text>
			<Text
				testID={testID}
				style={{
					fontFamily: fonts.bold,
					fontSize: 14,
					color: colors.text,
					textAlign: "right",
					flexShrink: 1,
				}}
			>
				{value}
			</Text>
		</View>
	);
	const divider = <View style={{ height: 1, backgroundColor: colors.divider }} />;
	return (
		<Screen testID="loanDetail.screen" edges={["bottom"]}>
			<View style={[styles.head, { gap: spacing.sm }]}>
				<Text
					accessibilityRole="header"
					style={[typography.title, styles.grow, { color: colors.text }]}
				>
					{loan.loan_type}
				</Text>
				<IconButton
					icon="create-outline"
					label={tr.loans.edit}
					onPress={() => {
						router.push({ pathname: "/loans/[id]/edit", params: { id: loan.id } });
					}}
					testID="loanDetail.edit.button"
				/>
			</View>
			<LoanPanel loan={loan} testID="loanDetail.panel" />
			<Button
				label={tr.loans.early}
				variant="secondary"
				disabled={loan.next === null}
				onPress={() => {
					router.push({ pathname: "/interest", params: { loan: loan.id } });
				}}
				testID="loanDetail.early.button"
			/>
			<Button
				label={tr.loans.payNext}
				disabled={loan.next === null}
				onPress={() => {
					router.push({ pathname: "/loans/[id]/pay", params: { id: loan.id } });
				}}
				testID="loanDetail.pay.button"
			/>
			<View style={{ gap: spacing.sm }}>
				<SectionHeader>{tr.loans.info}</SectionHeader>
				<View
					style={{
						backgroundColor: colors.surface,
						borderColor: colors.border,
						borderWidth: 1,
						borderRadius: radius.lg,
					}}
				>
					{kv(tr.loans.principal, formatTRY(loan.principal_minor))}
					{divider}
					{kv(tr.loans.rate, formatRateBps(loan.monthly_rate_bps), "loanDetail.rate")}
					{divider}
					{kv(
						tr.loans.installment,
						formatTRY(loan.installment_minor),
						"loanDetail.installment",
					)}
					{divider}
					{kv(tr.loans.firstDue, formatDateTR(loan.first_due_on, "long"))}
					{divider}
					{kv(
						tr.loans.remainingTotal,
						fill(tr.loans.remainingTotalValue, {
							amount: formatTRY(loan.remaining_total_minor),
							count: String(loan.term_months - loan.paid),
						}),
						"loanDetail.remainingTotal",
					)}
					{divider}
					{kv(
						tr.loans.totalInterest,
						formatTRY(loan.total_interest_minor),
						"loanDetail.interest",
					)}
					{divider}
					{kv(
						tr.loans.account,
						loan.payment_account_name === null
							? tr.loans.noAccount
							: fill(tr.loans.accountValue, { name: loan.payment_account_name }),
					)}
				</View>
				<Text
					style={[
						typography.caption,
						{ fontSize: 12, color: colors.textMuted, paddingHorizontal: 4 },
					]}
				>
					{tr.loans.note}
				</Text>
			</View>
			<View style={{ gap: spacing.sm }}>
				<SectionHeader>{tr.loans.plan}</SectionHeader>
				<Plan data={detail.data} />
			</View>
			<View style={{ gap: spacing.sm }}>
				<SectionHeader>{tr.loans.payments}</SectionHeader>
				{payments.length === 0 ? (
					<Text style={[typography.body, { color: colors.textMuted }]}>
						{tr.loans.paymentsEmpty}
					</Text>
				) : (
					<View
						style={{
							backgroundColor: colors.surface,
							borderColor: colors.border,
							borderWidth: 1,
							borderRadius: radius.lg,
						}}
					>
						{payments.map((tx, index) => (
							<View key={tx.id}>
								{index > 0 ? divider : null}
								<TransactionRow
									tx={tx}
									sub={dayLabel(tx.occurred_on)}
									onPress={() => {
										router.push({
											pathname: "/transaction/[id]",
											params: { id: tx.id },
										});
									}}
									testID={`loanDetail.payment.${String(index)}`}
								/>
							</View>
						))}
					</View>
				)}
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	grow: { flex: 1, minWidth: 0 },
	head: { flexDirection: "row", alignItems: "center" },
	kv: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 12,
		minHeight: 48,
	},
	tr: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	more: { minHeight: 48, alignItems: "center", justifyContent: "center" },
});
