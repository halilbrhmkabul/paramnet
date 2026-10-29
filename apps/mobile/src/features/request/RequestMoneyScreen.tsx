import { addDays, addMonthsClamped, formatDateTR, formatTRY, type IsoDate } from "@paramnet/shared";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useMyProfile, useParamnetIdLookup, useRequestMoney } from "@/api/hooks";
import { AmountInput } from "@/components/AmountInput";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { Chip } from "@/components/Chip";
import { DateField } from "@/components/DateField";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { idInputState } from "@/features/agreement/ShareScreen";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { newIdempotencyKey } from "@/lib/ids";
import { useAppTheme } from "@/theme/useAppTheme";

type DueChoice = "twoWeeks" | "oneMonth" | "date";

// Design 18–19: whom to ask, how much, until when; then a preview to confirm (ADR-058).
export function RequestMoneyScreen() {
	const { colors, typography, fonts, spacing, radius } = useAppTheme();
	const today = useToday();
	const me = useMyProfile();
	const [step, setStep] = useState<1 | 2>(1);
	const [input, setInput] = useState("");
	const [amount, setAmount] = useState<number | null>(null);
	const [choice, setChoice] = useState<DueChoice>("oneMonth");
	const [date, setDate] = useState<IsoDate>(addMonthsClamped(today, 1));
	const [note, setNote] = useState("");
	const [consent, setConsent] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const key = useRef(newIdempotencyKey());
	const request = useRequestMoney();

	const idState = idInputState(input);
	const id = typeof idState === "object" ? idState.id : null;
	const lookup = useParamnetIdLookup(id);
	const found = lookup.data?.status === "found" ? lookup.data : null;
	const due =
		choice === "twoWeeks"
			? addDays(today, 14)
			: choice === "oneMonth"
				? addMonthsClamped(today, 1)
				: date;
	const lender = found?.display_name ?? tr.request.someone;

	function next() {
		if (found === null) {
			setError(lookup.data?.status === "not_found" ? tr.request.notFound : tr.request.needId);
			return;
		}
		if (amount === null || amount <= 0) {
			setError(tr.request.needAmount);
			return;
		}
		setError(null);
		setStep(2);
	}

	function send() {
		if (found === null || amount === null) {
			return;
		}
		if (!consent) {
			setError(tr.request.needConsent);
			return;
		}
		setError(null);
		request.mutate(
			{
				input: {
					kind: "loan",
					creator_role: "debtor",
					title: tr.request.recordTitle,
					description: note.trim() === "" ? null : note.trim(),
					started_on: null,
					counterparty: {
						contact: {
							display_name: found.display_name,
							phone_e164: null,
							kind: "person",
						},
					},
					terms: {
						principal_minor: amount,
						down_payment_minor: 0,
						notes: null,
						plan: [{ seq: 1, due_date: due, amount_minor: amount }],
					},
				},
				paramnetId: found.paramnet_id,
				idempotencyKey: key.current,
			},
			{
				onSuccess: (result) => {
					router.replace({
						pathname: "/request/sent",
						params: {
							agreement: result.agreement_id,
							name: found.display_name,
							id: found.paramnet_id,
							amount: String(amount),
							due,
						},
					});
				},
			},
		);
	}

	const message =
		error ?? (request.error === null ? null : messageForError(request.error, "paramnetId"));
	const footer = (
		<View style={{ gap: spacing.sm }}>
			{message === null ? null : (
				<Text
					testID="request.error.text"
					accessibilityLiveRegion="polite"
					style={[typography.caption, { color: colors.overdue }]}
				>
					{message}
				</Text>
			)}
			{step === 1 ? (
				<>
					<Text
						style={[
							typography.caption,
							styles.center,
							{ fontSize: 12, color: colors.textMuted },
						]}
					>
						{fill(tr.request.footNote, { name: lender })}
					</Text>
					<Button label={tr.request.next} onPress={next} testID="request.next.button" />
				</>
			) : (
				<>
					<Button
						label={tr.request.send}
						loading={request.isPending}
						onPress={send}
						testID="request.send.button"
					/>
					<Button
						label={tr.request.edit}
						variant="secondary"
						onPress={() => {
							setStep(1);
						}}
						testID="request.edit.button"
					/>
				</>
			)}
		</View>
	);

	if (step === 2 && found !== null && amount !== null) {
		const kv = (label: string, value: string, sub?: string) => (
			<View style={[styles.kv, { borderTopColor: colors.divider }]}>
				<Text style={[typography.callout, { color: colors.textMuted }]}>{label}</Text>
				<View style={styles.end}>
					<Text
						style={{
							fontFamily: fonts.bold,
							fontSize: 14,
							color: colors.text,
							textAlign: "right",
						}}
					>
						{value}
					</Text>
					{sub === undefined ? null : (
						<Text
							style={{
								fontFamily: fonts.mono,
								fontSize: 12,
								color: colors.textMuted,
							}}
						>
							{sub}
						</Text>
					)}
				</View>
			</View>
		);
		const stepsLine = [
			tr.request.steps.send,
			fill(tr.request.steps.accept, { name: found.display_name }),
			tr.request.steps.hand,
			tr.request.steps.active,
		];
		return (
			<Screen testID="request.preview" edges={["bottom"]} footer={footer}>
				<Text style={[typography.caption, styles.center, { color: colors.textMuted }]}>
					{fill(tr.request.step, { step: "2" })}
				</Text>
				<View
					style={{
						backgroundColor: colors.surface,
						borderColor: colors.border,
						borderWidth: 1,
						borderRadius: radius.xl,
						overflow: "hidden",
					}}
				>
					<View style={{ padding: 18, backgroundColor: colors.successSoft, gap: 6 }}>
						<Text
							style={{
								fontFamily: fonts.extrabold,
								fontSize: 12,
								letterSpacing: 0.6,
								color: colors.accent,
							}}
						>
							{tr.request.draft}
						</Text>
						<Text
							testID="request.preview.amount"
							style={[typography.amountXL, { color: colors.primary }]}
						>
							{formatTRY(amount)}
						</Text>
					</View>
					<View style={{ paddingHorizontal: 18, paddingBottom: 8 }}>
						{kv(
							tr.request.borrower,
							me.data?.display_name ?? "",
							`${me.data?.paramnet_id ?? ""} · ${tr.request.you}`,
						)}
						{kv(tr.request.lender, found.display_name, found.paramnet_id)}
						{kv(
							tr.request.repay,
							fill(tr.request.repayValue, { date: formatDateTR(due, "long") }),
						)}
						{note.trim() === "" ? null : kv(tr.request.note, note.trim())}
					</View>
				</View>
				<View style={[styles.steps, { gap: 6 }]}>
					{stepsLine.map((label, index) => (
						<View key={label} style={styles.stepItem}>
							<View
								style={[
									styles.stepDot,
									{
										backgroundColor:
											index === 0 ? colors.accent : colors.borderStrong,
									},
								]}
							/>
							<Text
								style={{
									fontFamily: fonts.bold,
									fontSize: 11,
									color: colors.textMuted,
								}}
								numberOfLines={1}
							>
								{label}
							</Text>
						</View>
					))}
				</View>
				<Checkbox
					label={tr.request.consent}
					checked={consent}
					onChange={setConsent}
					testID="request.consent.checkbox"
				/>
			</Screen>
		);
	}

	return (
		<Screen testID="request.screen" edges={["bottom"]} footer={footer}>
			<Text style={[typography.caption, styles.center, { color: colors.textMuted }]}>
				{fill(tr.request.step, { step: "1" })}
			</Text>
			<View style={{ gap: spacing.sm }}>
				<TextField
					label={tr.request.from}
					value={input}
					onChangeText={setInput}
					placeholder={tr.request.fromPlaceholder}
					autoCapitalize="characters"
					helper={tr.request.fromHint}
					testID="request.id.input"
				/>
				{lookup.data?.status === "not_found" ? (
					<Text
						testID="request.idError"
						style={[typography.caption, { color: colors.overdue }]}
					>
						{tr.request.notFound}
					</Text>
				) : null}
				{found === null ? null : (
					<View
						testID="request.found"
						style={[
							styles.found,
							{
								borderColor: colors.accent,
								borderRadius: radius.md,
								backgroundColor: colors.surface,
								gap: 12,
							},
						]}
					>
						<Avatar name={found.display_name} size={44} />
						<View style={styles.grow}>
							<Text
								style={{
									fontFamily: fonts.extrabold,
									fontSize: 15,
									color: colors.text,
								}}
							>
								{found.display_name}
							</Text>
							<Text
								style={{
									fontFamily: fonts.mono,
									fontSize: 12,
									color: colors.textMuted,
								}}
							>
								{fill(tr.request.found, { name: found.paramnet_id })}
							</Text>
						</View>
					</View>
				)}
			</View>
			<AmountInput
				label={tr.request.amount}
				value={amount}
				onChangeValue={setAmount}
				testID="request.amount.input"
			/>
			<View style={{ gap: spacing.xs }}>
				<Text style={[typography.label, { color: colors.textMuted }]}>
					{tr.request.due}
				</Text>
				<View
					accessibilityRole="radiogroup"
					style={[styles.row, { gap: spacing.sm, flexWrap: "wrap" }]}
				>
					<Chip
						label={tr.request.twoWeeks}
						selected={choice === "twoWeeks"}
						role="radio"
						onPress={() => {
							setChoice("twoWeeks");
						}}
						testID="request.due.twoWeeks"
					/>
					<Chip
						label={tr.request.oneMonth}
						selected={choice === "oneMonth"}
						role="radio"
						onPress={() => {
							setChoice("oneMonth");
						}}
						testID="request.due.oneMonth"
					/>
					<Chip
						label={tr.request.pickDate}
						selected={choice === "date"}
						role="radio"
						onPress={() => {
							setChoice("date");
						}}
						testID="request.due.date"
					/>
				</View>
				{choice === "date" ? (
					<DateField
						label={tr.request.due}
						value={date}
						onChange={setDate}
						defaultPickerDate={today}
						testID="request.date"
					/>
				) : (
					<Text
						testID="request.due.text"
						style={[typography.caption, { color: colors.textMuted }]}
					>
						{formatDateTR(due, "long")}
					</Text>
				)}
			</View>
			<TextField
				label={tr.request.note}
				value={note}
				onChangeText={setNote}
				placeholder={tr.request.notePlaceholder}
				maxLength={500}
				testID="request.note.input"
			/>
		</Screen>
	);
}

const styles = StyleSheet.create({
	grow: { flex: 1, minWidth: 0 },
	center: { textAlign: "center" },
	row: { flexDirection: "row" },
	found: {
		flexDirection: "row",
		alignItems: "center",
		borderWidth: 1.5,
		paddingHorizontal: 14,
		paddingVertical: 12,
	},
	kv: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		gap: 12,
		paddingVertical: 12,
		borderTopWidth: 1,
	},
	end: { alignItems: "flex-end", flexShrink: 1 },
	steps: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 6 },
	stepItem: { flex: 1, alignItems: "center", gap: 4 },
	stepDot: { width: 8, height: 8, borderRadius: 4 },
});
