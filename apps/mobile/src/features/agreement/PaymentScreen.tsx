import { allocatePayment, formatTRY, type IsoDate, type PaymentMethod } from "@paramnet/shared";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { paymentActionLabel } from "./AgreementScreen";
import { messageForError } from "@/api/errors";
import { useAgreement, useRecordPayment } from "@/api/hooks";
import type { AgreementDetail } from "@/api/types";
import { AmountInput } from "@/components/AmountInput";
import { AmountText } from "@/components/AmountText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DateField } from "@/components/DateField";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TextField } from "@/components/TextField";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { newIdempotencyKey } from "@/lib/ids";
import { useIsOnline } from "@/lib/network";
import { useAppTheme } from "@/theme/useAppTheme";

const METHODS: { value: PaymentMethod; label: string }[] = [
	{ value: "cash", label: tr.payment.methods.cash },
	{ value: "transfer", label: tr.payment.methods.transfer },
	{ value: "card", label: tr.payment.methods.card },
	{ value: "other", label: tr.payment.methods.other },
];

// Design 11 / 14: what happened, the balance now, and one way back.
function PaymentResult({
	agreement,
	reported,
	amount,
	remaining,
}: {
	agreement: AgreementDetail;
	reported: boolean;
	amount: number;
	remaining: number;
}) {
	const { colors, typography, spacing } = useAppTheme();
	return (
		<Screen
			testID="payment.result"
			edges={["bottom"]}
			footer={
				<Button
					label={tr.payment.done}
					onPress={() => {
						router.back();
					}}
					testID="payment.done.button"
				/>
			}
		>
			<View style={[styles.result, { gap: spacing.sm }]}>
				<View
					style={[
						styles.ring,
						{ backgroundColor: reported ? colors.warningSoft : colors.primarySoft },
					]}
				>
					<View
						style={[
							styles.core,
							{ backgroundColor: reported ? colors.warning : colors.accent },
						]}
					>
						<Ionicons
							name={reported ? "time-outline" : "checkmark"}
							size={30}
							color={colors.onPrimary}
						/>
					</View>
				</View>
				<Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
					{reported ? tr.payment.reportedTitle : tr.payment.savedTitle}
				</Text>
				<AmountText minor={amount} variant="amountXL" tone="primary" />
				{reported ? (
					<Text
						style={[typography.callout, styles.centerText, { color: colors.textMuted }]}
					>
						{fill(tr.payment.reportedBody, {
							name: agreement.counterparty.display_name,
						})}
					</Text>
				) : null}
			</View>
			<Card>
				<View style={styles.rowBetween}>
					<Text style={[typography.callout, { color: colors.textMuted }]}>
						{tr.payment.remainingNow}
					</Text>
					<AmountText
						minor={remaining}
						variant="rowTitle"
						testID="payment.result.remaining"
					/>
				</View>
			</Card>
		</Screen>
	);
}

