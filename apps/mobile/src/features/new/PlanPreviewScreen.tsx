import { formatTRY, validatePlan, type PlanInstallment } from "@paramnet/shared";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useNewDraft } from "./draftStore";
import {
	NEW_TYPES,
	planFromValues,
	remainingOf,
	toCreateInput,
	type NewFormValues,
	type NewType,
} from "./formModel";
import { messageForError } from "@/api/errors";
import { useCreateAgreement } from "@/api/hooks";
import { AmountInput } from "@/components/AmountInput";
import { AmountText } from "@/components/AmountText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DateField } from "@/components/DateField";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { messageForCode } from "@/features/forms/fieldError";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { useAppTheme } from "@/theme/useAppTheme";

export function PlanPreviewScreen() {
	const type = useNewDraft((state) => state.type);
	const values = useNewDraft((state) => state.values);
	if (type === null || values === null) {
		return <Redirect href="/new" />;
	}
	return <PlanPreview type={type} values={values} />;
}

type EditableRow = {
	seq: number;
	due_date: PlanInstallment["due_date"];
	amount_minor: number | null;
};

function SummaryRow({ label, minor, testID }: { label: string; minor: number; testID: string }) {
	const { colors, typography } = useAppTheme();
	return (
		<View style={styles.summaryRow}>
			<Text style={[typography.callout, { color: colors.textMuted }]}>{label}</Text>
			<AmountText minor={minor} variant="headline" testID={testID} />
		</View>
	);
}

// S10: the generated plan is editable row by row; Save stays off until the rows satisfy BR-03.
function PlanPreview({ type, values }: { type: NewType; values: NewFormValues }) {
	const { colors, typography, spacing } = useAppTheme();
	const today = useToday();
	const idempotencyKey = useNewDraft((state) => state.idempotencyKey);
	const finish = useNewDraft((state) => state.finish);
	const create = useCreateAgreement();
	const [rows, setRows] = useState<EditableRow[]>(() => planFromValues(type, values));
	const config = NEW_TYPES[type];
	const remaining = remainingOf(type, values);
	const downPayment = config.purchase ? (values.down_payment_minor ?? 0) : 0;

	const check = validatePlan({
		principal: values.amount_minor ?? 0,
		downPayment,
		installments: rows.map((row) => ({
			due_date: row.due_date,
			amount_minor: row.amount_minor ?? 0,
		})),
	});
	const sum = rows.reduce((total, row) => total + (row.amount_minor ?? 0), 0);
	const problem = check.ok
		? null
		: check.error === "sum_mismatch"
			? fill(tr.plan.mismatch, { amount: formatTRY(sum - remaining) })
			: messageForCode(check.error);

	function updateRow(seq: number, patch: Partial<EditableRow>) {
		setRows((current) => current.map((row) => (row.seq === seq ? { ...row, ...patch } : row)));
	}

	return (
		<Screen
			testID="plan.screen"
			edges={["top", "bottom"]}
			footer={
				<Button
					label={tr.plan.save}
					disabled={!check.ok}
					loading={create.isPending}
					onPress={() => {
						if (!check.ok) {
							return;
						}
						create.mutate(
							{ input: toCreateInput(type, values, check.plan), idempotencyKey },
							{
								onSuccess: ({ agreement_id }) => {
									finish(
										values.contact !== null && "contact_id" in values.contact
											? values.contact.contact_id
											: null,
									);
									router.replace({
										pathname: "/agreement/[id]",
										params: { id: agreement_id },
									});
								},
							},
						);
					}}
					testID="plan.save.button"
				/>
			}
		>
			<ScreenTitle>{tr.plan.title}</ScreenTitle>
			<Card testID="plan.summary">
				<SummaryRow
					label={tr.plan.total}
					minor={values.amount_minor ?? 0}
					testID="plan.total.text"
				/>
				{config.purchase ? (
					<SummaryRow
						label={tr.plan.downPayment}
						minor={downPayment}
						testID="plan.downPayment.text"
					/>
				) : null}
				<SummaryRow
					label={tr.plan.remaining}
					minor={remaining}
					testID="plan.remaining.text"
				/>
			</Card>

			{rows.map((row) => (
				<Card key={row.seq} testID={`plan.row.${String(row.seq)}`}>
					<Text style={[typography.headline, { color: colors.text }]}>
						{fill(tr.plan.row, { seq: String(row.seq) })}
					</Text>
					<DateField
						label={fill(tr.plan.rowDate, { seq: String(row.seq) })}
						value={row.due_date}
						emptyText={tr.plan.noDueDate}
						defaultPickerDate={today}
						onChange={(due_date) => {
							updateRow(row.seq, { due_date });
						}}
						testID={`plan.row.${String(row.seq)}.date`}
					/>
					<AmountInput
						label={fill(tr.plan.rowAmount, { seq: String(row.seq) })}
						value={row.amount_minor}
						onChangeValue={(amount_minor) => {
							updateRow(row.seq, { amount_minor });
						}}
						testID={`plan.row.${String(row.seq)}.amount.input`}
					/>
				</Card>
			))}

			{problem !== null ? (
				<Text
					testID="plan.mismatch.text"
					accessibilityLiveRegion="polite"
					style={[typography.callout, { color: colors.overdue }]}
				>
					{problem}
				</Text>
			) : null}
			{create.isError ? (
				<Text style={[typography.callout, { color: colors.overdue }]}>
					{messageForError(create.error)}
				</Text>
			) : null}
			<View style={{ gap: spacing.sm }}>
				<Button
					label={tr.plan.resetEqual}
					variant="ghost"
					onPress={() => {
						setRows(planFromValues(type, values));
					}}
					testID="plan.resetEqual.button"
				/>
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	summaryRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
});
