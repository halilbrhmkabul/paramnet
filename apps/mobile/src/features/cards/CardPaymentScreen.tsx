import {
	formatDateTR,
	formatTRY,
	monthName,
	transactionInputSchema,
	type IsoDate,
} from "@paramnet/shared";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useAccounts, useCard, useCreateTransaction } from "@/api/hooks";
import type { Account, CardDetail } from "@/api/types";
import { AmountInput } from "@/components/AmountInput";
import { Button } from "@/components/Button";
import { DateField } from "@/components/DateField";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { AccountPickerSheet } from "@/features/cash/AccountPickerSheet";
import { AccountIcon } from "@/features/cash/parts";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { newIdempotencyKey } from "@/lib/ids";
import { useAppTheme } from "@/theme/useAppTheme";

import { MiniCard } from "./cardParts";

type Option = "full" | "min" | "other";

function Choice({
	label,
	hint,
	amount,
	selected,
	onPress,
	testID,
}: {
	label: string;
	hint: string;
	amount: string;
	selected: boolean;
	onPress: () => void;
	testID: string;
}) {
	const { colors, typography, fonts, radius } = useAppTheme();
	return (
		<Pressable
			testID={testID}
			accessibilityRole="radio"
			accessibilityLabel={`${label}, ${amount}`}
			accessibilityState={{ checked: selected }}
			onPress={onPress}
			style={[
				styles.choice,
				{
					borderRadius: radius.md,
					backgroundColor: colors.surface,
					borderColor: selected ? colors.accent : colors.border,
					borderWidth: selected ? 2 : 1,
				},
			]}
		>
			<View
				style={[
					styles.radio,
					{ borderColor: selected ? colors.accent : colors.borderStrong },
				]}
			>
				{selected ? (
					<View style={[styles.dot, { backgroundColor: colors.accent }]} />
				) : null}
			</View>
			<View style={styles.grow}>
				<Text style={[typography.rowTitle, { color: colors.text }]}>{label}</Text>
				<Text style={[typography.caption, { color: colors.textMuted }]}>{hint}</Text>
			</View>
			<Text style={{ fontFamily: fonts.extrabold, fontSize: 16, color: colors.text }}>
				{amount}
			</Text>
		</Pressable>
	);
}

