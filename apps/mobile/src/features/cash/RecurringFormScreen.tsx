import {
	EXPENSE_CATEGORIES,
	INCOME_CATEGORIES,
	RECURRENCE_FREQUENCIES,
	addDays,
	formatDateTR,
	nextOccurrences,
	recurringInputSchema,
	type IsoDate,
	type RecurrenceFrequency,
	type TransactionCategory,
} from "@paramnet/shared";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import {
	useAccounts,
	useCreateRecurring,
	useDeleteRecurring,
	useRecurring,
	useSetRecurringPaused,
	useUpdateRecurring,
} from "@/api/hooks";
import type { Account, RecurringRule } from "@/api/types";
import { AmountInput } from "@/components/AmountInput";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { DateField } from "@/components/DateField";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TextField } from "@/components/TextField";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { newIdempotencyKey } from "@/lib/ids";
import { useAppTheme } from "@/theme/useAppTheme";

import { AccountPickerSheet } from "./AccountPickerSheet";
import { categoryLabel } from "./cashModel";
import { Toggle } from "./AccountFormScreen";
import { ConfirmSheet } from "./parts";

type Kind = "expense" | "income";

function categoriesOf(kind: Kind): readonly TransactionCategory[] {
	return kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

function Form({ accounts, rule }: { accounts: readonly Account[]; rule: RecurringRule | null }) {
	const { colors, typography, fonts, spacing, radius } = useAppTheme();
	const today = useToday();
	const [kind, setKind] = useState<Kind>(rule?.kind ?? "expense");
	const [name, setName] = useState(rule?.name ?? "");
	const [amount, setAmount] = useState<number | null>(rule?.amount_minor ?? null);
	const [category, setCategory] = useState<TransactionCategory>(
		rule?.category ?? EXPENSE_CATEGORIES[0],
	);
	const [accountId, setAccountId] = useState(rule?.account_id ?? accounts[0]?.id ?? "");
	const [frequency, setFrequency] = useState<RecurrenceFrequency>(rule?.frequency ?? "monthly");
	const [start, setStart] = useState<IsoDate>(rule?.start_on ?? today);
	const [confirmEach, setConfirmEach] = useState(rule?.confirm_each ?? true);
	const [picking, setPicking] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const key = useRef(newIdempotencyKey());
	const create = useCreateRecurring();
	const update = useUpdateRecurring();
	const pause = useSetRecurringPaused();
	const remove = useDeleteRecurring();
	const saving = create.isPending || update.isPending;
	const serverError = create.error ?? update.error ?? pause.error ?? remove.error;
	const next = nextOccurrences(start, frequency, start > today ? start : addDays(today, 1), 3);

	function changeKind(value: Kind) {
		setKind(value);
		setCategory((current) =>
			categoriesOf(value).includes(current) ? current : (categoriesOf(value)[0] ?? current),
		);
	}

	function submit() {
		const parsed = recurringInputSchema.safeParse({
			kind,
			name,
			amount_minor: amount ?? 0,
			category,
			account_id: accountId,
			frequency,
			start_on: start,
			confirm_each: confirmEach,
		});
		if (!parsed.success) {
			const field = parsed.error.issues[0]?.path[0];
			setFormError(
				field === "name"
					? tr.recurring.nameRequired
					: field === "amount_minor"
						? tr.recurring.amountRequired
						: tr.error.validation,
			);
			return;
		}
		setFormError(null);
		const done = () => {
			router.back();
		};
		if (rule === null) {
			create.mutate({ input: parsed.data, idempotencyKey: key.current }, { onSuccess: done });
		} else {
			update.mutate(
				{ id: rule.id, input: parsed.data, rowVersion: rule.row_version },
				{ onSuccess: done },
			);
		}
	}

	const message = formError ?? (serverError === null ? null : messageForError(serverError));

	return (
		<Screen
			testID="recurringForm.screen"
			edges={["bottom"]}
			footer={
				<View style={{ gap: spacing.sm }}>
					{message === null ? null : (
						<Text
							testID="recurringForm.error.text"
							accessibilityLiveRegion="polite"
							style={[typography.caption, { color: colors.overdue }]}
						>
							{message}
						</Text>
					)}
					<Button
						label={tr.recurring.save}
						loading={saving}
						onPress={submit}
						testID="recurringForm.save.button"
					/>
				</View>
			}
		>
			<SegmentedControl
				label={tr.recurring.kind}
				options={(["expense", "income"] as const).map((value) => ({
					value,
					label: tr.recurring.kinds[value],
				}))}
				value={kind}
				onChange={changeKind}
				testID="recurringForm.kind"
			/>
			<TextField
				label={tr.recurring.name}
				value={name}
				onChangeText={setName}
				placeholder={tr.recurring.namePlaceholder}
				maxLength={80}
				testID="recurringForm.name.input"
			/>
			<AmountInput
				label={tr.recurring.amount}
				value={amount}
				onChangeValue={setAmount}
				testID="recurringForm.amount.input"
			/>
			<View style={{ gap: spacing.xs }}>
				<Text style={[typography.label, { color: colors.textMuted }]}>
					{tr.txForm.category}
				</Text>
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					accessibilityRole="radiogroup"
					contentContainerStyle={{ gap: spacing.sm }}
				>
					{categoriesOf(kind).map((option) => (
						<Chip
							key={option}
							label={categoryLabel({ kind, category: option }) ?? option}
							selected={option === category}
							role="radio"
							onPress={() => {
								setCategory(option);
							}}
							testID={`recurringForm.category.${option}`}
						/>
					))}
				</ScrollView>
			</View>
			<Pressable
				testID="recurringForm.account.button"
				accessibilityRole="button"
				accessibilityLabel={`${tr.txForm.account}, ${accounts.find((a) => a.id === accountId)?.name ?? ""}`}
				onPress={() => {
					setPicking(true);
				}}
				style={[
					styles.meta,
					{
						borderRadius: radius.sm,
						backgroundColor: colors.surface,
						borderColor: colors.border,
					},
				]}
			>
				<Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.textMuted }}>
					{tr.txForm.account}
				</Text>
				<Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.text }}>
					{accounts.find((a) => a.id === accountId)?.name ?? tr.txForm.pickAccount}
				</Text>
			</Pressable>
			<View style={{ gap: spacing.xs }}>
				<Text style={[typography.label, { color: colors.textMuted }]}>
					{tr.recurring.frequency}
				</Text>
				<View accessibilityRole="radiogroup" style={[styles.row, { gap: spacing.sm }]}>
					{RECURRENCE_FREQUENCIES.map((option) => (
						<View key={option} style={styles.grow}>
							<Chip
								label={tr.recurring.frequencies[option]}
								selected={option === frequency}
								role="radio"
								onPress={() => {
									setFrequency(option);
								}}
								testID={`recurringForm.frequency.${option}`}
							/>
						</View>
					))}
				</View>
			</View>
			<DateField
				label={tr.recurring.start}
				value={start}
				onChange={setStart}
				defaultPickerDate={today}
				testID="recurringForm.start"
			/>
			<View style={{ gap: spacing.xs }}>
				<Text style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}>
					{tr.recurring.next}
				</Text>
				<View testID="recurringForm.next" style={[styles.row, { gap: spacing.sm }]}>
					{next.map((date) => (
						<View
							key={date}
							style={[
								styles.next,
								{ backgroundColor: colors.surfaceSunken, borderRadius: 12 },
							]}
						>
							<Text
								style={{
									fontFamily: fonts.extrabold,
									fontSize: 14,
									color: colors.text,
								}}
							>
								{formatDateTR(date, "dayMonth")}
							</Text>
							<Text
								style={{
									fontFamily: fonts.bold,
									fontSize: 12,
									color: colors.textMuted,
								}}
							>
								{date.slice(0, 4)}
							</Text>
						</View>
					))}
				</View>
			</View>
			<Toggle
				label={tr.recurring.confirmEach}
				hint={tr.recurring.confirmEachHint}
				value={confirmEach}
				onChange={setConfirmEach}
				testID="recurringForm.confirm.switch"
			/>
			{rule === null ? null : (
				<View style={[styles.row, { gap: spacing.sm }]}>
					<View style={styles.grow}>
						<Button
							label={
								rule.paused_at === null ? tr.recurring.pause : tr.recurring.resume
							}
							variant="secondary"
							loading={pause.isPending}
							onPress={() => {
								pause.mutate(
									{
										id: rule.id,
										paused: rule.paused_at === null,
										rowVersion: rule.row_version,
									},
									{
										onSuccess: () => {
											router.back();
										},
									},
								);
							}}
							testID="recurringForm.pause.button"
						/>
					</View>
					<View style={styles.grow}>
						<Button
							label={tr.recurring.delete}
							variant="danger"
							onPress={() => {
								setDeleteOpen(true);
							}}
							testID="recurringForm.delete.button"
						/>
					</View>
				</View>
			)}
			<AccountPickerSheet
				visible={picking}
				title={tr.txForm.account}
				accounts={accounts}
				selectedId={accountId}
				onSelect={(account) => {
					setAccountId(account.id);
					setPicking(false);
				}}
				onClose={() => {
					setPicking(false);
				}}
			/>
			{rule === null ? null : (
				<ConfirmSheet
					visible={deleteOpen}
					title={tr.recurring.deleteTitle}
					body={fill(tr.recurring.deleteBody, { name: rule.name })}
					confirmLabel={tr.recurring.delete}
					busy={remove.isPending}
					onCancel={() => {
						setDeleteOpen(false);
					}}
					onConfirm={() => {
						remove.mutate(
							{ id: rule.id, rowVersion: rule.row_version },
							{
								onSuccess: () => {
									setDeleteOpen(false);
									router.back();
								},
								onError: () => {
									setDeleteOpen(false);
								},
							},
						);
					}}
					testID="recurringForm.delete.sheet"
				/>
			)}
		</Screen>
	);
}

