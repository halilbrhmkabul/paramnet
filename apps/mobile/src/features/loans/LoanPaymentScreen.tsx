import { formatDateTR, formatTRY, type IsoDate } from "@paramnet/shared";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useAccounts, useLoan, useRecordLoanPayment } from "@/api/hooks";
import type { Account, Loan } from "@/api/types";
import { Button } from "@/components/Button";
import { DateField } from "@/components/DateField";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { AccountPickerSheet } from "@/features/cash/AccountPickerSheet";
import { AccountIcon } from "@/features/cash/parts";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { newIdempotencyKey } from "@/lib/ids";
import { useAppTheme } from "@/theme/useAppTheme";

function Form({ loan, accounts }: { loan: Loan; accounts: readonly Account[] }) {
	const { colors, typography, fonts, spacing, radius } = useAppTheme();
	const today = useToday();
	const next = loan.next;
	const [accountId, setAccountId] = useState(
		accounts.find((a) => a.id === loan.payment_account_id)?.id ?? accounts[0]?.id ?? "",
	);
	const [date, setDate] = useState<IsoDate>(
		next !== null && next.due_date < today ? next.due_date : today,
	);
	const [picking, setPicking] = useState(false);
	const key = useRef(newIdempotencyKey());
	const save = useRecordLoanPayment();
	const account = accounts.find((a) => a.id === accountId);
	if (next === null) {
		return null;
	}
	return (
		<Screen
			testID="loanPay.screen"
			edges={["bottom"]}
			footer={
				<View style={{ gap: spacing.sm }}>
					{save.error === null ? null : (
						<Text
							accessibilityLiveRegion="polite"
							style={[typography.caption, { color: colors.overdue }]}
						>
							{messageForError(save.error)}
						</Text>
					)}
					<Button
						label={fill(tr.loanPay.submit, { amount: formatTRY(next.payment_minor) })}
						loading={save.isPending}
						onPress={() => {
							save.mutate(
								{
									id: loan.id,
									accountId,
									paidOn: date,
									idempotencyKey: key.current,
								},
								{
									onSuccess: () => {
										router.back();
									},
								},
							);
						}}
						testID="loanPay.submit.button"
					/>
					<Text
						style={[
							typography.caption,
							{ fontSize: 12, color: colors.textMuted, textAlign: "center" },
						]}
					>
						{tr.loanPay.note}
					</Text>
				</View>
			}
		>
			<View>
				<Text
					style={[typography.headline, { color: colors.text }]}
				>{`${loan.bank_name} · ${loan.loan_type}`}</Text>
				<Text
					testID="loanPay.line"
					style={[typography.callout, { color: colors.textMuted }]}
				>
					{fill(tr.loanPay.line, {
						seq: String(next.seq),
						date: formatDateTR(next.due_date, "long"),
					})}
				</Text>
			</View>
			<Pressable
				testID="loanPay.account.button"
				accessibilityRole="button"
				accessibilityLabel={`${tr.loanPay.account}, ${account?.name ?? ""}`}
				onPress={() => {
					setPicking(true);
				}}
				style={[
					styles.source,
					{
						gap: 12,
						borderRadius: radius.md,
						backgroundColor: colors.surface,
						borderColor: colors.border,
					},
				]}
			>
				{account === undefined ? null : <AccountIcon kind={account.kind} size={36} />}
				<View style={{ flex: 1 }}>
					<Text style={[typography.rowTitle, { color: colors.text }]}>
						{account?.name ?? tr.txForm.pickAccount}
					</Text>
					<Text style={[typography.caption, { color: colors.textMuted }]}>
						{tr.loanPay.account}
					</Text>
				</View>
			</Pressable>
			<DateField
				label={tr.loanPay.date}
				value={date}
				onChange={setDate}
				defaultPickerDate={today}
				testID="loanPay.date"
			/>
			{account === undefined ? null : (
				<View
					style={[
						styles.kv,
						{ backgroundColor: colors.surfaceSunken, borderRadius: radius.md },
					]}
				>
					<Text style={[typography.callout, { color: colors.textMuted }]}>
						{fill(tr.loanPay.after, { account: account.name })}
					</Text>
					<Text
						testID="loanPay.after"
						style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.text }}
					>
						{formatTRY(account.balance_minor - next.payment_minor)}
					</Text>
				</View>
			)}
			<AccountPickerSheet
				visible={picking}
				title={tr.loanPay.account}
				accounts={accounts}
				selectedId={accountId}
				onSelect={(a) => {
					setAccountId(a.id);
					setPicking(false);
				}}
				onClose={() => {
					setPicking(false);
				}}
			/>
		</Screen>
	);
}

// "Taksit ödedim kaydet" (design 28): the next installment's amount, from an account (ADR-056).
export function LoanPaymentScreen({ id }: { id: string }) {
	const detail = useLoan(id);
	const accounts = useAccounts();
	if (detail.isPending || accounts.isPending) {
		return (
			<Screen testID="loanPay.screen" edges={["bottom"]}>
				<LoadingState rows={3} testID="loanPay.loading" />
			</Screen>
		);
	}
	if (detail.isError || accounts.isError) {
		return (
			<Screen testID="loanPay.screen" edges={["bottom"]}>
				<ErrorState
					message={messageForError(detail.error ?? accounts.error)}
					onRetry={() => {
						void detail.refetch();
						void accounts.refetch();
					}}
					testID="loanPay.error"
				/>
			</Screen>
		);
	}
	return <Form loan={detail.data.loan} accounts={accounts.data.accounts} />;
}

const styles = StyleSheet.create({
	source: {
		flexDirection: "row",
		alignItems: "center",
		borderWidth: 1,
		paddingHorizontal: 16,
		paddingVertical: 12,
		minHeight: 60,
	},
	kv: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		gap: 12,
	},
});
