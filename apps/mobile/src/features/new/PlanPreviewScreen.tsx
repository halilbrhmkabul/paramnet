import { formatDateTR, formatTRY, validatePlan, type PlanInstallment } from "@paramnet/shared";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
import { useCreateAgreement, useMyProfile } from "@/api/hooks";
import { AmountInput } from "@/components/AmountInput";
import { AmountText } from "@/components/AmountText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DateField } from "@/components/DateField";
import { Screen } from "@/components/Screen";
import {
	pastDueCount,
	planSplit,
	rowTiming,
	togglePaidCount,
	type RowTiming,
} from "@/features/agreement/installmentPlan";
import { messageForCode } from "@/features/forms/fieldError";
import { reminderSummary } from "@/features/inbox/inboxModel";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { useAppTheme } from "@/theme/useAppTheme";

export function PlanPreviewScreen() {
	const type = useNewDraft((state) => state.type);
	const values = useNewDraft((state) => state.values);
	const { edit } = useLocalSearchParams<{ edit?: string }>();
	if (type === null || values === null) {
		return <Redirect href="/new" />;
	}
	return <PlanPreview type={type} values={values} startEditing={edit === "1"} />;
}

type EditableRow = {
	seq: number;
	due_date: PlanInstallment["due_date"];
	amount_minor: number | null;
};

const PERIOD_LABEL = {
	monthly: tr.new.periodMonthly,
	weekly: tr.new.periodWeekly,
	biweekly: tr.new.periodBiweekly,
} as const;

// Design "kv": a label and its amount on one line, hairline between rows.
function SummaryRow({
	label,
	minor,
	sign,
	first = false,
	testID,
}: {
	label: string;
	minor: number;
	sign?: "minus";
	first?: boolean;
	testID: string;
}) {
	const { colors, typography } = useAppTheme();
	return (
		<View
			style={[
				styles.between,
				styles.kv,
				first ? undefined : { borderTopWidth: 1, borderTopColor: colors.divider },
			]}
		>
			<Text style={[typography.callout, { color: colors.textMuted }]}>{label}</Text>
			{sign === "minus" ? (
				<Text
					testID={testID}
					style={[typography.rowTitle, styles.amount, { color: colors.receivable }]}
				>
					{`−${formatTRY(minor)}`}
				</Text>
			) : (
				<AmountText minor={minor} variant="rowTitle" testID={testID} />
			)}
		</View>
	);
}

function timingText(timing: RowTiming): string {
	switch (timing.kind) {
		case "past":
			return tr.plan.past;
		case "today":
			return tr.plan.today;
		case "soon":
			return fill(tr.plan.soon, { days: String(timing.days) });
		case "planned":
			return tr.plan.planned;
	}
}

function kurusText(minor: number): string {
	return minor < 100 ? fill(tr.plan.kurus, { count: String(minor) }) : formatTRY(minor);
}

