import {
	addMonthsClamped,
	annuityPayment,
	formatDateTR,
	formatTRY,
	loanInputSchema,
	loanSchedule,
	loanSummary,
	parseRateBps,
	type IsoDate,
} from "@paramnet/shared";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useAccounts, useArchiveLoan, useCreateLoan, useLoans, useUpdateLoan } from "@/api/hooks";
import type { Account, Loan } from "@/api/types";
import { AmountInput } from "@/components/AmountInput";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { DateField } from "@/components/DateField";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { AccountPickerSheet } from "@/features/cash/AccountPickerSheet";
import { ConfirmSheet } from "@/features/cash/parts";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { newIdempotencyKey } from "@/lib/ids";
import { useAppTheme } from "@/theme/useAppTheme";

const TERMS = [12, 24, 36, 48] as const;

const FIELD_ERRORS: Partial<Record<string, string>> = {
	bank_name: tr.loanForm.bankRequired,
	loan_type: tr.loanForm.typeRequired,
	principal_minor: tr.loanForm.principalRequired,
	monthly_rate_bps: tr.loanForm.rateInvalid,
	term_months: tr.loanForm.termInvalid,
};

function rateText(bps: number): string {
	return `${String(Math.floor(bps / 100))},${String(bps % 100).padStart(2, "0")}`;
}

