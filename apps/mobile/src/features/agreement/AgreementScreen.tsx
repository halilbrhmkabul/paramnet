import { formatDateTR, formatTRY } from "@paramnet/shared";
import { router, useLocalSearchParams } from "expo-router";
import { RefreshControl, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useAgreement, useDecidePayment, useWithdrawPayment } from "@/api/hooks";
import type { AgreementDetail, InstallmentView, PaymentView } from "@/api/types";
import { AmountText } from "@/components/AmountText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { ListItem } from "@/components/ListItem";
import { LoadingState } from "@/components/LoadingState";
import { ProgressBar } from "@/components/ProgressBar";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { SectionHeader } from "@/components/SectionHeader";
import { AgreementStatusBadge, Badge, InstallmentStatusBadge } from "@/components/StatusBadge";
import { DisputeCancelActions } from "./DisputeCancelActions";
import { SharedStateActions } from "./SharedStateActions";
import { installmentPosition } from "@/features/agreements/DueItemRow";
import { fill, tr } from "@/i18n/tr";
import { useIsOnline } from "@/lib/network";
import { useAppTheme } from "@/theme/useAppTheme";

// Personal mode is the only writable state in Faz 1; shared states get their actions in Faz 2.
// BR-14: no new payments on closed or disputed agreements; amendment_pending keeps the old terms.
function canAddPayment(agreement: AgreementDetail): boolean {
	return ["personal", "active", "amendment_pending"].includes(agreement.status);
}

// screens.md: "Ödeme ekle" in personal mode; on a shared one the creditor received, the debtor paid.
export function paymentActionLabel(agreement: AgreementDetail): string {
	if (agreement.status === "personal") {
		return tr.agreement.addPayment;
	}
	return agreement.my_role === "creditor" ? tr.payment.received : tr.payment.made;
}

function InstallmentRow({ installment, count }: { installment: InstallmentView; count: number }) {
	const { colors, typography, spacing } = useAppTheme();
	const due =
		installment.due_date === null
			? tr.installment.noDueDate
			: formatDateTR(installment.due_date, "short");
	const paidLine =
		installment.paid_minor > 0 && installment.paid_minor < installment.amount_minor
			? fill(tr.agreement.paidSoFar, { amount: formatTRY(installment.paid_minor) })
			: undefined;
	return (
		<ListItem
			title={`${due} · ${installmentPosition(installment.seq, count)}`}
			subtitle={paidLine}
			right={
				<View style={{ alignItems: "flex-end", gap: spacing.xs }}>
					<Text
						style={[
							typography.headline,
							{ color: colors.text, fontVariant: ["tabular-nums"] },
						]}
					>
						{formatTRY(installment.amount_minor)}
					</Text>
					<InstallmentStatusBadge
						status={installment.state.status}
						partial={installment.state.partial}
					/>
				</View>
			}
			testID={`agreement.installment.${String(installment.seq)}.row`}
		/>
	);
}

function PaymentRow({
	payment,
	myRole,
}: {
	payment: PaymentView;
	myRole: AgreementDetail["my_role"];
}) {
	const { colors, typography, spacing } = useAppTheme();
	const online = useIsOnline();
	const decide = useDecidePayment();
	const withdraw = useWithdrawPayment();
	const reported = payment.status === "reported";
	const error = decide.error ?? withdraw.error;
	return (
		<View style={{ gap: spacing.xs }}>
			<ListItem
				title={`${formatDateTR(payment.paid_on, "short")} · ${tr.payment.kinds[payment.kind]}`}
				subtitle={[tr.payment.methods[payment.method], payment.note]
					.filter((part) => part !== null)
					.join(" · ")}
				right={
					<View style={{ alignItems: "flex-end", gap: spacing.xs }}>
						<AmountText minor={payment.amount_minor} variant="headline" />
						<Badge
							label={tr.payment.statuses[payment.status]}
							tone={payment.status === "confirmed" ? "success" : "pending"}
						/>
					</View>
				}
				testID={`agreement.payment.${payment.id}`}
			/>
			{/* spec 5.5: the creditor confirms or says "not received"; the reporter can take it back. */}
			{reported && payment.by_me ? (
				<Button
					label={tr.payment.withdraw}
					variant="ghost"
					disabled={!online}
					loading={withdraw.isPending}
					onPress={() => {
						withdraw.mutate(payment.id);
					}}
					testID={`agreement.payment.${payment.id}.withdraw`}
				/>
			) : null}
			{reported && !payment.by_me && myRole === "creditor" ? (
				<View style={styles.rowBetween}>
					<Button
						label={tr.payment.confirm}
						disabled={!online}
						loading={decide.isPending && decide.variables.decision === "confirm"}
						onPress={() => {
							decide.mutate({ paymentId: payment.id, decision: "confirm" });
						}}
						testID={`agreement.payment.${payment.id}.confirm`}
					/>
					<Button
						label={tr.payment.notReceived}
						variant="ghost"
						disabled={!online}
						onPress={() => {
							decide.mutate({ paymentId: payment.id, decision: "reject" });
						}}
						testID={`agreement.payment.${payment.id}.reject`}
					/>
				</View>
			) : null}
			{error === null ? null : (
				<Text style={[typography.callout, { color: colors.overdue }]}>
					{messageForError(error)}
				</Text>
			)}
		</View>
	);
}

