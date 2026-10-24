import {
	CARD_COLORS,
	cardInputSchema,
	suggestedMinimumRate,
	type CardColor,
} from "@paramnet/shared";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useArchiveCard, useCards, useCreateCard, useUpdateCard } from "@/api/hooks";
import type { Card } from "@/api/types";
import { AmountInput } from "@/components/AmountInput";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { ConfirmSheet } from "@/features/cash/parts";
import { fill, tr } from "@/i18n/tr";
import { newIdempotencyKey } from "@/lib/ids";
import { useAppTheme } from "@/theme/useAppTheme";

import { CARD_FACE, CardFace } from "./cardParts";

const FIELD_ERRORS: Partial<Record<string, string>> = {
	bank_name: tr.cardForm.bankRequired,
	last4: tr.cardForm.last4Invalid,
	limit_minor: tr.cardForm.limitRequired,
	statement_day: tr.cardForm.dayInvalid,
	due_offset_days: tr.cardForm.dayInvalid,
	min_payment_rate: tr.cardForm.rateInvalid,
};

const digits = (text: string) => text.replace(/\D/g, "");
const toInt = (text: string) => (text === "" ? Number.NaN : Number(text));

function Form({ card }: { card: Card | null }) {
	const { colors, typography, spacing } = useAppTheme();
	const [color, setColor] = useState<CardColor>(card?.color ?? "midnight");
	const [bank, setBank] = useState(card?.bank_name ?? "");
	const [name, setName] = useState(card?.card_name ?? "");
	const [last4, setLast4] = useState(card?.last4 ?? "");
	const [limit, setLimit] = useState<number | null>(card?.limit_minor ?? null);
	const [debt, setDebt] = useState<number | null>(card?.opening_debt_minor ?? null);
	const [cut, setCut] = useState(card === null ? "" : String(card.statement_day));
	const [due, setDue] = useState(String(card?.due_offset_days ?? 10));
	const [rate, setRate] = useState(card === null ? "" : String(card.min_payment_rate));
	const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
	const [archiveOpen, setArchiveOpen] = useState(false);
	const key = useRef(newIdempotencyKey());
	const create = useCreateCard();
	const update = useUpdateCard();
	const archive = useArchiveCard();
	const serverError = create.error ?? update.error ?? archive.error;
	// Until the user types a rate, it follows the limit (design 32 "Limite göre önerildi").
	const shownRate = rate === "" && limit !== null ? String(suggestedMinimumRate(limit)) : rate;

	function submit() {
		const parsed = cardInputSchema.safeParse({
			bank_name: bank,
			card_name: name,
			last4,
			color,
			limit_minor: limit ?? 0,
			opening_debt_minor: debt ?? 0,
			statement_day: toInt(cut),
			due_offset_days: toInt(due),
			min_payment_rate: toInt(shownRate),
		});
		if (!parsed.success) {
			const next: Partial<Record<string, string>> = {};
			for (const issue of parsed.error.issues) {
				const field = String(issue.path[0]);
				next[field] = next[field] ?? FIELD_ERRORS[field] ?? tr.error.validation;
			}
			setErrors(next);
			return;
		}
		setErrors({});
		const done = () => {
			router.back();
		};
		if (card === null) {
			create.mutate({ input: parsed.data, idempotencyKey: key.current }, { onSuccess: done });
		} else {
			update.mutate(
				{ id: card.id, input: parsed.data, rowVersion: card.row_version },
				{ onSuccess: done },
			);
		}
	}

	return (
		<Screen
			testID="cardForm.screen"
			edges={["bottom"]}
			footer={
				<Button
					label={card === null ? tr.cardForm.submitNew : tr.cardForm.submitEdit}
					loading={create.isPending || update.isPending}
					onPress={submit}
					testID="cardForm.submit.button"
				/>
			}
		>
			<CardFace
				bank={bank === "" ? tr.cardForm.bankPlaceholder : bank}
				name={name === "" ? null : name}
				last4={last4.padEnd(4, "•")}
				color={color}
				footer={tr.cardForm.tracking}
				testID="cardForm.preview"
			/>
			<View
				accessibilityRole="radiogroup"
				accessibilityLabel={tr.cardForm.color}
				style={[styles.swatches, { gap: 10 }]}
			>
				{CARD_COLORS.map((option) => (
					<Pressable
						key={option}
						testID={`cardForm.color.${option}`}
						accessibilityRole="radio"
						accessibilityLabel={tr.cardForm.colors[option]}
						accessibilityState={{ checked: option === color }}
						onPress={() => {
							setColor(option);
						}}
						style={[
							styles.swatch,
							{
								backgroundColor: colors[CARD_FACE[option]],
								borderColor: option === color ? colors.accent : colors.surface,
							},
						]}
					/>
				))}
			</View>
			<View style={[styles.row, { gap: 10 }]}>
				<View style={styles.grow}>
					<TextField
						label={tr.cardForm.bank}
						value={bank}
						onChangeText={setBank}
						placeholder={tr.cardForm.bankPlaceholder}
						maxLength={40}
						error={errors.bank_name}
						testID="cardForm.bank.input"
					/>
				</View>
				<View style={styles.grow}>
					<TextField
						label={tr.cardForm.cardName}
						value={name}
						onChangeText={setName}
						placeholder={tr.cardForm.cardNamePlaceholder}
						maxLength={40}
						testID="cardForm.name.input"
					/>
				</View>
			</View>
			<TextField
				label={tr.cardForm.last4}
				value={last4}
				onChangeText={(text) => {
					setLast4(digits(text).slice(0, 4));
				}}
				keyboardType="number-pad"
				maxLength={4}
				helper={tr.cardForm.last4Hint}
				error={errors.last4}
				testID="cardForm.last4.input"
			/>
			<View style={[styles.row, { gap: 10 }]}>
				<View style={styles.grow}>
					<AmountInput
						label={tr.cardForm.limit}
						value={limit}
						onChangeValue={setLimit}
						error={errors.limit_minor}
						testID="cardForm.limit.input"
					/>
				</View>
				<View style={styles.grow}>
					<AmountInput
						label={tr.cardForm.openingDebt}
						value={debt}
						onChangeValue={setDebt}
						helper={tr.cardForm.openingHint}
						testID="cardForm.debt.input"
					/>
				</View>
			</View>
			<View style={[styles.row, { gap: 10 }]}>
				<View style={styles.grow}>
					<TextField
						label={tr.cardForm.statementDay}
						value={cut}
						onChangeText={(text) => {
							setCut(digits(text).slice(0, 2));
						}}
						keyboardType="number-pad"
						error={errors.statement_day}
						testID="cardForm.cut.input"
					/>
				</View>
				<View style={styles.grow}>
					<TextField
						label={tr.cardForm.dueOffset}
						value={due}
						onChangeText={(text) => {
							setDue(digits(text).slice(0, 2));
						}}
						keyboardType="number-pad"
						error={errors.due_offset_days}
						testID="cardForm.due.input"
					/>
				</View>
			</View>
			<TextField
				label={tr.cardForm.minRate}
				value={shownRate}
				onChangeText={(text) => {
					setRate(digits(text).slice(0, 3));
				}}
				keyboardType="number-pad"
				helper={tr.cardForm.minRateHint}
				error={errors.min_payment_rate}
				testID="cardForm.rate.input"
			/>
			{serverError === null ? null : (
				<Text
					accessibilityLiveRegion="polite"
					style={[typography.caption, { color: colors.overdue }]}
				>
					{messageForError(serverError)}
				</Text>
			)}
			{card === null ? null : (
				<>
					<Button
						label={tr.cardForm.archive}
						variant="ghost"
						onPress={() => {
							setArchiveOpen(true);
						}}
						testID="cardForm.archive.button"
					/>
					<ConfirmSheet
						visible={archiveOpen}
						title={tr.cardForm.archiveTitle}
						body={fill(tr.cardForm.archiveBody, { label: card.label })}
						confirmLabel={tr.cardForm.archiveConfirm}
						busy={archive.isPending}
						onCancel={() => {
							setArchiveOpen(false);
						}}
						onConfirm={() => {
							archive.mutate(
								{ id: card.id, rowVersion: card.row_version },
								{
									onSuccess: () => {
										setArchiveOpen(false);
										router.dismissAll();
										router.navigate("/cards");
									},
									onError: () => {
										setArchiveOpen(false);
									},
								},
							);
						}}
						testID="cardForm.archive.sheet"
					/>
				</>
			)}
			<View style={{ height: spacing.sm }} />
		</Screen>
	);
}

// Design 32 and its edit mode.
export function CardFormScreen({ id }: { id: string | null }) {
	const cards = useCards();
	if (id === null) {
		return <Form card={null} />;
	}
	if (cards.isPending) {
		return (
			<Screen testID="cardForm.screen" edges={["bottom"]}>
				<LoadingState rows={4} testID="cardForm.loading" />
			</Screen>
		);
	}
	const card = cards.data?.cards.find((c) => c.id === id);
	if (card === undefined) {
		return (
			<Screen testID="cardForm.screen" edges={["bottom"]}>
				<ErrorState
					message={cards.isError ? messageForError(cards.error) : tr.error.notFound}
					onRetry={() => {
						void cards.refetch();
					}}
					testID="cardForm.error"
				/>
			</Screen>
		);
	}
	return <Form card={card} />;
}

const styles = StyleSheet.create({
	grow: { flex: 1 },
	row: { flexDirection: "row" },
	swatches: { flexDirection: "row", justifyContent: "center" },
	swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
});
