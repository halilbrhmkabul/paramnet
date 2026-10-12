import { formatTRY } from "@paramnet/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import {
	useDecideCancel,
	useForgiveRemaining,
	useRequestCancel,
	useResolveDispute,
} from "@/api/hooks";
import type { AgreementDetail } from "@/api/types";
import { AmountInput } from "@/components/AmountInput";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { fill, tr } from "@/i18n/tr";
import { newIdempotencyKey } from "@/lib/ids";
import { useIsOnline } from "@/lib/network";
import { useAppTheme } from "@/theme/useAppTheme";

const SHARED_OPEN = ["active", "amendment_pending", "disputed"];

// The creditor's discount; the debtor is only informed, so there is no request to wait for (spec 5.6).
function ForgiveForm({ agreement, onDone }: { agreement: AgreementDetail; onDone: () => void }) {
	const { colors, typography } = useAppTheme();
	const online = useIsOnline();
	const forgive = useForgiveRemaining();
	const [amount, setAmount] = useState<number | null>(agreement.outstanding_minor);
	const [idempotencyKey] = useState(newIdempotencyKey);
	const invalid = amount === null || amount <= 0 || amount > agreement.outstanding_minor;
	return (
		<Card testID="forgive.form">
			<AmountInput
				label={tr.forgive.amount}
				value={amount}
				onChangeValue={setAmount}
				helper={tr.forgive.helper}
				error={
					amount !== null && amount > agreement.outstanding_minor
						? tr.error.exceedsOutstanding
						: undefined
				}
				testID="forgive.amount.input"
			/>
			{forgive.isError ? (
				<Text style={[typography.callout, { color: colors.overdue }]}>
					{messageForError(forgive.error)}
				</Text>
			) : null}
			<Button
				label={tr.forgive.save}
				disabled={invalid || !online}
				loading={forgive.isPending}
				onPress={() => {
					if (amount === null) {
						return;
					}
					forgive.mutate(
						{
							id: agreement.id,
							// "Everything that is left" stays exact even if a payment lands meanwhile.
							amountMinor: amount === agreement.outstanding_minor ? null : amount,
							rowVersion: agreement.row_version,
							idempotencyKey,
						},
						{ onSuccess: onDone },
					);
				}}
				testID="forgive.save.button"
			/>
			<Button
				label={tr.common.cancel}
				variant="ghost"
				onPress={onDone}
				testID="forgive.cancel.button"
			/>
		</Card>
	);
}

// S16 and spec 5.8: an open dispute, a request to cancel together, and the creditor's discount.
export function DisputeCancelActions({ agreement }: { agreement: AgreementDetail }) {
	const { colors, typography, spacing } = useAppTheme();
	const online = useIsOnline();
	const resolve = useResolveDispute();
	const requestCancel = useRequestCancel();
	const decideCancel = useDecideCancel();
	const [forgiving, setForgiving] = useState(false);
	const name = agreement.counterparty.display_name;
	const shared = SHARED_OPEN.includes(agreement.status);
	const canForgive =
		agreement.my_role === "creditor" &&
		agreement.outstanding_minor > 0 &&
		["personal", "active", "amendment_pending"].includes(agreement.status);
	const disputedPayment =
		agreement.dispute?.payment_id == null
			? undefined
			: agreement.payments.find((p) => p.id === agreement.dispute?.payment_id);
	const error = resolve.error ?? requestCancel.error ?? decideCancel.error;

	if (!shared && !canForgive) {
		return null;
	}
	return (
		<View style={{ gap: spacing.xs }}>
			{agreement.dispute === null ? null : (
				<Card testID="agreement.dispute.card">
					<Text style={[typography.headline, { color: colors.warning }]}>
						{agreement.dispute.by_me
							? tr.dispute.openedByMe
							: fill(tr.dispute.openedByOther, { name })}
					</Text>
					<Text style={[typography.body, { color: colors.text }]}>
						{agreement.dispute.reason}
					</Text>
					{disputedPayment === undefined ? null : (
						<Text style={[typography.caption, { color: colors.textMuted }]}>
							{fill(tr.dispute.aboutPayment, {
								amount: formatTRY(disputedPayment.amount_minor),
							})}
						</Text>
					)}
					{agreement.dispute.by_me ? (
						<Button
							label={tr.dispute.withdraw}
							variant="secondary"
							disabled={!online}
							loading={resolve.isPending}
							onPress={() => {
								resolve.mutate(agreement.id);
							}}
							testID="agreement.resolveDispute.button"
						/>
					) : null}
				</Card>
			)}

			{agreement.cancel_request === null ? null : agreement.cancel_request.by_me ? (
				<Text
					testID="agreement.cancel.text"
					style={[typography.callout, { color: colors.textMuted }]}
				>
					{tr.cancel.waiting}
				</Text>
			) : (
				<Card>
					<Text
						testID="agreement.cancel.text"
						style={[typography.body, { color: colors.text }]}
					>
						{fill(tr.cancel.requestedByOther, { name })}
					</Text>
					<Button
						label={tr.cancel.accept}
						disabled={!online}
						loading={
							decideCancel.isPending && decideCancel.variables.decision === "accept"
						}
						onPress={() => {
							decideCancel.mutate({ id: agreement.id, decision: "accept" });
						}}
						testID="agreement.acceptCancel.button"
					/>
					<Button
						label={tr.cancel.reject}
						variant="ghost"
						disabled={!online}
						loading={
							decideCancel.isPending && decideCancel.variables.decision === "reject"
						}
						onPress={() => {
							decideCancel.mutate({ id: agreement.id, decision: "reject" });
						}}
						testID="agreement.rejectCancel.button"
					/>
				</Card>
			)}

			{canForgive ? (
				forgiving ? (
					<ForgiveForm
						agreement={agreement}
						onDone={() => {
							setForgiving(false);
						}}
					/>
				) : (
					<Button
						label={tr.forgive.action}
						variant="ghost"
						disabled={!online}
						onPress={() => {
							setForgiving(true);
						}}
						testID="agreement.forgive.button"
					/>
				)
			) : null}

			{/* BR-14: one dispute at a time, and none on a closed agreement. */}
			{agreement.status === "active" || agreement.status === "amendment_pending" ? (
				<Button
					label={tr.agreementActions.openDispute}
					variant="ghost"
					disabled={!online}
					onPress={() => {
						router.push({
							pathname: "/agreement/[id]/dispute",
							params: { id: agreement.id },
						});
					}}
					testID="agreement.dispute.button"
				/>
			) : null}
			{shared && agreement.cancel_request === null ? (
				<Button
					label={tr.cancel.request}
					variant="ghost"
					disabled={!online}
					loading={requestCancel.isPending}
					onPress={() => {
						requestCancel.mutate({
							id: agreement.id,
							rowVersion: agreement.row_version,
						});
					}}
					testID="agreement.requestCancel.button"
				/>
			) : null}
			{error === null ? null : (
				<Text style={[typography.callout, { color: colors.overdue }]}>
					{messageForError(error)}
				</Text>
			)}
		</View>
	);
}
