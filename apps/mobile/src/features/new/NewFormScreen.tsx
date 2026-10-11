import { addMonthsClamped, type PlanPeriod } from "@paramnet/shared";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Controller, useForm, useWatch, type FieldErrors, type Resolver } from "react-hook-form";
import { Pressable, Text, View } from "react-native";

import { ContactPickerSheet } from "./ContactPickerSheet";
import { useNewDraft } from "./draftStore";
import {
	NEW_TYPES,
	defaultValues,
	usesInstallments,
	validateForm,
	type NewFormValues,
	type NewType,
} from "./formModel";
import { AmountInput } from "@/components/AmountInput";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { DateField } from "@/components/DateField";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TextField } from "@/components/TextField";
import { messageForCode } from "@/features/forms/fieldError";
import { useToday } from "@/lib/clock";
import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

const TITLES: Record<NewType, string> = {
	lent: tr.new.lent,
	borrowed: tr.new.borrowed,
	boughtInstallment: tr.new.boughtInstallment,
	soldInstallment: tr.new.soldInstallment,
};

const PERIODS: { value: PlanPeriod; label: string }[] = [
	{ value: "monthly", label: tr.new.periodMonthly },
	{ value: "weekly", label: tr.new.periodWeekly },
	{ value: "biweekly", label: tr.new.periodBiweekly },
];

// react-hook-form owns the state; the rules (including the plan rules) come from formModel / @paramnet/shared.
function resolverFor(type: NewType): Resolver<NewFormValues> {
	return (values) => {
		const codes = validateForm(type, values);
		const entries = Object.entries(codes);
		if (entries.length === 0) {
			return { values, errors: {} };
		}
		const errors: FieldErrors<NewFormValues> = {};
		for (const [field, code] of entries) {
			errors[field as keyof NewFormValues] = { type: "validate", message: code };
		}
		return { values: {}, errors };
	};
}

export function NewFormScreen() {
	const type = useNewDraft((state) => state.type);
	if (type === null) {
		return <Redirect href="/new" />;
	}
	return <NewForm type={type} />;
}

function NewForm({ type }: { type: NewType }) {
	const { colors, typography, radius, spacing, sizes } = useAppTheme();
	const today = useToday();
	const draft = useNewDraft();
	const config = NEW_TYPES[type];
	const [pickerOpen, setPickerOpen] = useState(false);
	const { control, handleSubmit, setValue, formState } = useForm<NewFormValues>({
		defaultValues: draft.values ?? defaultValues(today),
		resolver: resolverFor(type),
		reValidateMode: "onChange",
	});
	// defaultValues sets every field, so the watched object is never partial.
	const values = useWatch({ control }) as NewFormValues;
	const installments = usesInstallments(type, values);
	const error = (field: keyof NewFormValues) => {
		const message = formState.errors[field]?.message;
		return message === undefined ? undefined : messageForCode(message);
	};
	const contactLabel =
		type === "boughtInstallment"
			? tr.new.seller
			: type === "soldInstallment"
				? tr.new.buyer
				: tr.new.person;

	return (
		<Screen
			testID="newForm.screen"
			edges={["top", "bottom"]}
			footer={
				<Button
					label={tr.new.toPlan}
					onPress={() => {
						void handleSubmit((valid) => {
							draft.setValues(valid);
							router.push("/new/plan");
						})();
					}}
					testID="newForm.submit.button"
				/>
			}
		>
			<ScreenTitle>{TITLES[type]}</ScreenTitle>

			<View style={{ gap: spacing.xs }}>
				<Text style={[typography.callout, { color: colors.textMuted }]}>
					{contactLabel}
				</Text>
				<Pressable
					testID="newForm.contact.picker"
					accessibilityRole="button"
					accessibilityLabel={`${contactLabel}: ${values.contact_label === "" ? tr.new.choosePerson : values.contact_label}`}
					onPress={() => {
						setPickerOpen(true);
					}}
					style={{
						minHeight: sizes.minTouch,
						justifyContent: "center",
						borderWidth: 1,
						borderRadius: radius.sm,
						borderColor:
							error("contact") === undefined ? colors.border : colors.overdue,
						backgroundColor: colors.surface,
						paddingHorizontal: spacing.md,
					}}
				>
					<Text
						style={[
							typography.body,
							{ color: values.contact === null ? colors.textMuted : colors.text },
						]}
					>
						{values.contact === null ? tr.new.choosePerson : values.contact_label}
					</Text>
				</Pressable>
				{error("contact") !== undefined ? (
					<Text style={[typography.caption, { color: colors.overdue }]}>
						{error("contact")}
					</Text>
				) : null}
			</View>
			<ContactPickerSheet
				visible={pickerOpen}
				newContactKind={type === "boughtInstallment" ? "merchant" : "person"}
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

			{config.purchase ? (
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
			) : null}

			{config.purchase ? null : (
				<Controller
					control={control}
					name="started_on"
					render={({ field }) => (
						<DateField
							label={
								type === "lent" ? tr.new.startedOnLent : tr.new.startedOnBorrowed
							}
							value={field.value}
							onChange={field.onChange}
							defaultPickerDate={today}
							testID="newForm.startedOn"
						/>
					)}
				/>
			)}

			<Controller
				control={control}
				name="amount_minor"
				render={({ field }) => (
					<AmountInput
						label={config.purchase ? tr.new.total : tr.new.amount}
						value={field.value}
						onChangeValue={field.onChange}
						error={error("amount_minor")}
						testID="newForm.amount.input"
					/>
				)}
			/>

			{config.purchase ? (
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
			) : (
				<Controller
					control={control}
					name="repayment"
					render={({ field }) => (
						<SegmentedControl
							label={tr.new.repayment}
							options={[
								{ value: "once", label: tr.new.repaymentOnce },
								{ value: "installments", label: tr.new.repaymentInstallments },
							]}
							value={field.value}
							onChange={(value) => {
								field.onChange(value);
								// An installment plan always needs a first date (spec 5.2: only one-off may be open-ended).
								if (value === "installments" && values.first_due_date === null) {
									setValue("first_due_date", addMonthsClamped(today, 1));
								}
							}}
							testID="newForm.repayment"
						/>
					)}
				/>
			)}

			{installments ? (
				<>
					<Controller
						control={control}
						name="count"
						render={({ field }) => (
							<TextField
								label={tr.new.count}
								value={field.value}
								onChangeText={(text) => {
									field.onChange(text.replace(/\D/g, "").slice(0, 3));
								}}
								keyboardType="number-pad"
								error={error("count")}
								testID="newForm.count.input"
							/>
						)}
					/>
					<Controller
						control={control}
						name="period"
						render={({ field }) => (
							<SegmentedControl
								label={tr.new.period}
								options={PERIODS}
								value={field.value}
								onChange={field.onChange}
								testID="newForm.period"
							/>
						)}
					/>
				</>
			) : null}

			<Controller
				control={control}
				name="first_due_date"
				render={({ field }) => (
					<DateField
						label={installments ? tr.new.firstDueDate : tr.new.dueDate}
						value={field.value}
						onChange={field.onChange}
						emptyText={installments ? tr.new.chooseDate : tr.new.noDueDate}
						defaultPickerDate={addMonthsClamped(today, 1)}
						error={error("first_due_date")}
						testID="newForm.dueDate"
					/>
				)}
			/>
			{installments ? null : (
				<Checkbox
					label={tr.new.noDueDate}
					checked={values.first_due_date === null}
					onChange={(checked) => {
						setValue("first_due_date", checked ? null : addMonthsClamped(today, 1));
					}}
					testID="newForm.noDueDate.checkbox"
				/>
			)}

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
