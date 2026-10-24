import {
	EXPENSE_CATEGORIES,
	INCOME_CATEGORIES,
	formatSignedTRY,
	transactionInputSchema,
	type IsoDate,
	type TransactionCategory,
} from "@paramnet/shared";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { messageForError } from "@/api/errors";
import {
	useAccounts,
	useCreateTransaction,
	useTransaction,
	useUpdateTransaction,
} from "@/api/hooks";
import type { Account, Transaction } from "@/api/types";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { DateField } from "@/components/DateField";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TextField } from "@/components/TextField";
import { IconButton } from "@/components/TopBar";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { newIdempotencyKey } from "@/lib/ids";
import { useAppTheme } from "@/theme/useAppTheme";

import { AccountPickerSheet } from "./AccountPickerSheet";
import { amountOf, categoryLabel, keypadText, pressKey } from "./cashModel";

export type FormKind = "expense" | "income" | "transfer";

const KINDS: readonly FormKind[] = ["expense", "income", "transfer"];
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "del"] as const;

function categoriesOf(kind: FormKind): readonly TransactionCategory[] {
	return kind === "income" ? INCOME_CATEGORIES : kind === "expense" ? EXPENSE_CATEGORIES : [];
}

function MetaButton({
	label,
	value,
	onPress,
	testID,
}: {
	label: string;
	value: string;
	onPress: () => void;
	testID: string;
}) {
	const { colors, fonts, radius } = useAppTheme();
	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={`${label}, ${value}`}
			onPress={onPress}
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
				{label}
			</Text>
			<Text
				numberOfLines={1}
				style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.text }}
			>
				{value}
			</Text>
		</Pressable>
	);
}

function Keypad({ onKey }: { onKey: (key: string) => void }) {
	const { colors, fonts, radius } = useAppTheme();
	return (
		<View style={styles.pad}>
			{KEYS.map((key) => (
				<Pressable
					key={key}
					testID={`txForm.key.${key === "," ? "comma" : key}`}
					accessibilityRole="button"
					accessibilityLabel={key === "del" ? tr.txForm.keyDelete : key}
					onPress={() => {
						onKey(key);
					}}
					style={({ pressed }) => [
						styles.key,
						{
							borderRadius: radius.sm,
							backgroundColor: pressed ? colors.surfaceSunken : colors.surface,
							borderColor: colors.divider,
						},
					]}
				>
					<Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.text }}>
						{key === "del" ? "⌫" : key}
					</Text>
				</Pressable>
			))}
		</View>
	);
}

type Picking = "account" | "to" | null;