function Form({ loan, accounts }: { loan: Loan | null; accounts: readonly Account[] }) {
	const { colors, typography, fonts, spacing, radius } = useAppTheme();
	const today = useToday();
	const [bank, setBank] = useState(loan?.bank_name ?? "");
	const [type, setType] = useState(loan?.loan_type ?? "");
	const [principal, setPrincipal] = useState<number | null>(loan?.principal_minor ?? null);
	const [rate, setRate] = useState(loan === null ? "" : rateText(loan.monthly_rate_bps));
	const [term, setTerm] = useState(String(loan?.term_months ?? 24));
	const [firstDue, setFirstDue] = useState<IsoDate>(
		loan?.first_due_on ?? addMonthsClamped(today, 1),
	);
	// Only a figure that differs from ours is the bank's own; otherwise the computed one is used.
	const [bankInstallment, setBankInstallment] = useState<number | null>(() =>
		loan === null ||
		loan.installment_minor ===
			annuityPayment(loan.principal_minor, loan.monthly_rate_bps, loan.term_months)
			? null
			: loan.installment_minor,
	);
	const [accountId, setAccountId] = useState<string | null>(loan?.payment_account_id ?? null);
	const [picking, setPicking] = useState(false);
	const [archiveOpen, setArchiveOpen] = useState(false);
	const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
	const key = useRef(newIdempotencyKey());
	const create = useCreateLoan();
	const update = useUpdateLoan();
	const archive = useArchiveLoan();
	const serverError = create.error ?? update.error ?? archive.error;

	const bps = parseRateBps(rate);
	const months = Number(term);
	const ready =
		principal !== null && principal > 0 && bps !== null && months >= 1 && months <= 120;
	const computed = ready ? annuityPayment(principal, bps, months) : null;
	const installment = bankInstallment ?? computed;
	const summary =
		ready && installment !== null
			? loanSummary(loanSchedule(principal, bps, months, firstDue, installment), principal, 0)
			: null;

	function submit() {
		const parsed = loanInputSchema.safeParse({
			bank_name: bank,
			loan_type: type,
			principal_minor: principal ?? 0,
			monthly_rate_bps: bps ?? -1,
			term_months: months,
			first_due_on: firstDue,
			installment_minor: installment ?? 0,
			payment_account_id: accountId,
		});
		if (!parsed.success) {
			const next: Partial<Record<string, string>> = {};
			for (const issue of parsed.error.issues) {
				const field = String(issue.path[0]);
				next[field] = next[field] ?? FIELD_ERRORS[field] ?? tr.error.validation;
			}
			setErrors(next);
			return;
		}
		setErrors({});
		const done = () => {
			router.back();
		};
		if (loan === null) {
			create.mutate({ input: parsed.data, idempotencyKey: key.current }, { onSuccess: done });
		} else {
			update.mutate(
				{ id: loan.id, input: parsed.data, rowVersion: loan.row_version },
				{ onSuccess: done },
			);
		}
	}

	const kv = (label: string, value: string, testID: string) => (
		<View style={[styles.kv, { borderTopColor: colors.loanTrack }]}>
			<Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.loanMuted }}>
				{label}
			</Text>
			<Text
				testID={testID}
				style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.onCard }}
			>
				{value}
			</Text>
		</View>
	);

	return (
		<Screen
			testID="loanForm.screen"
			edges={["bottom"]}
			footer={
				<View style={{ gap: spacing.sm }}>
					{serverError === null ? null : (
						<Text
							accessibilityLiveRegion="polite"
							style={[typography.caption, { color: colors.overdue }]}
						>
							{messageForError(serverError)}
						</Text>
					)}
					<Button
						label={loan === null ? tr.loanForm.submitNew : tr.loanForm.submitEdit}
						loading={create.isPending || update.isPending}
						onPress={submit}
						testID="loanForm.submit.button"
					/>
				</View>
			}
		>
			<View style={[styles.row, { gap: 10 }]}>
				<View style={styles.grow}>
					<TextField
						label={tr.loanForm.bank}
						value={bank}
						onChangeText={setBank}
						placeholder={tr.loanForm.bankPlaceholder}
						maxLength={40}
						error={errors.bank_name}
						testID="loanForm.bank.input"
					/>
				</View>
				<View style={styles.grow}>
					<TextField
						label={tr.loanForm.type}
						value={type}
						onChangeText={setType}
						placeholder={tr.loanForm.typePlaceholder}
						maxLength={40}
						error={errors.loan_type}
						testID="loanForm.type.input"
					/>
				</View>
			</View>
			<AmountInput
				label={tr.loanForm.principal}
				value={principal}
				onChangeValue={setPrincipal}
				error={errors.principal_minor}
				testID="loanForm.principal.input"
			/>
			<View style={[styles.row, { gap: 10 }]}>
				<View style={styles.grow}>
					<TextField
						label={tr.loanForm.rate}
						value={rate}
						onChangeText={setRate}
						placeholder={tr.loanForm.ratePlaceholder}
						keyboardType="decimal-pad"
						error={errors.monthly_rate_bps}
						testID="loanForm.rate.input"
					/>
				</View>
				<View style={styles.grow}>
					<DateField
						label={tr.loanForm.firstDue}
						value={firstDue}
						onChange={setFirstDue}
						defaultPickerDate={today}
						testID="loanForm.firstDue"
					/>
				</View>
			</View>
			<View style={{ gap: spacing.xs }}>
				<Text style={[typography.label, { color: colors.textMuted }]}>
					{tr.loanForm.term}
				</Text>
				<View accessibilityRole="radiogroup" style={[styles.row, { gap: spacing.sm }]}>
					{TERMS.map((n) => (
						<View key={n} style={styles.grow}>
							<Chip
								label={fill(tr.loanForm.termValue, { count: String(n) })}
								selected={term === String(n)}
								role="radio"
								onPress={() => {
									setTerm(String(n));
								}}
								testID={`loanForm.term.${String(n)}`}
							/>
						</View>
					))}
				</View>
				<TextField
					label={tr.loanForm.termOther}
					value={term}
					onChangeText={(text) => {
						setTerm(text.replace(/\D/g, "").slice(0, 3));
					}}
					keyboardType="number-pad"
					error={errors.term_months}
					testID="loanForm.term.input"
				/>
			</View>
			<View
				testID="loanForm.preview"
				style={[
					styles.preview,
					{ backgroundColor: colors.loanBg, borderRadius: radius.xl },
				]}
			>
				<Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.loanMuted }}>
					{tr.loanForm.computed}
				</Text>
				<Text
					testID="loanForm.computed"
					style={{
						fontFamily: fonts.extrabold,
						fontSize: 30,
						letterSpacing: -0.6,
						color: colors.onCard,
					}}
				>
					{computed === null ? "—" : formatTRY(computed)}
				</Text>
				{summary === null ? null : (
					<View style={{ marginTop: 10 }}>
						{kv(
							tr.loanForm.total,
							formatTRY(summary.total_payment_minor),
							"loanForm.total",
						)}
						{kv(
							tr.loanForm.interest,
							formatTRY(summary.total_interest_minor),
							"loanForm.interest",
						)}
						{kv(
							tr.loanForm.last,
							summary.last_due === null
								? "—"
								: formatDateTR(summary.last_due, "short"),
							"loanForm.last",
						)}
					</View>
				)}
			</View>
			<AmountInput
				label={tr.loanForm.installment}
				value={bankInstallment}
				onChangeValue={setBankInstallment}
				helper={tr.loanForm.installmentHint}
				testID="loanForm.installment.input"
			/>
			<Pressable
				testID="loanForm.account.button"
				accessibilityRole="button"
				accessibilityLabel={tr.loanForm.account}
				onPress={() => {
					setPicking(true);
				}}
				style={[
					styles.meta,
					{
						borderRadius: radius.sm,
						backgroundColor: colors.surface,
						borderColor: colors.border,
					},
				]}
			>
				<Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.textMuted }}>
					{tr.loanForm.account}
				</Text>
				<Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.text }}>
					{accounts.find((a) => a.id === accountId)?.name ?? tr.loans.noAccount}
				</Text>
			</Pressable>
			{loan === null ? null : (
				<>
					<Button
						label={tr.loanForm.archive}
						variant="ghost"
						onPress={() => {
							setArchiveOpen(true);
						}}
						testID="loanForm.archive.button"
					/>
					<ConfirmSheet
						visible={archiveOpen}
						title={tr.loanForm.archiveTitle}
						body={fill(tr.loanForm.archiveBody, {
							name: `${loan.bank_name} ${loan.loan_type}`,
						})}
						confirmLabel={tr.loanForm.archiveConfirm}
						busy={archive.isPending}
						onCancel={() => {
							setArchiveOpen(false);
						}}
						onConfirm={() => {
							archive.mutate(
								{ id: loan.id, rowVersion: loan.row_version },
								{
									onSuccess: () => {
										setArchiveOpen(false);
										router.dismissAll();
										router.navigate("/loans");
									},
									onError: () => {
										setArchiveOpen(false);
									},
								},
							);
						}}
						testID="loanForm.archive.sheet"
					/>
				</>
			)}
			<AccountPickerSheet
				visible={picking}
				title={tr.loanForm.account}
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

