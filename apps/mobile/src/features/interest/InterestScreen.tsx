import { Ionicons } from "@expo/vector-icons";
import {
	cardInterestEstimate,
	daysBetween,
	earlyPayoff,
	formatRateBps,
	formatTRY,
	monthName,
	parseRateBps,
} from "@paramnet/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useCard, useCards, useLoan, useLoans } from "@/api/hooks";
import type { Card, Loan } from "@/api/types";
import { AmountInput } from "@/components/AmountInput";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Row, RowGroup } from "@/components/RowGroup";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

type PayOption = "min" | "partial" | "full";

function Disclaimer() {
	const { colors, typography, radius } = useAppTheme();
	return (
		<View
			testID="interest.disclaimer"
			style={[
				styles.note,
				{ backgroundColor: colors.pendingSoft, borderRadius: radius.sm, gap: 10 },
			]}
		>
			<Ionicons name="information-circle-outline" size={18} color={colors.pending} />
			<Text style={[typography.caption, styles.grow, { color: colors.pending }]}>
				{`${tr.interest.disclaimerTitle} ${tr.interest.disclaimer}`}
			</Text>
		</View>
	);
}

function Panel({
	title,
	amount,
	sub,
	rows,
	testID,
}: {
	title: string;
	amount: string;
	sub: string;
	rows: [string, string, string][];
	testID: string;
}) {
	const { colors, fonts, radius } = useAppTheme();
	return (
		<View
			testID={testID}
			style={{ backgroundColor: colors.heroStage, borderRadius: radius.xl, padding: 20 }}
		>
			<Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.heroSoft }}>
				{title}
			</Text>
			<Text
				testID={`${testID}.amount`}
				style={{
					fontFamily: fonts.extrabold,
					fontSize: 34,
					letterSpacing: -0.8,
					color: colors.heroText,
					marginTop: 4,
				}}
			>
				{amount}
			</Text>
			<Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.heroMuted }}>
				{sub}
			</Text>
			<View style={{ marginTop: 14 }}>
				{rows.map(([label, value, id]) => (
					<View key={id} style={[styles.kv, { borderTopColor: colors.heroLine }]}>
						<Text
							style={{
								fontFamily: fonts.semibold,
								fontSize: 14,
								color: colors.heroSoft,
							}}
						>
							{label}
						</Text>
						<Text
							testID={`${testID}.${id}`}
							style={{
								fontFamily: fonts.extrabold,
								fontSize: 14,
								color: colors.heroText,
							}}
						>
							{value}
						</Text>
					</View>
				))}
			</View>
		</View>
	);
}