function PaymentForm({
	agreement,
	initialAmount,
}: {
	agreement: AgreementDetail;
	initialAmount: number | null;
}) {
	const { colors, typography, spacing } = useAppTheme();
	const today = useToday();
	const online = useIsOnline();
	const record = useRecordPayment(agreement.id);
	// One key per screen visit: a retry after a network error must not record twice (BR-09).
	const [idempotencyKey] = useState(newIdempotencyKey);
	const [amount, setAmount] = useState<number | null>(initialAmount);
	const [paidOn, setPaidOn] = useState<IsoDate>(today);
	const [method, setMethod] = useState<PaymentMethod>("cash");
	const [note, setNote] = useState("");
	const [result, setResult] = useState<{
		reported: boolean;
		amount: number;
		remaining: number;
	} | null>(null);
	// The debtor of a shared agreement reports; everyone else records at once (BR-08).
	const reports = agreement.status !== "personal" && agreement.my_role === "debtor";
	const next = agreement.installments.find((row) => row.state.status !== "paid");
	const shortcuts = [
		...(next === undefined
			? []
			: [
					{
						key: "next",
						label: tr.payment.chipNext,
						minor: next.amount_minor - next.paid_minor,
					},
				]),
		{ key: "all", label: tr.payment.chipAll, minor: agreement.outstanding_minor },
	];

	const allocation =
		amount === null || amount === 0 ? null : allocatePayment(agreement.installments, amount);
	const amountError =
		allocation !== null && !allocation.ok && allocation.error === "amount_exceeds_outstanding"
			? tr.error.exceedsOutstanding
			: undefined;
	const dateError = paidOn > today ? tr.payment.futureDate : undefined;
	const canSave = allocation?.ok === true && dateError === undefined && online;

	if (result !== null) {
		return <PaymentResult agreement={agreement} {...result} />;
	}

	return (
		<Screen
			testID="payment.screen"
			edges={["bottom"]}
			footer={
				<Button
					label={tr.payment.save}
					disabled={!canSave}
					loading={record.isPending}
					onPress={() => {
						if (amount === null) {
							return;
						}
						record.mutate(
							{
								input: {
									amount_minor: amount,
									paid_on: paidOn,
									method,
									note: note.trim() === "" ? null : note.trim(),
								},
								rowVersion: agreement.row_version,
								idempotencyKey,
							},
							{
								onSuccess: () => {
									setResult({
										reported: reports,
										amount,
										remaining: reports
											? agreement.outstanding_minor
											: agreement.outstanding_minor - amount,
									});
								},
							},
						);
					}}
					testID="payment.save.button"
				/>
			}
		>
			<ScreenTitle>
				{agreement.status === "personal" ? tr.payment.title : paymentActionLabel(agreement)}
			</ScreenTitle>
			{agreement.status !== "personal" && agreement.my_role === "debtor" ? (
				<Text
					testID="payment.reportHelper"
					style={[typography.caption, { color: colors.textMuted }]}
				>
					{tr.payment.reportHelper}
				</Text>
			) : null}
			<Text style={[typography.callout, { color: colors.textMuted }]}>
				{fill(tr.payment.remaining, { amount: formatTRY(agreement.outstanding_minor) })}
			</Text>
			<AmountInput
				label={tr.payment.amount}
				value={amount}
				onChangeValue={setAmount}
				error={amountError}
				testID="payment.amount.input"
			/>
			<View style={[styles.chips, { gap: spacing.sm }]}>
				{shortcuts.map((chip) => (
					<Pressable
						key={chip.key}
						testID={`payment.chip.${chip.key}`}
						accessibilityRole="button"
						accessibilityLabel={`${chip.label} ${formatTRY(chip.minor)}`}
						accessibilityState={{ selected: amount === chip.minor }}
						onPress={() => {
							setAmount(chip.minor);
						}}
						style={[
							styles.chip,
							{
								borderColor:
									amount === chip.minor ? colors.primary : colors.borderStrong,
								backgroundColor:
									amount === chip.minor ? colors.primarySoft : colors.surface,
							},
						]}
					>
						<Text style={[typography.label, { color: colors.text }]}>{chip.label}</Text>
						<Text style={[typography.caption, { color: colors.textMuted }]}>
							{formatTRY(chip.minor)}
						</Text>
					</Pressable>
				))}
			</View>
			<View style={styles.rowBetween}>
				<Text style={[typography.callout, { color: colors.textMuted }]}>
					{tr.payment.after}
				</Text>
				<AmountText
					minor={Math.max(agreement.outstanding_minor - (amount ?? 0), 0)}
					variant="rowTitle"
					testID="payment.after"
				/>
			</View>
			{allocation?.ok === true ? (
				<Card testID="payment.allocation.list">
					<Text style={[typography.callout, { color: colors.textMuted }]}>
						{tr.payment.allocation}
					</Text>
					{allocation.allocations.map(({ seq, amount_minor }) => {
						const row = agreement.installments.find((i) => i.seq === seq);
						const completes =
							row !== undefined && row.paid_minor + amount_minor === row.amount_minor;
						return (
							<View
								key={seq}
								testID={`payment.allocation.${String(seq)}`}
								style={styles.row}
							>
								<Text style={[typography.body, { color: colors.text }]}>
									{fill(tr.plan.row, { seq: String(seq) })}
									{completes ? ` · ${tr.payment.completes}` : ""}
								</Text>
								<Text
									style={[
										typography.body,
										{ color: colors.text, fontVariant: ["tabular-nums"] },
									]}
								>
									{formatTRY(amount_minor)}
								</Text>
							</View>
						);
					})}
				</Card>
			) : null}
			<DateField
				label={tr.payment.paidOn}
				value={paidOn}
				onChange={setPaidOn}
				defaultPickerDate={today}
				error={dateError}
				testID="payment.paidOn"
			/>
			<SegmentedControl
				label={tr.payment.method}
				options={METHODS}
				value={method}
				onChange={setMethod}
				testID="payment.method"
			/>
			<TextField
				label={tr.payment.note}
				value={note}
				onChangeText={setNote}
				multiline
				testID="payment.note.input"
			/>
			{online ? null : (
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{tr.error.offline}
				</Text>
			)}
			{record.isError ? (
				<Text
					accessibilityLiveRegion="polite"
					style={[typography.callout, { color: colors.overdue, gap: spacing.xs }]}
				>
					{messageForError(record.error)}
				</Text>
			) : null}
		</Screen>
	);
}

// S12
// `amount` (kuruş): design 25 "Ödendi kaydet" opens with the next installment's remainder filled in.
export function PaymentScreen() {
	const { id, amount } = useLocalSearchParams<{ id: string; amount?: string }>();
	const initialAmount = amount !== undefined && /^\d+$/.test(amount) ? Number(amount) : null;
	const agreement = useAgreement(id);
	if (agreement.isPending) {
		return (
			<Screen testID="payment.screen" edges={["bottom"]}>
				<LoadingState testID="payment.loading" />
			</Screen>
		);
	}
	if (agreement.isError) {
		return (
			<Screen testID="payment.screen" edges={["bottom"]}>
				<ErrorState
					message={messageForError(agreement.error)}
					onRetry={() => {
						void agreement.refetch();
					}}
					testID="payment.error"
				/>
			</Screen>
		);
	}
	return <PaymentForm agreement={agreement.data} initialAmount={initialAmount} />;
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		justifyContent: "space-between",
	},
	rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	chips: { flexDirection: "row", flexWrap: "wrap" },
	chip: {
		borderWidth: 1,
		borderRadius: 14,
		paddingHorizontal: 14,
		paddingVertical: 8,
		minHeight: 44,
	},
	result: { alignItems: "center", paddingTop: 40 },
	ring: {
		width: 88,
		height: 88,
		borderRadius: 44,
		alignItems: "center",
		justifyContent: "center",
	},
	core: {
		width: 60,
		height: 60,
		borderRadius: 30,
		alignItems: "center",
		justifyContent: "center",
	},
	centerText: { textAlign: "center" },
});