function Form({ data, accounts }: { data: CardDetail; accounts: readonly Account[] }) {
	const { colors, typography, fonts, spacing, radius } = useAppTheme();
	const today = useToday();
	const { card } = data;
	const s = card.state;
	// Before the statement is due, "the whole statement" is what is left of it; with nothing due, the period.
	const full = s.statement_remaining_minor > 0 ? s.statement_remaining_minor : s.total_debt_minor;
	const [option, setOption] = useState<Option>(full > 0 ? "full" : "other");
	const [other, setOther] = useState<number | null>(null);
	const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
	const [date, setDate] = useState<IsoDate>(today);
	const [picking, setPicking] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const key = useRef(newIdempotencyKey());
	const save = useCreateTransaction();
	const amount =
		option === "full" ? full : option === "min" ? s.minimum_remaining_minor : (other ?? 0);
	const account = accounts.find((a) => a.id === accountId);
	const remaining = Math.max(0, s.statement_remaining_minor - amount);

	function submit() {
		const parsed = transactionInputSchema.safeParse({
			kind: "transfer",
			account_id: accountId,
			to_account_id: null,
			card_id: null,
			to_card_id: card.id,
			installments: 1,
			amount_minor: amount,
			category: null,
			title: null,
			note: null,
			occurred_on: date,
		});
		if (!parsed.success) {
			setError(tr.cardPay.amountRequired);
			return;
		}
		setError(null);
		save.mutate(
			{ input: parsed.data, idempotencyKey: key.current },
			{
				onSuccess: (tx) => {
					router.replace({
						pathname: "/cards/[id]/paid",
						params: {
							id: card.id,
							tx: tx.id,
							before: String(account?.balance_minor ?? 0),
							remaining: String(remaining),
						},
					});
				},
			},
		);
	}

	return (
		<Screen
			testID="cardPay.screen"
			edges={["bottom"]}
			footer={
				<View style={{ gap: spacing.sm }}>
					{error === null && save.error === null ? null : (
						<Text
							testID="cardPay.error.text"
							accessibilityLiveRegion="polite"
							style={[typography.caption, { color: colors.overdue }]}
						>
							{error ?? messageForError(save.error)}
						</Text>
					)}
					<Button
						label={fill(tr.cardPay.submit, { amount: formatTRY(amount) })}
						loading={save.isPending}
						onPress={submit}
						testID="cardPay.submit.button"
					/>
					<Text
						style={[
							typography.caption,
							styles.center,
							{ fontSize: 12, color: colors.textMuted },
						]}
					>
						{tr.cardPay.recordNote}
					</Text>
				</View>
			}
		>
			<View style={[styles.head, { gap: 12 }]}>
				<MiniCard color={card.color} bank={card.bank_name} last4={card.last4} />
				<View style={styles.grow}>
					<Text style={{ fontFamily: fonts.extrabold, fontSize: 15, color: colors.text }}>
						{card.label}
					</Text>
					<Text style={[typography.caption, { color: colors.textMuted }]}>
						{fill(tr.cardPay.subtitle, {
							month: monthName(Number(s.last_cut.slice(5, 7))),
							date: formatDateTR(s.due_date, "dayMonth"),
						})}
					</Text>
				</View>
			</View>
			<View style={{ gap: spacing.sm }}>
				<Text style={[typography.label, { color: colors.textMuted }]}>
					{tr.cardPay.howMuch}
				</Text>
				<View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
					<Choice
						label={tr.cardPay.full}
						hint={tr.cardPay.fullHint}
						amount={formatTRY(full)}
						selected={option === "full"}
						onPress={() => {
							setOption("full");
						}}
						testID="cardPay.option.full"
					/>
					{s.minimum_remaining_minor > 0 ? (
						<Choice
							label={tr.cardPay.min}
							hint={fill(tr.cardPay.minHint, { rate: String(card.min_payment_rate) })}
							amount={formatTRY(s.minimum_remaining_minor)}
							selected={option === "min"}
							onPress={() => {
								setOption("min");
							}}
							testID="cardPay.option.min"
						/>
					) : null}
					<Choice
						label={tr.cardPay.other}
						hint={tr.cardPay.otherHint}
						amount={formatTRY(other ?? 0)}
						selected={option === "other"}
						onPress={() => {
							setOption("other");
						}}
						testID="cardPay.option.other"
					/>
				</View>
				{option === "other" ? (
					<AmountInput
						label={tr.cardPay.otherAmount}
						value={other}
						onChangeValue={setOther}
						testID="cardPay.other.input"
					/>
				) : null}
			</View>
			<View style={{ gap: spacing.sm }}>
				<Text style={[typography.label, { color: colors.textMuted }]}>
					{tr.cardPay.source}
				</Text>
				<Pressable
					testID="cardPay.account.button"
					accessibilityRole="button"
					accessibilityLabel={`${tr.txForm.account}, ${account?.name ?? ""}`}
					onPress={() => {
						setPicking(true);
					}}
					style={[
						styles.source,
						{
							gap: 12,
							borderRadius: radius.md,
							backgroundColor: colors.surface,
							borderColor: colors.border,
						},
					]}
				>
					{account === undefined ? null : <AccountIcon kind={account.kind} size={36} />}
					<View style={styles.grow}>
						<Text style={[typography.rowTitle, { color: colors.text }]}>
							{account?.name ?? tr.txForm.pickAccount}
						</Text>
						{account === undefined ? null : (
							<Text style={[typography.caption, { color: colors.textMuted }]}>
								{fill(tr.cardPay.balance, {
									amount: formatTRY(account.balance_minor),
								})}
							</Text>
						)}
					</View>
				</Pressable>
				<DateField
					label={tr.cardPay.date}
					value={date}
					onChange={setDate}
					defaultPickerDate={today}
					testID="cardPay.date"
				/>
			</View>
			<View
				style={[
					styles.summary,
					{ backgroundColor: colors.surfaceSunken, borderRadius: radius.md },
				]}
			>
				<View style={styles.kv}>
					<Text style={[typography.callout, { color: colors.textMuted }]}>
						{tr.cardPay.remaining}
					</Text>
					<Text
						testID="cardPay.remaining"
						style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.text }}
					>
						{formatTRY(remaining)}
					</Text>
				</View>
				{account === undefined ? null : (
					<View
						style={[styles.kv, { borderTopWidth: 1, borderTopColor: colors.divider }]}
					>
						<Text style={[typography.callout, { color: colors.textMuted }]}>
							{fill(tr.cardPay.after, { account: account.name })}
						</Text>
						<Text
							testID="cardPay.after"
							style={{
								fontFamily: fonts.extrabold,
								fontSize: 14,
								color: colors.text,
							}}
						>
							{formatTRY(account.balance_minor - amount)}
						</Text>
					</View>
				)}
			</View>
			{option !== "full" && remaining > 0 ? (
				<View
					testID="cardPay.partialNote"
					style={[
						styles.warn,
						{ backgroundColor: colors.warningSoft, borderRadius: radius.sm },
					]}
				>
					<Text style={[typography.caption, { color: colors.warning }]}>
						{tr.cardPay.partialNote}
					</Text>
				</View>
			) : null}
			<AccountPickerSheet
				visible={picking}
				title={tr.txForm.account}
				accounts={accounts}
				selectedId={accountId}
				onSelect={(a) => {
					setAccountId(a.id);
					setPicking(false);
				}}
				onClose={() => {
					setPicking(false);
				}}
			/>
		</Screen>
	);
}

