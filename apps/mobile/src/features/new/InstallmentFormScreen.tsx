import { addMonthsClamped, formatTRY, MAX_INSTALLMENTS, type PlanPeriod } from "@paramnet/shared";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ContactPickerSheet } from "./ContactPickerSheet";
import { useNewDraft } from "./draftStore";
import { defaultValues, remainingOf, tryPlan, type NewFormValues, type NewType } from "./formModel";
import { ContactField, resolverFor } from "./formParts";
import { AmountInput } from "@/components/AmountInput";
import { Button } from "@/components/Button";
import { DateField } from "@/components/DateField";
import { Screen } from "@/components/Screen";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TextField } from "@/components/TextField";
import { pastDueCount, planSplit } from "@/features/agreement/installmentPlan";
import { messageForCode } from "@/features/forms/fieldError";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { useAppTheme } from "@/theme/useAppTheme";

const PERIODS: { value: PlanPeriod; label: string }[] = [
	{ value: "monthly", label: tr.new.periodMonthly },
	{ value: "biweekly", label: tr.new.periodBiweekly },
	{ value: "weekly", label: tr.new.periodWeekly },
];

function StepButton({
	icon,
	label,
	disabled,
	onPress,
	testID,
}: {
	icon: "add" | "remove";
	label: string;
	disabled: boolean;
	onPress: () => void;
	testID: string;
}) {
	const { colors, sizes } = useAppTheme();
	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.step,
				{
					width: sizes.minTouch,
					height: sizes.minTouch,
					backgroundColor: colors.surfaceSunken,
					opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
				},
			]}
		>
			<Ionicons name={icon} size={18} color={colors.primary} />
		</Pressable>
	);
}

