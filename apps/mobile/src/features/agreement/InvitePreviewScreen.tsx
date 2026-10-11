import { formatDateTR, formatTRY } from "@paramnet/shared";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useAgreement } from "@/api/hooks";
import type { AgreementDetail } from "@/api/types";
import { AmountText } from "@/components/AmountText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { SectionHeader } from "@/components/SectionHeader";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useSession } from "@/features/auth/sessionStore";
import { installmentPosition } from "@/features/agreements/DueItemRow";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

type Step = "before" | "after";

function Detail({ agreement }: { agreement: AgreementDetail }) {
	const { colors, typography, spacing } = useAppTheme();
	// The invitee holds the opposite role of the creator.
	const theirRole = agreement.my_role === "creditor" ? tr.agreement.youOwe : tr.agreement.owesYou;
	return (
		<View testID="invitePreview.detail" style={{ gap: spacing.lg }}>
			<Card>
				<Text style={[typography.headline, { color: colors.text }]}>{agreement.title}</Text>
				<Text style={[typography.callout, { color: colors.textMuted }]}>{theirRole}</Text>
				<View style={styles.row}>
					<Text style={[typography.callout, { color: colors.textMuted }]}>
						{tr.plan.total}
					</Text>
					<AmountText minor={agreement.principal_minor} variant="headline" />
				</View>
				{agreement.down_payment_minor > 0 ? (
					<View style={styles.row}>
						<Text style={[typography.callout, { color: colors.textMuted }]}>
							{tr.plan.downPayment}
						</Text>
						<AmountText minor={agreement.down_payment_minor} variant="headline" />
					</View>
				) : null}
			</Card>
			<View style={{ gap: spacing.xs }}>
				<SectionHeader>{tr.invitePreview.plan}</SectionHeader>
				{agreement.installments.map((row) => (
					<View key={row.seq} style={styles.row}>
						<Text style={[typography.body, { color: colors.text }]}>
							{row.due_date === null
								? tr.installment.noDueDate
								: formatDateTR(row.due_date, "short")}{" "}
							· {installmentPosition(row.seq, agreement.installment_count)}
						</Text>
						<Text
							style={[
								typography.body,
								{ color: colors.text, fontVariant: ["tabular-nums"] },
							]}
						>
							{formatTRY(row.amount_minor)}
						</Text>
					</View>
				))}
			</View>
			<Button
				label={tr.invite.accept}
				disabled
				onPress={() => undefined}
				testID="invitePreview.accept.button"
			/>
			<Button
				label={tr.invite.counter}
				variant="secondary"
				disabled
				onPress={() => undefined}
				testID="invitePreview.counter.button"
			/>
			<Button
				label={tr.invite.reject}
				variant="ghost"
				disabled
				onPress={() => undefined}
				testID="invitePreview.reject.button"
			/>
		</View>
	);
}

// W01 + W03 visual draft inside the app (F1-11), for user interviews; the real page is apps/web-confirm (F2-04).
export function InvitePreviewScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { colors, typography } = useAppTheme();
	const agreement = useAgreement(id);
	const myName = useSession((state) => state.user?.display_name ?? "");
	const [step, setStep] = useState<Step>("before");

	return (
		<Screen testID="invitePreview.screen" edges={["bottom"]}>
			<SegmentedControl
				label={tr.share.seeAsCounterparty}
				options={[
					{ value: "before", label: tr.invitePreview.before },
					{ value: "after", label: tr.invitePreview.after },
				]}
				value={step}
				onChange={setStep}
				testID="invitePreview.step"
			/>
			<ScreenTitle>{fill(tr.invite.title, { name: myName })}</ScreenTitle>
			{agreement.isPending ? (
				<LoadingState testID="invitePreview.loading" />
			) : agreement.isError ? (
				<ErrorState
					message={messageForError(agreement.error)}
					onRetry={() => {
						void agreement.refetch();
					}}
					testID="invitePreview.error"
				/>
			) : step === "before" ? (
				<>
					{/* Spec 5.4: before OTP only the sender's name is shown, never amounts. */}
					<Text style={[typography.body, { color: colors.textMuted }]}>
						{tr.invitePreview.preOtpBody}
					</Text>
					<Button
						label={tr.invitePreview.verify}
						onPress={() => {
							setStep("after");
						}}
						testID="invitePreview.verify.button"
					/>
				</>
			) : (
				<Detail agreement={agreement.data} />
			)}
			<Text style={[typography.caption, { color: colors.textMuted }]}>
				{tr.invitePreview.prototypeNote}
			</Text>
		</Screen>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
});