// Design 09: a card payment is a transfer from an account; it is never an expense (ADR-055).
export function CardPaymentScreen({ id }: { id: string }) {
	const detail = useCard(id);
	const accounts = useAccounts();
	if (detail.isPending || accounts.isPending) {
		return (
			<Screen testID="cardPay.screen" edges={["bottom"]}>
				<LoadingState rows={4} testID="cardPay.loading" />
			</Screen>
		);
	}
	if (detail.isError || accounts.isError) {
		return (
			<Screen testID="cardPay.screen" edges={["bottom"]}>
				<ErrorState
					message={messageForError(detail.error ?? accounts.error)}
					onRetry={() => {
						void detail.refetch();
						void accounts.refetch();
					}}
					testID="cardPay.error"
				/>
			</Screen>
		);
	}
	if (accounts.data.accounts.length === 0) {
		return (
			<Screen testID="cardPay.screen" edges={["bottom"]}>
				<EmptyState
					title={tr.txForm.noAccountTitle}
					body={tr.txForm.noAccountBody}
					actionLabel={tr.accounts.add}
					onAction={() => {
						router.replace("/accounts/new");
					}}
					testID="cardPay.noAccount"
				/>
			</Screen>
		);
	}
	return <Form data={detail.data} accounts={accounts.data.accounts} />;
}

const styles = StyleSheet.create({
	grow: { flex: 1, minWidth: 0 },
	center: { textAlign: "center" },
	head: { flexDirection: "row", alignItems: "center" },
	choice: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 14,
		minHeight: 64,
	},
	radio: {
		width: 22,
		height: 22,
		borderRadius: 11,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
	},
	dot: { width: 10, height: 10, borderRadius: 5 },
	source: {
		flexDirection: "row",
		alignItems: "center",
		borderWidth: 1,
		paddingHorizontal: 16,
		paddingVertical: 12,
		minHeight: 60,
	},
	summary: { paddingHorizontal: 16, paddingVertical: 4 },
	kv: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 11,
		gap: 12,
	},
	warn: { paddingHorizontal: 14, paddingVertical: 12 },
});
