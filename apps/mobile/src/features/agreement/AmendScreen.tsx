import { addMonthsClamped, formatTRY, validatePlan } from "@paramnet/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useAgreement, useProposeAmendment } from "@/api/hooks";
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
import { TextField } from "@/components/TextField";
import { messageForCode } from "@/features/forms/fieldError";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { useIsOnline } from "@/lib/network";
import { useAppTheme } from "@/theme/useAppTheme";

type Row = { key: number; due_date: string | null; amount_minor: number | null };

// S15: the whole plan, editable. The new total follows the rows (down payment stays), so one screen
// covers postponing, re-planning and correcting the amount (ADR-033).
function AmendForm({ agreement }: { agreement: AgreementDetail }) {
	const { colors, typography, spacing } = useAppTheme();
	const today = useToday();
	const online = useIsOnline();
	const propose = useProposeAmendment();
	const [rows, setRows] = useState<Row[]>(
		agreement.installments.map((row) => ({
			key: row.seq,
			due_date: row.due_date,
			amount_minor: row.amount_minor,
		})),
	);
	const [reason, setReason] = useState("");
	const sum = rows.reduce((total, row) => total + (row.amount_minor ?? 0), 0);
	const principal = agreement.down_payment_minor + sum;
	// Confirmed payments other than the down payment; the new plan must still cover them.
	const paid =
		agreement.principal_minor - agreement.down_payment_minor - agreement.outstanding_minor;
	const check = validatePlan({
		principal,
		downPayment: agreement.down_payment_minor,
		installments: rows.map((row) => ({
			due_date: row.due_date,
			amount_minor: row.amount_minor ?? 0,
		})),
	});
	const problem = !check.ok
		? messageForCode(check.error)
		: sum < paid
			? tr.amend.belowPaid
			: null;

	function update(key: number, patch: Partial<Row>) {
		setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
	}

	return (
		<Screen
			testID="amend.screen"
			edges={["bottom"]}
			footer={
				<Button
					label={tr.amend.send}
					disabled={problem !== null || !online}
					loading={propose.isPending}
					onPress={() => {
						if (!check.ok) {
							return;
						}
						const trimmed = reason.trim();
						propose.mutate(
							{
								id: agreement.id,
								terms: {
									principal_minor: principal,
									down_payment_minor: agreement.down_payment_minor,
									notes: agreement.notes,
									plan: check.plan,
								},
								reason: trimmed === "" ? null : trimmed,
								rowVersion: agreement.row_version,
							},
							{
								onSuccess: () => {
									router.back();
								},
							},
						);
					}}
					testID="amend.send.button"
				/>
			}
		>
			<ScreenTitle>{tr.amend.title}</ScreenTitle>
			<Text style={[typography.caption, { color: colors.textMuted }]}>{tr.amend.helper}</Text>
			{rows.map((row, index) => (
				<Card key={row.key} testID={`amend.row.${String(index + 1)}`}>
					<DateField
						label={fill(tr.plan.rowDate, { seq: String(index + 1) })}
						value={row.due_date}
						emptyText={tr.plan.noDueDate}
						defaultPickerDate={today}
						onChange={(due_date) => {
							update(row.key, { due_date });
						}}
						testID={`amend.row.${String(index + 1)}.date`}
					/>
					<AmountInput
						label={fill(tr.plan.rowAmount, { seq: String(index + 1) })}
						value={row.amount_minor}
						onChangeValue={(amount_minor) => {
							update(row.key, { amount_minor });
						}}
						testID={`amend.row.${String(index + 1)}.amount`}
					/>
				</Card>
			))}
			<View style={[styles.row, { gap: spacing.sm }]}>
				<Button
					label={tr.amend.addRow}
					variant="secondary"
					onPress={() => {
						const last = rows.at(-1)?.due_date ?? null;
						setRows((current) => [
							...current,
							{
								key: Math.max(0, ...current.map((r) => r.key)) + 1,
								due_date: last === null ? null : addMonthsClamped(last, 1),
								amount_minor: null,
							},
						]);
					}}
					testID="amend.addRow.button"
				/>
				<Button
					label={tr.amend.removeRow}
					variant="ghost"
					disabled={rows.length <= 1}
					onPress={() => {
						setRows((current) => current.slice(0, -1));
					}}
					testID="amend.removeRow.button"
				/>
			</View>
			<View style={styles.between}>
				<Text style={[typography.callout, { color: colors.textMuted }]}>
					{tr.amend.newTotal}
				</Text>
				<AmountText minor={principal} variant="headline" testID="amend.total.text" />
			</View>
			{principal !== agreement.principal_minor ? (
				<Text
					style={[typography.caption, { color: colors.warning }]}
					testID="amend.totalChanged"
				>
					{fill(tr.amend.totalChanged, { amount: formatTRY(agreement.principal_minor) })}
				</Text>
			) : null}
			<TextField
				label={tr.amend.reason}
				value={reason}
				onChangeText={setReason}
				multiline
				testID="amend.reason.input"
			/>
			{problem === null ? null : (
				<Text testID="amend.error" style={[typography.callout, { color: colors.overdue }]}>
					{problem}
				</Text>
			)}
			{propose.isError ? (
				<Text style={[typography.callout, { color: colors.overdue }]}>
					{messageForError(propose.error)}
				</Text>
			) : null}
		</Screen>
	);
}

export function AmendScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const agreement = useAgreement(id);
	if (agreement.isPending) {
		return (
			<Screen testID="amend.screen" edges={["bottom"]}>
				<LoadingState testID="amend.loading" />
			</Screen>
		);
	}
	if (agreement.isError) {
		return (
			<Screen testID="amend.screen" edges={["bottom"]}>
				<ErrorState
					message={messageForError(agreement.error)}
					onRetry={() => {
						void agreement.refetch();
					}}
					testID="amend.error"
				/>
			</Screen>
		);
	}
	return <AmendForm agreement={agreement.data} />;
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		flexWrap: "wrap",
	},
	between: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
});