// Design 23: an installment purchase on one screen, with the computed row and past-date note live.
export function InstallmentFormScreen({ type }: { type: NewType }) {
	const { colors, typography, radius, spacing, sizes } = useAppTheme();
	const today = useToday();
	const draft = useNewDraft();
	const [pickerOpen, setPickerOpen] = useState(false);
	const { control, handleSubmit, setValue, formState } = useForm<NewFormValues>({
		defaultValues: draft.values ?? defaultValues(today, true),
		resolver: resolverFor(type),
		reValidateMode: "onChange",
	});
	// defaultValues sets every field, so the watched object is never partial.
	const values = useWatch({ control }) as NewFormValues;
	const error = (field: keyof NewFormValues) => {
		const message = formState.errors[field]?.message;
		return message === undefined ? undefined : messageForCode(message);
	};
	const count = Number(values.count);
	const plan = tryPlan(type, values);
	const split = plan === null ? null : planSplit(plan);
	const past = plan === null ? 0 : pastDueCount(plan, today);
	const remaining = Math.max(0, remainingOf(type, values));
	const sold = type === "soldInstallment";

	function toPlan(edit: boolean) {
		void handleSubmit((valid) => {
			draft.setValues(valid);
			router.push({ pathname: "/new/plan", params: edit ? { edit: "1" } : {} });
		})();
	}

	function setCount(next: number) {
		setValue("count", String(next), { shouldValidate: formState.isSubmitted });
	}

	return (
		<Screen
			testID="newForm.screen"
			edges={["bottom"]}
			footer={
				<Button
					label={tr.new.toPreview}
					onPress={() => {
						toPlan(false);
					}}
					testID="newForm.submit.button"
				/>
			}
		>
			<Stack.Screen options={{ title: tr.new.installmentTitle }} />

			<View style={[styles.grid, { gap: spacing.sm + 2 }]}>
				<View style={styles.cell}>
					<ContactField
						label={sold ? tr.new.buyerOrPerson : tr.new.sellerOrPerson}
						value={values.contact === null ? null : values.contact_label}
						error={error("contact")}
						onPress={() => {
							setPickerOpen(true);
						}}
					/>
				</View>
				<View style={styles.cell}>
					<Controller
						control={control}
						name="title"
						render={({ field }) => (
							<TextField
								label={tr.new.product}
								placeholder={tr.new.productPlaceholder}
								value={field.value}
								onChangeText={field.onChange}
								onBlur={field.onBlur}
								error={error("title")}
								testID="newForm.title.input"
							/>
						)}
					/>
				</View>
			</View>
			<ContactPickerSheet
				visible={pickerOpen}
				newContactKind={sold ? "person" : "merchant"}
				lastContactId={draft.lastContactId}
				onSelect={(choice, label) => {
					setValue("contact", choice, { shouldValidate: formState.isSubmitted });
					setValue("contact_label", label);
					setPickerOpen(false);
				}}
				onClose={() => {
					setPickerOpen(false);
				}}
			/>

			<View style={[styles.grid, { gap: spacing.sm + 2 }]}>
				<View style={styles.cell}>
					<Controller
						control={control}
						name="amount_minor"
						render={({ field }) => (
							<AmountInput
								label={tr.new.price}
								value={field.value}
								onChangeValue={field.onChange}
								error={error("amount_minor")}
								testID="newForm.amount.input"
							/>
						)}
					/>
				</View>
				<View style={styles.cell}>
					<Controller
						control={control}
						name="down_payment_minor"
						render={({ field }) => (
							<AmountInput
								label={tr.new.downPayment}
								value={field.value}
								onChangeValue={field.onChange}
								error={error("down_payment_minor")}
								testID="newForm.downPayment.input"
							/>
						)}
					/>
				</View>
			</View>

			<View
				style={[
					styles.between,
					{
						backgroundColor: colors.primaryTint,
						borderRadius: radius.md,
						paddingHorizontal: spacing.lg,
						paddingVertical: 14,
					},
				]}
			>
				<Text style={[typography.rowTitle, styles.shrink, { color: colors.text }]}>
					{tr.new.toInstall}
				</Text>
				<Text
					testID="newForm.remaining.text"
					style={[typography.headline, styles.amount, { color: colors.primary }]}
				>
					{formatTRY(remaining)}
				</Text>
			</View>

			<View style={[styles.grid, { gap: spacing.sm + 2 }]}>
				<View style={[styles.cell, { gap: spacing.xs }]}>
					<Text style={[typography.label, { color: colors.textMuted }]}>
						{tr.new.count}
					</Text>
					<View
						style={[
							styles.between,
							{
								minHeight: sizes.buttonPrimary,
								borderRadius: radius.sm,
								borderWidth: 1,
								borderColor:
									error("count") === undefined
										? colors.borderStrong
										: colors.overdue,
								backgroundColor: colors.surface,
								paddingHorizontal: spacing.xs,
							},
						]}
					>
						<StepButton
							icon="remove"
							label={tr.new.countDec}
							disabled={count <= 1}
							onPress={() => {
								setCount(count - 1);
							}}
							testID="newForm.count.dec"
						/>
						<Text
							testID="newForm.count.value"
							accessibilityLabel={`${tr.new.count}: ${values.count}`}
							style={[typography.headline, { color: colors.text }]}
						>
							{values.count}
						</Text>
						<StepButton
							icon="add"
							label={tr.new.countInc}
							disabled={count >= MAX_INSTALLMENTS}
							onPress={() => {
								setCount(count + 1);
							}}
							testID="newForm.count.inc"
						/>
					</View>
					{error("count") === undefined ? null : (
						<Text style={[typography.caption, { color: colors.overdue }]}>
							{error("count")}
						</Text>
					)}
				</View>
				<View style={styles.cell}>
					<Controller
						control={control}
						name="first_due_date"
						render={({ field }) => (
							<DateField
								label={tr.new.firstPayment}
								value={field.value}
								onChange={field.onChange}
								defaultPickerDate={addMonthsClamped(today, 1)}
								error={error("first_due_date")}
								testID="newForm.dueDate"
							/>
						)}
					/>
				</View>
			</View>

			<Controller
				control={control}
				name="period"
				render={({ field }) => (
					<SegmentedControl
						label={tr.new.frequency}
						options={PERIODS}
						value={field.value}
						onChange={field.onChange}
						testID="newForm.period"
					/>
				)}
			/>

			{/* Not in design 23: the date the down payment and the detail's "Alış tarihi" come from (ADR-059). */}
			<Controller
				control={control}
				name="started_on"
				render={({ field }) => (
					<DateField
						label={sold ? tr.new.soldOn : tr.new.purchasedOn}
						value={field.value}
						onChange={field.onChange}
						defaultPickerDate={today}
						testID="newForm.startedOn"
					/>
				)}
			/>

			<View
				style={[
					styles.card,
					{
						backgroundColor: colors.surface,
						borderColor: colors.border,
						borderRadius: radius.lg - 2,
						padding: spacing.lg,
					},
				]}
			>
				<Text style={[typography.label, { color: colors.textMuted }]}>
					{tr.new.computed}
				</Text>
				<Text style={[typography.amountL, { color: colors.text }]}>
					<Text testID="newForm.each.text">
						{split === null ? "—" : formatTRY(split.base)}
					</Text>
					<Text style={[typography.callout, { color: colors.textMuted }]}>
						{tr.new.per[values.period]}
					</Text>
				</Text>
				{split === null ? null : (
					<>
						<Text
							testID="newForm.split.text"
							style={[typography.caption, { color: colors.text, marginTop: 6 }]}
						>
							{split.last === split.base
								? fill(tr.new.splitEqual, {
										count: String(split.count),
										amount: formatTRY(split.base),
									})
								: fill(tr.new.splitLast, {
										count: String(split.count - 1),
										amount: formatTRY(split.base),
										last: formatTRY(split.last),
									})}
						</Text>
						<Text
							style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}
						>
							{fill(tr.new.splitTotal, { amount: formatTRY(split.total) })}
						</Text>
					</>
				)}
				<Pressable
					testID="newForm.editRows.button"
					accessibilityRole="button"
					accessibilityLabel={tr.new.editRows}
					onPress={() => {
						toPlan(true);
					}}
					style={[styles.row, { minHeight: sizes.minTouch, gap: 6, marginTop: 10 }]}
				>
					<Ionicons name="pencil-outline" size={16} color={colors.accent} />
					<Text style={[typography.rowTitle, { color: colors.accent }]}>
						{tr.new.editRows}
					</Text>
				</Pressable>
			</View>

			{past > 0 ? (
				<View
					accessibilityLiveRegion="polite"
					style={[
						styles.row,
						styles.top,
						{
							gap: 10,
							backgroundColor: colors.pendingSoft,
							borderRadius: radius.sm,
							paddingHorizontal: 14,
							paddingVertical: spacing.md,
						},
					]}
				>
					<Ionicons name="information-circle-outline" size={18} color={colors.pending} />
					<Text
						testID="newForm.pastNote"
						style={[typography.caption, styles.shrink, { color: colors.pending }]}
					>
						{fill(tr.new.pastNote, { count: String(past) })}
					</Text>
				</View>
			) : null}

			<Controller
				control={control}
				name="notes"
				render={({ field }) => (
					<TextField
						label={tr.new.notes}
						placeholder={tr.new.notesPlaceholder}
						value={field.value}
						onChangeText={field.onChange}
						multiline
						error={error("notes")}
						testID="newForm.notes.input"
					/>
				)}
			/>
		</Screen>
	);
}

const styles = StyleSheet.create({
	grid: { flexDirection: "row", alignItems: "flex-start" },
	cell: { flex: 1, minWidth: 0 },
	row: { flexDirection: "row", alignItems: "center" },
	top: { alignItems: "flex-start" },
	between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	shrink: { flexShrink: 1 },
	amount: { fontVariant: ["tabular-nums"] },
	card: { borderWidth: 1 },
	step: { alignItems: "center", justifyContent: "center", borderRadius: 11 },
});