function Form({
	accounts,
	initialKind,
	initialAccountId,
	editing,
}: {
	accounts: readonly Account[];
	initialKind: FormKind;
	initialAccountId: string | null;
	editing: Transaction | null;
}) {
	const { colors, typography, fonts, spacing, sizes } = useAppTheme();
	const today = useToday();
	const first = accounts.find((a) => a.id === initialAccountId) ?? accounts[0];
	const [kind, setKind] = useState<FormKind>(initialKind);
	const [text, setText] = useState(editing === null ? "" : keypadText(editing.amount_minor));
	const [category, setCategory] = useState<TransactionCategory | null>(
		editing?.category ?? categoriesOf(initialKind)[0] ?? null,
	);
	const [accountId, setAccountId] = useState(editing?.account_id ?? first?.id ?? null);
	const [toId, setToId] = useState<string | null>(
		editing?.to_account_id ?? accounts.find((a) => a.id !== (first?.id ?? null))?.id ?? null,
	);
	const [date, setDate] = useState<IsoDate>(editing?.occurred_on ?? today);
	const [title, setTitle] = useState(editing?.title ?? "");
	const [note, setNote] = useState(editing?.note ?? "");
	const [picking, setPicking] = useState<Picking>(null);
	const [formError, setFormError] = useState<string | null>(null);
	const key = useRef(newIdempotencyKey());
	const create = useCreateTransaction();
	const update = useUpdateTransaction();
	const saving = create.isPending || update.isPending;
	const serverError = create.error ?? update.error;

	const amount = amountOf(text);
	const sign = kind === "expense" ? "minus" : kind === "income" ? "plus" : "none";
	// The keypad shows what was typed; a lone "350," still reads 350,00.
	const shown = formatSignedTRY(amount ?? 0, sign);
	const nameOf = (id: string | null) =>
		accounts.find((a) => a.id === id)?.name ?? tr.txForm.pickAccount;
	const needTwo = kind === "transfer" && accounts.length < 2;

	function changeKind(next: FormKind) {
		setKind(next);
		const options = categoriesOf(next);
		setCategory((current) =>
			current !== null && options.includes(current) ? current : (options[0] ?? null),
		);
		setFormError(null);
	}

	function submit() {
		const parsed = transactionInputSchema.safeParse({
			kind,
			account_id: accountId,
			to_account_id: kind === "transfer" ? toId : null,
			amount_minor: amount ?? 0,
			category: kind === "transfer" ? null : category,
			title,
			note,
			occurred_on: date,
		});
		if (!parsed.success) {
			const issue = parsed.error.issues[0];
			setFormError(
				issue?.path[0] === "amount_minor"
					? tr.txForm.amountRequired
					: issue?.message === "same_account"
						? tr.txForm.sameAccount
						: tr.error.validation,
			);
			return;
		}
		setFormError(null);
		const done = () => {
			router.back();
		};
		if (editing === null) {
			create.mutate({ input: parsed.data, idempotencyKey: key.current }, { onSuccess: done });
		} else {
			update.mutate(
				{ id: editing.id, input: parsed.data, rowVersion: editing.row_version },
				{ onSuccess: done },
			);
		}
	}

	const message = formError ?? (serverError === null ? null : messageForError(serverError));

	return (
		<SafeAreaView
			testID="txForm.screen"
			edges={["top", "bottom"]}
			style={{ flex: 1, backgroundColor: colors.bg }}
		>
			<View style={[styles.bar, { paddingHorizontal: sizes.screenPadding, gap: spacing.sm }]}>
				<IconButton
					icon="close"
					label={tr.common.close}
					onPress={() => {
						router.back();
					}}
					testID="txForm.close.button"
				/>
				<View style={styles.grow}>
					<SegmentedControl
						label={tr.txForm.kindLabel}
						hideLabel
						options={KINDS.map((value) => ({ value, label: tr.txForm.kinds[value] }))}
						value={kind}
						onChange={changeKind}
						testID="txForm.kind"
					/>
				</View>
			</View>
			<ScrollView
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md }}
			>
				<View style={[styles.center, { paddingHorizontal: sizes.screenPadding }]}>
					<Text style={[typography.label, { color: colors.textMuted }]}>
						{editing === null ? tr.txForm.amountLabel[kind] : tr.txForm.editTitle}
					</Text>
					<Text
						testID="txForm.amount.text"
						accessibilityLabel={fill(tr.txForm.amountA11y, { amount: shown })}
						maxFontSizeMultiplier={sizes.maxAmountFontScale}
						style={{
							fontFamily: fonts.extrabold,
							fontSize: 44,
							letterSpacing: -1,
							color: kind === "income" ? colors.receivable : colors.text,
							fontVariant: ["tabular-nums"],
						}}
					>
						{shown}
					</Text>
				</View>

				{kind === "transfer" ? null : (
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						accessibilityRole="radiogroup"
						accessibilityLabel={tr.txForm.category}
						contentContainerStyle={{
							gap: spacing.sm,
							paddingHorizontal: sizes.screenPadding,
						}}
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
								testID={`txForm.category.${option}`}
							/>
						))}
					</ScrollView>
				)}

				<View style={{ paddingHorizontal: sizes.screenPadding, gap: spacing.md }}>
					<View style={[styles.metaRow, { gap: spacing.sm }]}>
						<MetaButton
							label={kind === "transfer" ? tr.txForm.from : tr.txForm.account}
							value={nameOf(accountId)}
							onPress={() => {
								setPicking("account");
							}}
							testID="txForm.account.button"
						/>
						{kind === "transfer" ? (
							<MetaButton
								label={tr.txForm.to}
								value={nameOf(toId)}
								onPress={() => {
									setPicking("to");
								}}
								testID="txForm.to.button"
							/>
						) : null}
					</View>
					{needTwo ? (
						<Text style={[typography.caption, { color: colors.warning }]}>
							{tr.txForm.needTwo}
						</Text>
					) : null}
					<Keypad
						onKey={(pressed) => {
							setText((current) => pressKey(current, pressed));
						}}
					/>
					<DateField
						label={tr.txForm.date}
						value={date}
						onChange={setDate}
						defaultPickerDate={today}
						testID="txForm.date"
					/>
					<TextField
						label={tr.txForm.description}
						value={title}
						onChangeText={setTitle}
						placeholder={tr.txForm.descriptionPlaceholder}
						maxLength={80}
						testID="txForm.description.input"
					/>
					<TextField
						label={tr.txForm.note}
						value={note}
						onChangeText={setNote}
						maxLength={500}
						testID="txForm.note.input"
					/>
				</View>
			</ScrollView>
			<View
				style={{
					paddingHorizontal: sizes.screenPadding,
					paddingBottom: spacing.lg,
					gap: spacing.sm,
				}}
			>
				{message === null ? null : (
					<Text
						testID="txForm.error.text"
						accessibilityLiveRegion="polite"
						style={[typography.caption, { color: colors.overdue }]}
					>
						{message}
					</Text>
				)}
				<Button
					label={tr.txForm.save}
					loading={saving}
					disabled={needTwo}
					onPress={submit}
					testID="txForm.save.button"
				/>
			</View>
			<AccountPickerSheet
				visible={picking !== null}
				title={
					picking === "to"
						? tr.txForm.to
						: kind === "transfer"
							? tr.txForm.from
							: tr.txForm.account
				}
				accounts={accounts}
				selectedId={picking === "to" ? toId : accountId}
				onSelect={(account) => {
					if (picking === "to") {
						setToId(account.id);
					} else {
						setAccountId(account.id);
					}
					setPicking(null);
				}}
				onClose={() => {
					setPicking(null);
				}}
			/>
		</SafeAreaView>
	);
}