function CardSimulation({ card }: { card: Card }) {
	const { colors, typography, fonts, spacing, radius } = useAppTheme();
	const s = card.state;
	const [option, setOption] = useState<PayOption>("min");
	const [partial, setPartial] = useState<number | null>(null);
	const [rate, setRate] = useState("3,75");
	const [days, setDays] = useState(String(daysBetween(s.last_cut, s.next_cut)));
	const [kkdf, setKkdf] = useState("15");
	const [bsmv, setBsmv] = useState("15");
	const amounts: Record<PayOption, number> = {
		min: s.minimum_minor,
		partial: partial ?? 0,
		full: s.statement_minor,
	};
	const paid = Math.min(s.statement_minor, amounts[option]);
	const remaining = s.statement_minor - paid;
	const bps = parseRateBps(rate);
	const kkdfBps = parseRateBps(kkdf);
	const bsmvBps = parseRateBps(bsmv);
	const dayCount = Number(days);
	const valid =
		bps !== null &&
		kkdfBps !== null &&
		bsmvBps !== null &&
		Number.isInteger(dayCount) &&
		dayCount > 0 &&
		dayCount <= 62;
	const estimate = valid
		? cardInterestEstimate(remaining, bps, dayCount, kkdfBps, bsmvBps)
		: null;
	const pill = (key: PayOption) => (
		<Pressable
			key={key}
			testID={`interest.option.${key}`}
			accessibilityRole="radio"
			accessibilityLabel={`${tr.interest.options[key]}, ${formatTRY(amounts[key])}`}
			accessibilityState={{ checked: option === key }}
			onPress={() => {
				setOption(key);
			}}
			style={[
				styles.pill,
				{
					borderRadius: radius.sm,
					backgroundColor: colors.surface,
					borderColor: option === key ? colors.accent : colors.borderStrong,
					borderWidth: option === key ? 2 : 1,
				},
			]}
		>
			<Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted }}>
				{tr.interest.options[key]}
			</Text>
			<Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.text }}>
				{formatTRY(amounts[key])}
			</Text>
		</Pressable>
	);
	return (
		<>
			<Disclaimer />
			<View style={{ gap: spacing.sm }}>
				<Text style={[typography.label, { color: colors.text }]}>
					{fill(tr.interest.statement, {
						card: card.label,
						month: monthName(Number(s.last_cut.slice(5, 7))),
						amount: formatTRY(s.statement_minor),
					})}
				</Text>
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{tr.interest.paidLabel}
				</Text>
				<View accessibilityRole="radiogroup" style={[styles.row, { gap: spacing.sm }]}>
					{(["min", "partial", "full"] as const).map(pill)}
				</View>
				{option === "partial" ? (
					<AmountInput
						label={tr.interest.partialAmount}
						value={partial}
						onChangeValue={setPartial}
						testID="interest.partial.input"
					/>
				) : null}
			</View>
			{estimate === null ? (
				<Text
					testID="interest.invalid"
					style={[typography.caption, { color: colors.overdue }]}
				>
					{tr.interest.invalid}
				</Text>
			) : (
				<Panel
					testID="interest.card"
					title={tr.interest.estimate}
					amount={formatTRY(estimate.total_minor)}
					sub={tr.interest.nextStatement}
					rows={[
						[tr.interest.remaining, formatTRY(remaining), "remaining"],
						[tr.interest.interest, formatTRY(estimate.interest_minor), "interest"],
						[
							fill(tr.interest.kkdf, { rate: kkdf }),
							formatTRY(estimate.kkdf_minor),
							"kkdf",
						],
						[
							fill(tr.interest.bsmv, { rate: bsmv }),
							formatTRY(estimate.bsmv_minor),
							"bsmv",
						],
					]}
				/>
			)}
			{estimate === null || bps === null ? null : (
				<View style={{ gap: spacing.xs }}>
					<Text style={[typography.label, { color: colors.textMuted }]}>
						{tr.interest.formula}
					</Text>
					<View
						style={{
							backgroundColor: colors.surface,
							borderColor: colors.border,
							borderWidth: 1,
							borderRadius: radius.lg,
							padding: 14,
							gap: 6,
						}}
					>
						<Text
							testID="interest.formula"
							style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.text }}
						>
							{remaining === 0
								? tr.interest.formulaPaid
								: fill(tr.interest.formulaLine, {
										amount: formatTRY(remaining),
										rate: formatRateBps(bps),
										days: String(dayCount),
										interest: formatTRY(estimate.interest_minor),
									})}
						</Text>
						<Text
							style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}
						>
							{tr.interest.formulaNote}
						</Text>
					</View>
				</View>
			)}
			<View style={{ gap: spacing.sm }}>
				<Text style={[typography.label, { color: colors.textMuted }]}>
					{tr.interest.params}
				</Text>
				<View style={[styles.row, { gap: 10 }]}>
					<View style={styles.grow}>
						<TextField
							label={tr.interest.rate}
							value={rate}
							onChangeText={setRate}
							keyboardType="decimal-pad"
							helper={tr.interest.rateHint}
							testID="interest.rate.input"
						/>
					</View>
					<View style={styles.grow}>
						<TextField
							label={tr.interest.days}
							value={days}
							onChangeText={(t) => {
								setDays(t.replace(/\D/g, "").slice(0, 2));
							}}
							keyboardType="number-pad"
							helper={tr.interest.daysHint}
							testID="interest.days.input"
						/>
					</View>
				</View>
				<View style={[styles.row, { gap: 10 }]}>
					<View style={styles.grow}>
						<TextField
							label={tr.interest.kkdfRate}
							value={kkdf}
							onChangeText={setKkdf}
							keyboardType="decimal-pad"
							helper={tr.interest.taxHint}
							testID="interest.kkdf.input"
						/>
					</View>
					<View style={styles.grow}>
						<TextField
							label={tr.interest.bsmvRate}
							value={bsmv}
							onChangeText={setBsmv}
							keyboardType="decimal-pad"
							testID="interest.bsmv.input"
						/>
					</View>
				</View>
			</View>
			<Button
				label={tr.interest.pay}
				onPress={() => {
					router.push({ pathname: "/cards/[id]/pay", params: { id: card.id } });
				}}
				testID="interest.pay.button"
			/>
		</>
	);
}