// Design 34 and its edit mode.
export function LoanFormScreen({ id }: { id: string | null }) {
	const loans = useLoans();
	const accounts = useAccounts();
	if (accounts.isPending || (id !== null && loans.isPending)) {
		return (
			<Screen testID="loanForm.screen" edges={["bottom"]}>
				<LoadingState rows={4} testID="loanForm.loading" />
			</Screen>
		);
	}
	const loan = id === null ? null : (loans.data?.loans.find((l) => l.id === id) ?? null);
	if (accounts.isError || (id !== null && loan === null)) {
		return (
			<Screen testID="loanForm.screen" edges={["bottom"]}>
				<ErrorState
					message={accounts.isError ? messageForError(accounts.error) : tr.error.notFound}
					onRetry={() => {
						void accounts.refetch();
						void loans.refetch();
					}}
					testID="loanForm.error"
				/>
			</Screen>
		);
	}
	return <Form loan={loan} accounts={accounts.data.accounts} />;
}

const styles = StyleSheet.create({
	grow: { flex: 1 },
	row: { flexDirection: "row" },
	preview: { paddingHorizontal: 20, paddingVertical: 18 },
	kv: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 10,
		borderTopWidth: 1,
	},
	meta: { minHeight: 52, borderWidth: 1, paddingHorizontal: 14, justifyContent: "center" },
});
