import { formatDateTimeTR, formatDateTR, formatTRY } from "@paramnet/shared";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { RefreshControl, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useAgreement, useDecidePayment, useWithdrawPayment } from "@/api/hooks";
import type { AgreementDetail, InstallmentView, PaymentView } from "@/api/types";
import { AmountText } from "@/components/AmountText";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { ListItem } from "@/components/ListItem";
import { LoadingState } from "@/components/LoadingState";
import { ProgressBar } from "@/components/ProgressBar";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { AgreementStatusBadge, Badge, InstallmentStatusBadge } from "@/components/StatusBadge";
import { DisputeCancelActions } from "./DisputeCancelActions";
import { describeEvent } from "./HistoryScreen";
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

// Design "kv": a label and its value on one line.
function KeyValue({ label, value, testID }: { label: string; value: string; testID?: string }) {
	const { colors, typography, spacing } = useAppTheme();
	return (
		<View style={[styles.rowBetween, styles.kv, { gap: spacing.md }]}>
			<Text style={[typography.callout, { color: colors.textMuted }]}>{label}</Text>
			<Text
				testID={testID}
				style={[typography.rowTitle, styles.end, { color: colors.text }]}
				numberOfLines={2}
			>
				{value}
			</Text>
		</View>
	);
}

// Rows inside one card, separated by hairlines (design "card" + "row+row").
function Rows({ children }: { children: React.ReactNode[] }) {
	const { colors } = useAppTheme();
	return (
		<Card style={{ paddingVertical: 0 }}>
			{children.map((child, index) => (
				<View
					key={index}
					style={
						index === 0
							? undefined
							: { borderTopWidth: 1, borderTopColor: colors.divider }
					}
				>
					{child}
				</View>
			))}
		</Card>
	);
}

function recordLabel(agreement: AgreementDetail): string {
	if (agreement.status === "personal") {
		return tr.agreement.recordPersonal;
	}
	return agreement.status === "pending" || agreement.status === "countered"
		? tr.agreement.recordPending
		: tr.agreement.recordShared;
}

function Timeline({ agreement }: { agreement: AgreementDetail }) {
	const { colors, typography, spacing } = useAppTheme();
	// The latest few; the whole log is one tap away (S17).
	const latest = agreement.events.slice(-4).reverse();
	return (
		<Card>
			{latest.map((event) => (
				<View key={event.id} style={[styles.row, { gap: spacing.md }]}>
					<View style={[styles.dot, { backgroundColor: colors.successSoft }]}>
						<Ionicons name="checkmark" size={13} color={colors.success} />
					</View>
					<View style={styles.grow}>
						<Text style={[typography.rowTitle, { color: colors.text }]}>
							{describeEvent(event)}
						</Text>
						<Text style={[typography.caption, { color: colors.textMuted }]}>
							{formatDateTimeTR(event.at)} · {tr.history.actors[event.actor]}
						</Text>
					</View>
				</View>
			))}
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
		</Card>
	);
}