// Design 38's form, as its own screen so the list stays short (ADR-054).
export function RecurringFormScreen({ id }: { id: string | null }) {
	const accounts = useAccounts();
	const rules = useRecurring();
	if (accounts.isPending || (id !== null && rules.isPending)) {
		return (
			<Screen testID="recurringForm.screen" edges={["bottom"]}>
				<LoadingState rows={4} testID="recurringForm.loading" />
			</Screen>
		);
	}
	if (accounts.isError || (id !== null && rules.isError)) {
		return (
			<Screen testID="recurringForm.screen" edges={["bottom"]}>
				<ErrorState
					message={messageForError(accounts.error ?? rules.error)}
					onRetry={() => {
						void accounts.refetch();
						void rules.refetch();
					}}
					testID="recurringForm.error"
				/>
			</Screen>
		);
	}
	if (accounts.data.accounts.length === 0) {
		return (
			<Screen testID="recurringForm.screen" edges={["bottom"]}>
				<EmptyState
					title={tr.txForm.noAccountTitle}
					body={tr.txForm.noAccountBody}
					actionLabel={tr.accounts.add}
					onAction={() => {
						router.replace("/accounts/new");
					}}
					actionTestID="recurringForm.noAccount.action"
					testID="recurringForm.noAccount"
				/>
			</Screen>
		);
	}
	const rule = id === null ? null : (rules.data?.find((r) => r.id === id) ?? null);
	if (id !== null && rule === null) {
		return (
			<Screen testID="recurringForm.screen" edges={["bottom"]}>
				<ErrorState
					message={tr.error.notFound}
					onRetry={() => {
						void rules.refetch();
					}}
					testID="recurringForm.error"
				/>
			</Screen>
		);
	}
	return <Form accounts={accounts.data.accounts} rule={rule} />;
}

const styles = StyleSheet.create({
	grow: { flex: 1 },
	row: { flexDirection: "row" },
	meta: { minHeight: 52, borderWidth: 1, paddingHorizontal: 14, justifyContent: "center" },
	next: { flex: 1, height: 52, alignItems: "center", justifyContent: "center" },
});