function Detail({ agreement }: { agreement: AgreementDetail }) {
	const { colors, typography, spacing } = useAppTheme();
	const online = useIsOnline();
	const paid = agreement.principal_minor - agreement.outstanding_minor;
	const tone = agreement.my_role === "creditor" ? "receivable" : "payable";

	return (
		<>
			<Card testID="agreement.summary">
				<View style={styles.rowBetween}>
					<Text
						testID="agreement.counterparty.text"
						style={[typography.headline, { color: colors.text }]}
					>
						{agreement.counterparty.display_name}
					</Text>
					<AgreementStatusBadge
						status={agreement.status}
						testID="agreement.status.badge"
					/>
				</View>
				<ScreenTitle testID="agreement.title.text">{agreement.title}</ScreenTitle>
				<Text
					testID="agreement.role.text"
					style={[typography.callout, { color: colors.textMuted }]}
				>
					{agreement.my_role === "creditor" ? tr.agreement.owesYou : tr.agreement.youOwe}
				</Text>
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{tr.agreement.remaining}
				</Text>
				<AmountText
					minor={agreement.outstanding_minor}
					variant="amountXL"
					tone={tone}
					testID="agreement.outstanding.text"
				/>
				{agreement.reported_minor > 0 ? (
					<Text
						testID="agreement.awaiting.text"
						style={[typography.caption, { color: colors.pending }]}
					>
						{fill(tr.payment.awaiting, { amount: formatTRY(agreement.reported_minor) })}
					</Text>
				) : null}
				<ProgressBar
					value={agreement.principal_minor === 0 ? 0 : paid / agreement.principal_minor}
					label={fill(tr.agreement.paidOf, {
						paid: formatTRY(paid),
						amount: formatTRY(agreement.principal_minor),
					})}
					tone={tone}
					testID="agreement.progress"
				/>
				<View style={styles.rowBetween}>
					<Text style={[typography.caption, { color: colors.textMuted }]}>
						{tr.agreement.total}
					</Text>
					<AmountText
						minor={agreement.principal_minor}
						variant="callout"
						testID="agreement.total.text"
					/>
				</View>
				{agreement.started_on === null ? null : (
					<View style={styles.rowBetween}>
						<Text style={[typography.caption, { color: colors.textMuted }]}>
							{agreement.my_role === "creditor"
								? tr.new.startedOnLent
								: tr.new.startedOnBorrowed}
						</Text>
						<Text
							testID="agreement.startedOn.text"
							style={[typography.callout, { color: colors.text }]}
						>
							{formatDateTR(agreement.started_on, "long")}
						</Text>
					</View>
				)}
				{agreement.status === "personal" ? (
					<Text style={[typography.caption, { color: colors.textMuted }]}>
						{tr.agreement.personalBadge}
					</Text>
				) : null}
			</Card>

			{agreement.status === "settled" ? (
				<Card testID="agreement.settled">
					<Text style={[typography.headline, { color: colors.success }]}>
						{tr.settled.title}
					</Text>
				</Card>
			) : null}

			{canAddPayment(agreement) ? (
				<View style={{ gap: spacing.xs }}>
					<Button
						label={paymentActionLabel(agreement)}
						disabled={!online}
						onPress={() => {
							router.push({
								pathname: "/agreement/[id]/payment",
								params: { id: agreement.id },
							});
						}}
						testID="agreement.primaryAction.button"
					/>
					{online ? null : (
						<Text style={[typography.caption, { color: colors.textMuted }]}>
							{tr.error.offline}
						</Text>
					)}
					{agreement.status === "personal" ? (
						<Button
							label={tr.share.action}
							variant="secondary"
							onPress={() => {
								router.push({
									pathname: "/agreement/[id]/share",
									params: { id: agreement.id },
								});
							}}
							testID="agreement.share.button"
						/>
					) : null}
				</View>
			) : null}

			<SharedStateActions agreement={agreement} />
			<DisputeCancelActions agreement={agreement} />

			<View style={{ gap: spacing.xs }}>
				<SectionHeader>{tr.agreement.installments}</SectionHeader>
				{agreement.installments.map((installment) => (
					<InstallmentRow
						key={installment.seq}
						installment={installment}
						count={agreement.installment_count}
					/>
				))}
			</View>

			<View style={{ gap: spacing.xs }}>
				<SectionHeader>{tr.agreement.payments}</SectionHeader>
				{agreement.payments.length === 0 ? (
					<Text style={[typography.body, { color: colors.textMuted }]}>
						{tr.agreement.noPayments}
					</Text>
				) : (
					agreement.payments.map((payment) => (
						<PaymentRow key={payment.id} payment={payment} myRole={agreement.my_role} />
					))
				)}
			</View>

			<Button
				label={tr.agreement.history}
				variant="ghost"
				onPress={() => {
					router.push({
						pathname: "/agreement/[id]/history",
						params: { id: agreement.id },
					});
				}}
				testID="agreement.history.button"
			/>
		</>
	);
}

// S11
export function AgreementScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const agreement = useAgreement(id);

	return (
		<Screen
			testID="agreement.screen"
			edges={["bottom"]}
			refreshControl={
				<RefreshControl
					refreshing={agreement.isRefetching}
					onRefresh={() => {
						void agreement.refetch();
					}}
				/>
			}
		>
			{agreement.isPending ? (
				<LoadingState testID="agreement.loading" />
			) : agreement.isError ? (
				<ErrorState
					message={messageForError(agreement.error)}
					onRetry={() => {
						void agreement.refetch();
					}}
					testID="agreement.error"
				/>
			) : (
				<Detail agreement={agreement.data} />
			)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	rowBetween: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		gap: 8,
	},
});