function Detail({ agreement }: { agreement: AgreementDetail }) {
	const { colors, typography, spacing } = useAppTheme();
	const online = useIsOnline();
	const paid = agreement.principal_minor - agreement.outstanding_minor;
	const tone = agreement.my_role === "creditor" ? "receivable" : "payable";

	return (
		<>
			{/* Design 13 / 15: who, how much is left of what, and the next step, in one card. */}
			<Card testID="agreement.summary" style={{ gap: spacing.md }}>
				<View style={[styles.row, { gap: spacing.md }]}>
					<Avatar name={agreement.counterparty.display_name} size={48} />
					<View style={styles.grow}>
						<Text
							testID="agreement.counterparty.text"
							style={[typography.headline, { color: colors.text }]}
							numberOfLines={1}
						>
							{agreement.counterparty.display_name}
						</Text>
						<Text
							testID="agreement.title.text"
							accessibilityRole="header"
							style={[typography.caption, { color: colors.textMuted }]}
							numberOfLines={1}
						>
							{agreement.title}
						</Text>
					</View>
					<AgreementStatusBadge
						status={agreement.status}
						testID="agreement.status.badge"
					/>
				</View>
				<View style={{ gap: 2 }}>
					<Text
						testID="agreement.role.text"
						style={[typography.label, { color: colors.textMuted }]}
					>
						{agreement.my_role === "creditor"
							? tr.agreement.owesYou
							: tr.agreement.youOwe}
					</Text>
					<View style={[styles.baseline, { gap: spacing.sm }]}>
						<AmountText
							minor={agreement.outstanding_minor}
							variant="amountXL"
							tone={tone}
							testID="agreement.outstanding.text"
						/>
						<Text style={[typography.callout, { color: colors.textMuted }]}>/</Text>
						<AmountText
							minor={agreement.principal_minor}
							variant="callout"
							tone="textMuted"
							testID="agreement.total.text"
						/>
					</View>
				</View>
				<ProgressBar
					value={agreement.principal_minor === 0 ? 0 : paid / agreement.principal_minor}
					label={fill(tr.agreement.paidOf, {
						paid: formatTRY(paid),
						amount: formatTRY(agreement.principal_minor),
					})}
					testID="agreement.progress"
				/>
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{fill(tr.agreement.paidOf, {
						paid: formatTRY(paid),
						amount: formatTRY(agreement.principal_minor),
					})}
				</Text>
				{agreement.reported_minor > 0 ? (
					<Text
						testID="agreement.awaiting.text"
						style={[typography.caption, { color: colors.warning }]}
					>
						{fill(tr.payment.awaiting, { amount: formatTRY(agreement.reported_minor) })}
					</Text>
				) : null}

				{canAddPayment(agreement) ? (
					<View style={{ gap: spacing.sm }}>
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
						{online ? null : (
							<Text style={[typography.caption, { color: colors.textMuted }]}>
								{tr.error.offline}
							</Text>
						)}
					</View>
				) : null}
			</Card>

			{agreement.status === "settled" ? (
				<Card
					testID="agreement.settled"
					style={{ backgroundColor: colors.successSoft, borderColor: colors.successSoft }}
				>
					<Text style={[typography.headline, { color: colors.success }]}>
						{tr.settled.title}
					</Text>
				</Card>
			) : null}

			<SharedStateActions agreement={agreement} />
			<DisputeCancelActions agreement={agreement} />

			<View style={{ gap: spacing.sm }}>
				<SectionHeader>{tr.agreement.sectionAgreement}</SectionHeader>
				<Rows>
					{[
						<KeyValue
							key="kind"
							label={tr.agreement.kindLabel}
							value={`${tr.agreement.kinds[agreement.kind]} · ${
								agreement.installment_count === 1
									? tr.agreement.planSingle
									: fill(tr.agreement.planInstallments, {
											count: String(agreement.installment_count),
										})
							}`}
						/>,
						...(agreement.started_on === null
							? []
							: [
									<KeyValue
										key="started"
										label={
											agreement.my_role === "creditor"
												? tr.new.startedOnLent
												: tr.new.startedOnBorrowed
										}
										value={formatDateTR(agreement.started_on, "long")}
										testID="agreement.startedOn.text"
									/>,
								]),
						...(agreement.notes === null
							? []
							: [
									<KeyValue
										key="notes"
										label={tr.agreement.notesLabel}
										value={agreement.notes}
									/>,
								]),
						<KeyValue
							key="record"
							label={tr.agreement.recordLabel}
							value={recordLabel(agreement)}
						/>,
					]}
				</Rows>
			</View>

			<View style={{ gap: spacing.sm }}>
				<SectionHeader>{tr.agreement.installments}</SectionHeader>
				<Rows>
					{agreement.installments.map((installment) => (
						<InstallmentRow
							key={installment.seq}
							installment={installment}
							count={agreement.installment_count}
						/>
					))}
				</Rows>
			</View>

			<View style={{ gap: spacing.sm }}>
				<SectionHeader>{tr.agreement.payments}</SectionHeader>
				{agreement.payments.length === 0 ? (
					<Text style={[typography.body, { color: colors.textMuted }]}>
						{tr.agreement.noPayments}
					</Text>
				) : (
					<Rows>
						{agreement.payments.map((payment) => (
							<PaymentRow
								key={payment.id}
								payment={payment}
								myRole={agreement.my_role}
							/>
						))}
					</Rows>
				)}
			</View>

			<View style={{ gap: spacing.sm }}>
				<SectionHeader>{tr.agreement.sectionTimeline}</SectionHeader>
				<Timeline agreement={agreement} />
			</View>
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
	row: { flexDirection: "row", alignItems: "center" },
	baseline: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" },
	grow: { flex: 1, minWidth: 0 },
	end: { flexShrink: 1, textAlign: "right" },
	kv: { minHeight: 48, paddingVertical: 12 },
	dot: {
		width: 24,
		height: 24,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
	},
	rowBetween: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		gap: 8,
	},
});