function PaidToggle({
	seq,
	checked,
	onChange,
}: {
	seq: number;
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	const { colors, typography, sizes } = useAppTheme();
	return (
		<Pressable
			testID={`plan.row.${String(seq)}.paid`}
			accessibilityRole="checkbox"
			accessibilityLabel={fill(tr.plan.paidLabel, { seq: String(seq) })}
			accessibilityState={{ checked }}
			onPress={() => {
				onChange(!checked);
			}}
			style={[styles.row, { minHeight: sizes.minTouch, gap: 6, paddingLeft: 6 }]}
		>
			<View
				style={[
					styles.box,
					{
						borderColor: checked ? colors.accent : colors.borderStrong,
						backgroundColor: checked ? colors.accent : "transparent",
					},
				]}
			>
				{checked ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
			</View>
			<Text style={[typography.badge, { color: colors.success }]}>{tr.plan.paid}</Text>
		</Pressable>
	);
}

// Design 24 row: number, date with its timing, amount, and "Ödendi" for a row already behind.
function PlanRow({
	row,
	hint,
	soon,
	paid,
	onPaid,
}: {
	row: PlanInstallment;
	hint: string;
	soon: boolean;
	paid: boolean | null;
	onPaid: (checked: boolean) => void;
}) {
	const { colors, typography, spacing } = useAppTheme();
	return (
		<View
			testID={`plan.row.${String(row.seq)}`}
			style={[
				styles.row,
				styles.planRow,
				{ gap: spacing.md, backgroundColor: soon ? colors.warningTint : undefined },
			]}
		>
			<View
				style={[
					styles.no,
					{ backgroundColor: soon ? colors.warningSoft : colors.surfaceSunken },
				]}
			>
				<Text
					style={[typography.label, { color: soon ? colors.warning : colors.textMuted }]}
				>
					{row.seq}
				</Text>
			</View>
			<View style={styles.grow}>
				<Text
					testID={`plan.row.${String(row.seq)}.date`}
					style={[typography.rowTitle, { color: colors.text }]}
				>
					{row.due_date === null ? tr.plan.noDueDate : formatDateTR(row.due_date, "long")}
				</Text>
				<Text
					style={[
						soon ? typography.badge : typography.caption,
						{ color: soon ? colors.warning : colors.textMuted },
					]}
				>
					{hint}
				</Text>
			</View>
			<AmountText minor={row.amount_minor} variant="rowTitle" />
			{paid === null ? null : <PaidToggle seq={row.seq} checked={paid} onChange={onPaid} />}
		</View>
	);
}

// Design 24 (S10): the plan as it will be saved; the rows stay editable on request (ADR-012).
function PlanPreview({
	type,
	values,
	startEditing,
}: {
	type: NewType;
	values: NewFormValues;
	startEditing: boolean;
}) {
	const { colors, typography, spacing, radius, sizes } = useAppTheme();
	const today = useToday();
	const idempotencyKey = useNewDraft((state) => state.idempotencyKey);
	const finish = useNewDraft((state) => state.finish);
	const create = useCreateAgreement();
	const profile = useMyProfile();
	const [editing, setEditing] = useState(startEditing);
	const [rows, setRows] = useState<EditableRow[]>(() => planFromValues(type, values));
	const [paidCount, setPaidCount] = useState(0);
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
	// Edited dates can move a row out of the past; it is then no longer paid.
	const past = check.ok ? pastDueCount(check.plan, today) : 0;
	const paid = Math.min(paidCount, past);

	function updateRow(seq: number, patch: Partial<EditableRow>) {
		setRows((current) => current.map((row) => (row.seq === seq ? { ...row, ...patch } : row)));
	}

	const title = config.purchase ? values.title.trim() : tr.new.loanTitle;
	const period = rows.length === 1 ? null : PERIOD_LABEL[values.period];

	return (
		<Screen
			testID="plan.screen"
			edges={["bottom"]}
			footer={
				<View style={{ gap: 10 }}>
					<Button
						label={tr.plan.save}
						disabled={!check.ok}
						loading={create.isPending}
						onPress={() => {
							if (!check.ok) {
								return;
							}
							create.mutate(
								{
									input: toCreateInput(type, values, check.plan),
									idempotencyKey,
									paidCount: paid,
								},
								{
									onSuccess: ({ agreement_id }) => {
										finish(
											values.contact !== null &&
												"contact_id" in values.contact
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
					<Button
						label={tr.plan.edit}
						variant="secondary"
						onPress={() => {
							router.back();
						}}
						testID="plan.edit.button"
					/>
				</View>
			}
		>
			<Stack.Screen options={{ title: tr.plan.title }} />

			<Card testID="plan.summary" style={{ gap: 2 }}>
				<Text style={[typography.headline, { color: colors.text }]}>{title}</Text>
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{period === null
						? values.contact_label
						: fill(tr.plan.summaryLine, {
								name: values.contact_label,
								period,
								count: String(rows.length),
							})}
				</Text>
				<View
					style={{
						marginTop: 10,
						borderTopWidth: 1,
						borderTopColor: colors.divider,
					}}
				>
					<SummaryRow
						first
						label={config.purchase ? tr.plan.price : tr.plan.total}
						minor={values.amount_minor ?? 0}
						testID="plan.total.text"
					/>
					{config.purchase && downPayment > 0 ? (
						<SummaryRow
							label={
								values.started_on === null
									? tr.plan.downPayment
									: fill(tr.plan.downOn, {
											date: formatDateTR(values.started_on, "short"),
										})
							}
							minor={downPayment}
							sign="minus"
							testID="plan.downPayment.text"
						/>
					) : null}
					<SummaryRow
						label={config.purchase ? tr.plan.installed : tr.plan.remaining}
						minor={remaining}
						testID="plan.remaining.text"
					/>
				</View>
			</Card>

			<View style={{ gap: spacing.sm }}>
				<Text style={[typography.label, styles.label, { color: colors.textMuted }]}>
					{tr.plan.installments}
				</Text>
				{editing ? (
					rows.map((row) => (
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
					))
				) : check.ok ? (
					<Card style={{ padding: 0, gap: 0, overflow: "hidden" }}>
						{check.plan.map((row, index) => {
							const timing = rowTiming(row.due_date, today);
							const last = index === check.plan.length - 1 && index > 0;
							const extra = row.amount_minor - planSplit(check.plan).base;
							const hint = last
								? extra > 0
									? fill(tr.plan.lastExtra, { amount: kurusText(extra) })
									: tr.plan.lastRow
								: timingText(timing);
							return (
								<View
									key={row.seq}
									style={
										index === 0
											? undefined
											: { borderTopWidth: 1, borderTopColor: colors.divider }
									}
								>
									<PlanRow
										row={row}
										hint={hint}
										soon={timing.kind === "soon" || timing.kind === "today"}
										paid={index < past ? row.seq <= paid : null}
										onPaid={(checked) => {
											setPaidCount(togglePaidCount(paid, row.seq, checked));
										}}
									/>
								</View>
							);
						})}
						<View
							style={[
								styles.between,
								{
									paddingHorizontal: 14,
									paddingVertical: spacing.md,
									borderTopWidth: 1,
									borderTopColor: colors.border,
									backgroundColor: colors.primaryTint,
								},
							]}
						>
							<View style={[styles.row, { gap: 6 }]}>
								<Ionicons name="checkmark" size={16} color={colors.success} />
								<Text style={[typography.label, { color: colors.success }]}>
									{tr.plan.sumMatches}
								</Text>
							</View>
							<AmountText minor={sum} variant="rowTitle" testID="plan.sum.text" />
						</View>
					</Card>
				) : null}
			</View>

			{problem !== null ? (
				<Text
					testID="plan.mismatch.text"
					accessibilityLiveRegion="polite"
					style={[typography.callout, { color: colors.overdue }]}
				>
					{problem}
				</Text>
			) : null}
			{editing ? (
				<Button
					label={tr.plan.resetEqual}
					variant="ghost"
					onPress={() => {
						setRows(planFromValues(type, values));
					}}
					testID="plan.resetEqual.button"
				/>
			) : (
				<Button
					label={tr.plan.editRows}
					variant="ghost"
					onPress={() => {
						setEditing(true);
					}}
					testID="plan.editRows.button"
				/>
			)}

			{profile.data === undefined ? null : (
				<Card style={[styles.row, { gap: spacing.md, paddingVertical: 14 }]}>
					<Ionicons name="notifications-outline" size={20} color={colors.textMuted} />
					<View style={styles.grow}>
						<Text style={[typography.rowTitle, { color: colors.text }]}>
							{tr.plan.reminder}
						</Text>
						<Text style={[typography.caption, { color: colors.textMuted }]}>
							{reminderSummary(profile.data.reminder_before_days)}
						</Text>
					</View>
					<Pressable
						testID="plan.reminder.change"
						accessibilityRole="button"
						accessibilityLabel={tr.plan.reminderChangeLabel}
						onPress={() => {
							router.push({ pathname: "/inbox", params: { focus: "reminders" } });
						}}
						style={[styles.row, { minHeight: sizes.minTouch, borderRadius: radius.sm }]}
					>
						<Text style={[typography.rowTitle, { color: colors.accent }]}>
							{tr.plan.reminderChange}
						</Text>
					</Pressable>
				</Card>
			)}

			{create.isError ? (
				<Text style={[typography.callout, { color: colors.overdue }]}>
					{messageForError(create.error)}
				</Text>
			) : null}
		</Screen>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", alignItems: "center" },
	between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	kv: { paddingVertical: 10, gap: 12 },
	grow: { flex: 1, minWidth: 0 },
	amount: { fontVariant: ["tabular-nums"] },
	label: { paddingHorizontal: 4 },
	planRow: { paddingHorizontal: 14, paddingVertical: 10, minHeight: 60 },
	no: {
		width: 30,
		height: 30,
		borderRadius: 9,
		alignItems: "center",
		justifyContent: "center",
	},
	box: {
		width: 20,
		height: 20,
		borderRadius: 6,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
	},
});
