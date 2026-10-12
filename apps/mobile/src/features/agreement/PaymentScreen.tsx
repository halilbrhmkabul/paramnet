import { allocatePayment, formatTRY, type IsoDate, type PaymentMethod } from "@paramnet/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { paymentActionLabel } from "./AgreementScreen";
import { messageForError } from "@/api/errors";
import { useAgreement, useRecordPayment } from "@/api/hooks";
import type { AgreementDetail } from "@/api/types";
import { AmountInput } from "@/components/AmountInput";
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

function PaymentForm({ agreement }: { agreement: AgreementDetail }) {
	const { colors, typography, spacing } = useAppTheme();
	const today = useToday();
	const online = useIsOnline();
	const record = useRecordPayment(agreement.id);
	// One key per screen visit: a retry after a network error must not record twice (BR-09).
	const [idempotencyKey] = useState(newIdempotencyKey);
	const [amount, setAmount] = useState<number | null>(null);
	const [paidOn, setPaidOn] = useState<IsoDate>(today);
	const [method, setMethod] = useState<PaymentMethod>("cash");
	const [note, setNote] = useState("");

	const allocation =
		amount === null || amount === 0 ? null : allocatePayment(agreement.installments, amount);
	const amountError =
		allocation !== null && !allocation.ok && allocation.error === "amount_exceeds_outstanding"
			? tr.error.exceedsOutstanding
			: undefined;
	const dateError = paidOn > today ? tr.payment.futureDate : undefined;
	const canSave = allocation?.ok === true && dateError === undefined && online;

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
									router.back();
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
export function PaymentScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
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
	return <PaymentForm agreement={agreement.data} />;
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		justifyContent: "space-between",
	},
});
