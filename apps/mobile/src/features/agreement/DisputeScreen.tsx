import { formatDateTR, formatTRY } from "@paramnet/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useAgreement, useOpenDispute } from "@/api/hooks";
import type { AgreementDetail } from "@/api/types";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { SectionHeader } from "@/components/SectionHeader";
import { TextField } from "@/components/TextField";
import { fill, tr } from "@/i18n/tr";
import { useIsOnline } from "@/lib/network";
import { useAppTheme } from "@/theme/useAppTheme";

const REASON_MAX = 500;

function DisputeForm({ agreement }: { agreement: AgreementDetail }) {
	const { colors, typography, spacing } = useAppTheme();
	const online = useIsOnline();
	const open = useOpenDispute();
	const [reason, setReason] = useState("");
	// null: the whole agreement (spec 5.7).
	const [paymentId, setPaymentId] = useState<string | null>(null);
	const payments = agreement.payments.filter((p) => p.status !== "withdrawn");
	const trimmed = reason.trim();

	return (
		<Screen
			testID="dispute.screen"
			edges={["bottom"]}
			footer={
				<Button
					label={tr.dispute.send}
					disabled={trimmed === "" || !online}
					loading={open.isPending}
					onPress={() => {
						open.mutate(
							{
								id: agreement.id,
								reason: trimmed,
								paymentId,
								rowVersion: agreement.row_version,
							},
							{
								onSuccess: () => {
									router.back();
								},
							},
						);
					}}
					testID="dispute.send.button"
				/>
			}
		>
			<ScreenTitle>{tr.dispute.title}</ScreenTitle>
			<Text style={[typography.caption, { color: colors.textMuted }]}>
				{tr.dispute.helper}
			</Text>
			<View style={{ gap: spacing.xs }}>
				<SectionHeader>{tr.dispute.target}</SectionHeader>
				<Checkbox
					label={tr.dispute.targetAll}
					checked={paymentId === null}
					onChange={() => {
						setPaymentId(null);
					}}
					testID="dispute.target.all"
				/>
				{payments.map((payment) => (
					<Checkbox
						key={payment.id}
						label={fill(tr.dispute.targetPayment, {
							date: formatDateTR(payment.paid_on, "short"),
							amount: formatTRY(payment.amount_minor),
						})}
						checked={paymentId === payment.id}
						onChange={() => {
							setPaymentId(payment.id);
						}}
						testID={`dispute.target.${payment.id}`}
					/>
				))}
			</View>
			<TextField
				label={tr.dispute.reason}
				helper={tr.dispute.reasonHelper}
				value={reason}
				onChangeText={setReason}
				maxLength={REASON_MAX}
				multiline
				testID="dispute.reason.input"
			/>
			{open.isError ? (
				<Text
					accessibilityLiveRegion="polite"
					style={[typography.callout, { color: colors.overdue }]}
				>
					{messageForError(open.error)}
				</Text>
			) : null}
			{online ? null : (
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{tr.error.offline}
				</Text>
			)}
		</Screen>
	);
}

// S16: a reason is required; the dispute may point at one payment.
export function DisputeScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const agreement = useAgreement(id);
	if (agreement.isPending) {
		return (
			<Screen testID="dispute.screen" edges={["bottom"]}>
				<LoadingState testID="dispute.loading" />
			</Screen>
		);
	}
	if (agreement.isError) {
		return (
			<Screen testID="dispute.screen" edges={["bottom"]}>
				<ErrorState
					message={messageForError(agreement.error)}
					onRetry={() => {
						void agreement.refetch();
					}}
					testID="dispute.error"
				/>
			</Screen>
		);
	}
	return <DisputeForm agreement={agreement.data} />;
}