function Shell({ children, testID }: { children: React.ReactNode; testID: string }) {
	const { colors, sizes, spacing } = useAppTheme();
	return (
		<SafeAreaView
			testID="txForm.screen"
			edges={["top", "bottom"]}
			style={{
				flex: 1,
				backgroundColor: colors.bg,
				padding: sizes.screenPadding,
				gap: spacing.lg,
			}}
		>
			<IconButton
				icon="close"
				label={tr.common.close}
				onPress={() => {
					router.back();
				}}
				testID={`${testID}.close.button`}
			/>
			{children}
		</SafeAreaView>
	);
}

// Design 22: Gider / Gelir / Transfer. The record needs one of the user's open accounts.
export function TransactionFormScreen({
	kind,
	accountId,
	editId,
}: {
	kind: FormKind;
	accountId: string | null;
	editId: string | null;
}) {
	const accounts = useAccounts();
	const editing = useTransaction(editId);
	if (accounts.isPending || (editId !== null && editing.isPending)) {
		return (
			<Shell testID="txForm">
				<LoadingState rows={4} testID="txForm.loading" />
			</Shell>
		);
	}
	if (accounts.isError || (editId !== null && editing.isError)) {
		const error = accounts.error ?? editing.error;
		return (
			<Shell testID="txForm">
				<ErrorState
					message={messageForError(error)}
					onRetry={() => {
						void accounts.refetch();
						if (editId !== null) {
							void editing.refetch();
						}
					}}
					testID="txForm.error"
				/>
			</Shell>
		);
	}
	const open = accounts.data.accounts;
	if (open.length === 0 && editId === null) {
		return (
			<Shell testID="txForm">
				<EmptyState
					title={tr.txForm.noAccountTitle}
					body={tr.txForm.noAccountBody}
					actionLabel={tr.accounts.add}
					onAction={() => {
						router.replace("/accounts/new");
					}}
					actionTestID="txForm.noAccount.action"
					testID="txForm.noAccount"
				/>
			</Shell>
		);
	}
	const tx = editId === null ? null : (editing.data?.transaction ?? null);
	const formKind: FormKind = tx !== null && tx.kind !== "adjustment" ? tx.kind : kind;
	return (
		<Form accounts={open} initialKind={formKind} initialAccountId={accountId} editing={tx} />
	);
}

const styles = StyleSheet.create({
	bar: { flexDirection: "row", alignItems: "center", paddingTop: 12, paddingBottom: 8 },
	grow: { flex: 1 },
	center: { alignItems: "center", gap: 6, paddingVertical: 12 },
	metaRow: { flexDirection: "row" },
	meta: {
		flex: 1,
		minHeight: 52,
		borderWidth: 1,
		paddingHorizontal: 14,
		justifyContent: "center",
	},
	pad: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
	key: {
		width: "31.8%",
		flexGrow: 1,
		height: 56,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
	},
});