function LoanSimulation({ loan }: { loan: Loan }) {
	const { colors, typography } = useAppTheme();
	const left = loan.term_months - loan.paid;
	const payoff = earlyPayoff(loan.remaining_principal_minor, left, loan.remaining_total_minor);
	return (
		<>
			<Disclaimer />
			<Text style={[typography.label, { color: colors.text }]}>
				{fill(tr.interest.earlyLine, {
					loan: `${loan.bank_name} · ${loan.loan_type}`,
					count: String(left),
				})}
			</Text>
			<Panel
				testID="interest.loan"
				title={tr.interest.earlyTotal}
				amount={formatTRY(payoff.total_minor)}
				sub={tr.interest.early}
				rows={[
					[tr.interest.remaining, formatTRY(loan.remaining_principal_minor), "remaining"],
					[
						fill(tr.interest.earlyFee, { rate: String(payoff.fee_bps / 100) }),
						formatTRY(payoff.fee_minor),
						"fee",
					],
					[tr.interest.earlyRemaining, formatTRY(loan.remaining_total_minor), "left"],
					[tr.interest.earlySaved, formatTRY(payoff.saved_minor), "saved"],
				]}
			/>
			<Text style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}>
				{tr.interest.earlyNote}
			</Text>
		</>
	);
}

function Loading() {
	return <LoadingState rows={4} testID="interest.loading" />;
}

function ForCard({ id }: { id: string }) {
	const card = useCard(id);
	if (card.isPending) {
		return <Loading />;
	}
	if (card.isError) {
		return (
			<ErrorState
				message={messageForError(card.error)}
				onRetry={() => {
					void card.refetch();
				}}
				testID="interest.error"
			/>
		);
	}
	return <CardSimulation card={card.data.card} />;
}

function ForLoan({ id }: { id: string }) {
	const loan = useLoan(id);
	if (loan.isPending) {
		return <Loading />;
	}
	if (loan.isError) {
		return (
			<ErrorState
				message={messageForError(loan.error)}
				onRetry={() => {
					void loan.refetch();
				}}
				testID="interest.error"
			/>
		);
	}
	return <LoanSimulation loan={loan.data.loan} />;
}

// From Ana menü: pick a card or a loan.
function Picker() {
	const { colors, typography } = useAppTheme();
	const cards = useCards();
	const loans = useLoans();
	if (cards.isPending || loans.isPending) {
		return <Loading />;
	}
	const cardList = cards.data?.cards ?? [];
	const loanList = loans.data?.loans ?? [];
	if (cardList.length === 0 && loanList.length === 0) {
		return (
			<Text testID="interest.none" style={[typography.body, { color: colors.textMuted }]}>
				{tr.interest.none}
			</Text>
		);
	}
	return (
		<>
			<Text style={[typography.headline, { color: colors.text }]}>{tr.interest.pick}</Text>
			{cardList.length === 0 ? null : (
				<RowGroup label={tr.interest.cards}>
					{cardList.map((card, index) => (
						<Row
							key={card.id}
							title={card.label}
							value={formatTRY(card.state.statement_remaining_minor)}
							icon="card-outline"
							onPress={() => {
								router.setParams({ card: card.id });
							}}
							testID={`interest.pick.card.${String(index)}`}
						/>
					))}
				</RowGroup>
			)}
			{loanList.length === 0 ? null : (
				<RowGroup label={tr.interest.loans}>
					{loanList.map((loan, index) => (
						<Row
							key={loan.id}
							title={`${loan.bank_name} · ${loan.loan_type}`}
							value={formatTRY(loan.remaining_principal_minor)}
							icon="business-outline"
							onPress={() => {
								router.setParams({ loan: loan.id });
							}}
							testID={`interest.pick.loan.${String(index)}`}
						/>
					))}
				</RowGroup>
			)}
		</>
	);
}

// Design 10: what an unpaid statement may cost, or what closing a loan today takes (ADR-057).
export function InterestScreen({
	cardId,
	loanId,
}: {
	cardId: string | null;
	loanId: string | null;
}) {
	return (
		<Screen testID="interest.screen" edges={["bottom"]}>
			{cardId !== null ? (
				<ForCard id={cardId} />
			) : loanId !== null ? (
				<ForLoan id={loanId} />
			) : (
				<Picker />
			)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	grow: { flex: 1, minWidth: 0 },
	row: { flexDirection: "row" },
	note: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 12 },
	pill: { flex: 1, height: 56, alignItems: "center", justifyContent: "center" },
	kv: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 10,
		borderTopWidth: 1,
	},
});
