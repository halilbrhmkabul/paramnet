import { formatDateTR, formatTRY, validatePlan } from "@paramnet/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { messageForError } from "@/api/errors";
import { useDecide, usePendingDecision, useWithdrawShare } from "@/api/hooks";
import type { Decision, PendingDecision, TermsView } from "@/api/types";
import { AmountInput } from "@/components/AmountInput";
import { AmountText } from "@/components/AmountText";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DateField } from "@/components/DateField";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { SectionHeader } from "@/components/SectionHeader";
import { messageForCode } from "@/features/forms/fieldError";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { useIsOnline } from "@/lib/network";
import { useAppTheme } from "@/theme/useAppTheme";

function TermsCard({ title, terms, testID }: { title: string; terms: TermsView; testID: string }) {
	const { colors, typography } = useAppTheme();
	return (
		<Card testID={testID}>
			<SectionHeader>{title}</SectionHeader>
			<View style={styles.row}>
				<Text style={[typography.callout, { color: colors.textMuted }]}>
					{tr.plan.total}
				</Text>
				<AmountText
					minor={terms.principal_minor}
					variant="headline"
					testID={`${testID}.total`}
				/>
			</View>
			{terms.down_payment_minor > 0 ? (
				<View style={styles.row}>
					<Text style={[typography.callout, { color: colors.textMuted }]}>
						{tr.plan.downPayment}
					</Text>
					<AmountText minor={terms.down_payment_minor} variant="callout" />
				</View>
			) : null}
			{terms.plan.map((row) => (
				<View key={row.seq} style={styles.row} testID={`${testID}.row.${String(row.seq)}`}>
					<Text style={[typography.body, { color: colors.text }]}>
						{fill(tr.plan.row, { seq: String(row.seq) })} ·{" "}
						{row.due_date === null
							? tr.plan.noDueDate
							: formatDateTR(row.due_date, "short")}
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
			{terms.notes === null ? null : (
				<Text style={[typography.caption, { color: colors.textMuted }]}>{terms.notes}</Text>
			)}
		</Card>
	);
}

type Row = { seq: number; due_date: string | null; amount_minor: number | null };

// Counter offer: dates and amounts per row; total and down payment stay (ADR-027).
function CounterEditor({
	pending,
	onSend,
	onCancel,
	sending,
}: {
	pending: PendingDecision;
	onSend: (terms: TermsView) => void;
	onCancel: () => void;
	sending: boolean;
}) {
	const { colors, typography } = useAppTheme();
	const today = useToday();
	const [rows, setRows] = useState<Row[]>(pending.proposed.plan);
	const check = validatePlan({
		principal: pending.proposed.principal_minor,
		downPayment: pending.proposed.down_payment_minor,
		installments: rows.map((row) => ({
			due_date: row.due_date,
			amount_minor: row.amount_minor ?? 0,
		})),
	});
	return (
		<Card testID="decide.editor">
			<SectionHeader>{tr.invite.counter}</SectionHeader>
			<Text style={[typography.caption, { color: colors.textMuted }]}>
				{tr.decide.editorHelper}
			</Text>
			{rows.map((row) => (
				<View key={row.seq} style={{ gap: 8 }}>
					<DateField
						label={fill(tr.plan.rowDate, { seq: String(row.seq) })}
						value={row.due_date}
						emptyText={tr.plan.noDueDate}
						defaultPickerDate={today}
						onChange={(due_date) => {
							setRows((current) =>
								current.map((r) => (r.seq === row.seq ? { ...r, due_date } : r)),
							);
						}}
						testID={`decide.editor.${String(row.seq)}.date`}
					/>
					<AmountInput
						label={fill(tr.plan.rowAmount, { seq: String(row.seq) })}
						value={row.amount_minor}
						onChangeValue={(amount_minor) => {
							setRows((current) =>
								current.map((r) =>
									r.seq === row.seq ? { ...r, amount_minor } : r,
								),
							);
						}}
						testID={`decide.editor.${String(row.seq)}.amount`}
					/>
				</View>
			))}
			{check.ok ? null : (
				<Text
					testID="decide.editor.error"
					style={[typography.callout, { color: colors.overdue }]}
				>
					{messageForCode(check.error)}
				</Text>
			)}
			<Button
				label={tr.decide.send}
				disabled={!check.ok}
				loading={sending}
				onPress={() => {
					if (check.ok) {
						onSend({ ...pending.proposed, plan: check.plan });
					}
				}}
				testID="decide.counter.send"
			/>
			<Button
				label={tr.common.cancel}
				variant="ghost"
				onPress={onCancel}
				testID="decide.counter.cancel"
			/>
		</Card>
	);
}

function DecisionView({ pending }: { pending: PendingDecision }) {
	const { colors, typography, spacing } = useAppTheme();
	const online = useIsOnline();
	const decide = useDecide();
	const withdraw = useWithdrawShare();
	const [editing, setEditing] = useState(false);
	const changed = JSON.stringify(pending.current) !== JSON.stringify(pending.proposed);
	const name = pending.other_name ?? "";

	function send(decision: Decision, counterTerms: TermsView | null) {
		decide.mutate(
			{ pending, decision, counterTerms },
			{
				onSuccess: () => {
					// After a rejection the agreement is no longer mine to see.
					if (decision === "reject" && pending.actor !== "amendment") {
						router.dismissTo("/(tabs)");
					} else {
						router.replace({
							pathname: "/agreement/[id]",
							params: { id: pending.agreement_id },
						});
					}
				},
			},
		);
	}

	return (
		<Screen testID="decide.screen" edges={["bottom"]}>
			<View style={[styles.hero, { gap: spacing.sm }]}>
				<Avatar name={name === "" ? pending.title : name} size={72} />
			</View>
			<ScreenTitle>
				{pending.actor === "creator"
					? fill(tr.decide.counterTitle, { name })
					: pending.actor === "amendment"
						? fill(tr.decide.amendmentTitle, { name })
						: fill(tr.invite.title, { name })}
			</ScreenTitle>
			{pending.reason === null ? null : (
				<Card testID="decide.reason">
					<Text style={[typography.caption, { color: colors.textMuted }]}>
						{tr.decide.reason}
					</Text>
					<Text style={[typography.body, { color: colors.text }]}>{pending.reason}</Text>
				</Card>
			)}
			<Text style={[typography.headline, { color: colors.text }]}>{pending.title}</Text>
			<AmountText
				minor={pending.proposed.principal_minor}
				variant="amountXL"
				tone="primary"
				testID="decide.amount"
			/>
			<View style={[styles.info, { backgroundColor: colors.pendingSoft, gap: spacing.sm }]}>
				<Icon name="info" size={18} tone="pending" strokeWidth={2} />
				<Text style={[typography.caption, styles.infoText, { color: colors.pending }]}>
					{tr.decide.noMoneyMoves}
				</Text>
			</View>
			<Text testID="decide.role" style={[typography.callout, { color: colors.textMuted }]}>
				{pending.my_role === "debtor" ? tr.agreement.youOwe : tr.agreement.owesYou}
			</Text>
			<TermsCard
				title={tr.decide.proposed}
				terms={pending.proposed}
				testID="decide.proposed"
			/>
			{changed ? (
				<TermsCard
					title={tr.decide.current}
					terms={pending.current}
					testID="decide.current"
				/>
			) : null}
			{pending.payments.length === 0 ? null : (
				<Card testID="decide.payments">
					<SectionHeader>{tr.decide.earlierPayments}</SectionHeader>
					<Text style={[typography.caption, { color: colors.textMuted }]}>
						{tr.decide.earlierPaymentsNote}
					</Text>
					{pending.payments.map((payment, index) => (
						<View key={index} style={styles.row}>
							<Text style={[typography.body, { color: colors.text }]}>
								{formatDateTR(payment.paid_on, "short")}
							</Text>
							<AmountText minor={payment.amount_minor} />
						</View>
					))}
				</Card>
			)}

			{decide.isError || withdraw.isError ? (
				<Text
					accessibilityLiveRegion="polite"
					style={[typography.callout, { color: colors.overdue }]}
				>
					{messageForError(decide.error ?? withdraw.error)}
				</Text>
			) : null}
			{online ? null : (
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{tr.error.offline}
				</Text>
			)}

			{editing ? (
				<CounterEditor
					pending={pending}
					sending={decide.isPending}
					onSend={(terms) => {
						send("counter", terms);
					}}
					onCancel={() => {
						setEditing(false);
					}}
				/>
			) : (
				<View style={{ gap: spacing.sm }}>
					<Button
						label={
							pending.actor === "creator" ? tr.decide.acceptCounter : tr.invite.accept
						}
						disabled={!online}
						loading={decide.isPending}
						onPress={() => {
							send("accept", null);
						}}
						testID="decide.accept.button"
					/>
					{/* An amendment is answered yes or no; a different change is a new request. */}
					{pending.actor === "amendment" ? null : (
						<Button
							label={tr.invite.counter}
							variant="secondary"
							disabled={!online}
							onPress={() => {
								setEditing(true);
							}}
							testID="decide.counter.button"
						/>
					)}
					{pending.can_reject ? (
						<Button
							label={
								pending.actor === "amendment"
									? tr.decide.rejectAmendment
									: tr.invite.reject
							}
							variant="ghost"
							disabled={!online}
							onPress={() => {
								send("reject", null);
							}}
							testID="decide.reject.button"
						/>
					) : (
						<Button
							label={tr.decide.withdraw}
							variant="ghost"
							disabled={!online}
							loading={withdraw.isPending}
							onPress={() => {
								withdraw.mutate(pending.agreement_id, {
									onSuccess: () => {
										router.replace({
											pathname: "/agreement/[id]",
											params: { id: pending.agreement_id },
										});
									},
								});
							}}
							testID="decide.withdraw.button"
						/>
					)}
				</View>
			)}
		</Screen>
	);
}

// S14 (counterparty) and "Öneriyi incele" (creator): decide with the version + terms hash shown here.
export function DecideScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const pending = usePendingDecision(id);
	if (pending.isPending) {
		return (
			<Screen testID="decide.screen" edges={["bottom"]}>
				<LoadingState testID="decide.loading" />
			</Screen>
		);
	}
	if (pending.isError) {
		return (
			<Screen testID="decide.screen" edges={["bottom"]}>
				<ErrorState
					message={messageForError(pending.error)}
					onRetry={() => {
						void pending.refetch();
					}}
					testID="decide.error"
				/>
			</Screen>
		);
	}
	return <DecisionView pending={pending.data} />;
}

const styles = StyleSheet.create({
	hero: { alignItems: "center", paddingTop: 8 },
	info: { flexDirection: "row", alignItems: "flex-start", borderRadius: 14, padding: 12 },
	infoText: { flex: 1 },
	row: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		gap: 8,
	},
});
