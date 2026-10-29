import { formatDateTR, formatTRY } from "@paramnet/shared";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useAgreements } from "@/api/hooks";
import type { AgreementSummary } from "@/api/types";
import { AmountText } from "@/components/AmountText";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { ProgressBar } from "@/components/ProgressBar";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { SegmentedControl } from "@/components/SegmentedControl";
import { AgreementStatusBadge, InstallmentStatusBadge } from "@/components/StatusBadge";
import { useNewDraft } from "@/features/new/draftStore";
import type { NewType } from "@/features/new/formModel";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

type Side = "payable" | "receivable";

const CLOSED = new Set(["settled", "cancelled", "rejected"]);

// What a new record from this tab most likely is (spec 5.1 templates).
const ACTIONS: Record<Side, { type: NewType; label: string }[]> = {
	payable: [
		{ type: "borrowed", label: tr.new.borrowed },
		{ type: "boughtInstallment", label: tr.new.boughtInstallment },
	],
	receivable: [{ type: "lent", label: tr.new.lent }],
};

function AgreementRow({ agreement }: { agreement: AgreementSummary }) {
	const { colors, typography, spacing } = useAppTheme();
	const paid = agreement.principal_minor - agreement.outstanding_minor;
	const next = agreement.next_installment;
	const testID = `debts.item.${agreement.id}`;
	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={`${agreement.counterparty.display_name} · ${agreement.title}`}
			onPress={() => {
				router.push({ pathname: "/agreement/[id]", params: { id: agreement.id } });
			}}
			style={({ pressed }) => [styles.item, { gap: spacing.sm, opacity: pressed ? 0.7 : 1 }]}
		>
			<View style={[styles.row, { gap: spacing.md }]}>
				<Avatar name={agreement.counterparty.display_name} />
				<View style={styles.grow}>
					<Text style={[typography.rowTitle, { color: colors.text }]} numberOfLines={1}>
						{agreement.title}
					</Text>
					<Text
						style={[typography.caption, { color: colors.textMuted }]}
						numberOfLines={1}
					>
						{agreement.counterparty.display_name}
						{" · "}
						{next?.due_date == null
							? tr.debts.noDueDate
							: fill(tr.debts.nextDue, {
									date: formatDateTR(next.due_date, "short"),
								})}
					</Text>
				</View>
				<View style={styles.end}>
					<AmountText
						minor={agreement.outstanding_minor}
						variant="headline"
						tone={agreement.my_role === "creditor" ? "receivable" : "payable"}
					/>
					<Text style={[typography.caption, { color: colors.textMuted }]}>
						{fill(tr.debts.of, { amount: formatTRY(agreement.principal_minor) })}
					</Text>
				</View>
			</View>
			<ProgressBar
				value={agreement.principal_minor === 0 ? 0 : paid / agreement.principal_minor}
				label={fill(tr.agreement.paidOf, {
					paid: formatTRY(paid),
					amount: formatTRY(agreement.principal_minor),
				})}
				testID={`${testID}.progress`}
			/>
			<View style={styles.between}>
				{next === null ? (
					<AgreementStatusBadge status={agreement.status} />
				) : (
					<InstallmentStatusBadge
						status={next.state.status}
						partial={next.state.partial}
					/>
				)}
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{fill(tr.debts.paidCount, {
						paid: String(agreement.paid_installment_count),
						count: String(agreement.installment_count),
					})}
				</Text>
			</View>
		</Pressable>
	);
}

function Content({ agreements, side }: { agreements: AgreementSummary[]; side: Side }) {
	const { colors, typography, spacing } = useAppTheme();
	const start = useNewDraft((state) => state.start);
	const role = side === "receivable" ? "creditor" : "debtor";
	const mine = agreements.filter((a) => a.my_role === role);
	const open = mine.filter((a) => !CLOSED.has(a.status));
	const closed = mine.filter((a) => CLOSED.has(a.status));
	const total = open.reduce((sum, a) => sum + a.outstanding_minor, 0);

	return (
		<>
			<Card>
				<Text style={[typography.label, { color: colors.textMuted }]}>
					{side === "receivable" ? tr.debts.totalReceivable : tr.debts.totalPayable}
				</Text>
				<AmountText
					minor={total}
					variant="amountL"
					tone={side === "receivable" ? "receivable" : "payable"}
					testID="debts.total.amount"
				/>
				<View style={[styles.actions, { gap: spacing.sm }]}>
					{ACTIONS[side].map(({ type, label }) => (
						<View key={type} style={styles.grow}>
							<Button
								label={label}
								variant="secondary"
								onPress={() => {
									start(type);
									router.push("/new/form");
								}}
								testID={`debts.action.${type}`}
							/>
						</View>
					))}
				</View>
			</Card>

			{open.length === 0 ? (
				<Text
					testID="debts.empty"
					style={[
						typography.body,
						{ color: colors.textMuted, paddingHorizontal: spacing.xs },
					]}
				>
					{side === "receivable" ? tr.debts.emptyReceivable : tr.debts.emptyPayable}
				</Text>
			) : (
				<View style={{ gap: spacing.sm }}>
					<Text
						style={[
							typography.label,
							{ color: colors.textMuted, paddingHorizontal: spacing.xs },
						]}
					>
						{tr.debts.openList}
					</Text>
					<Card style={{ paddingVertical: 0 }}>
						{open.map((agreement, index) => (
							<View
								key={agreement.id}
								style={
									index === 0
										? undefined
										: { borderTopWidth: 1, borderTopColor: colors.divider }
								}
							>
								<AgreementRow agreement={agreement} />
							</View>
						))}
					</Card>
				</View>
			)}

			{closed.length === 0 ? null : (
				<View testID="debts.closed" style={{ gap: spacing.sm }}>
					<Text
						style={[
							typography.label,
							{ color: colors.textMuted, paddingHorizontal: spacing.xs },
						]}
					>
						{tr.debts.closed}
					</Text>
					<Card style={{ paddingVertical: 0 }}>
						{closed.map((agreement, index) => (
							<Pressable
								key={agreement.id}
								testID={`debts.closed.${agreement.id}`}
								accessibilityRole="button"
								accessibilityLabel={`${agreement.counterparty.display_name} · ${agreement.title}`}
								onPress={() => {
									router.push({
										pathname: "/agreement/[id]",
										params: { id: agreement.id },
									});
								}}
								style={[
									styles.row,
									styles.item,
									{ gap: spacing.md },
									index === 0
										? null
										: { borderTopWidth: 1, borderTopColor: colors.divider },
								]}
							>
								<Avatar name={agreement.counterparty.display_name} />
								<View style={styles.grow}>
									<Text
										style={[typography.rowTitle, { color: colors.text }]}
										numberOfLines={1}
									>
										{agreement.title}
									</Text>
									<Text
										style={[typography.caption, { color: colors.textMuted }]}
										numberOfLines={1}
									>
										{agreement.counterparty.display_name}
									</Text>
								</View>
								<AgreementStatusBadge status={agreement.status} />
							</Pressable>
						))}
					</Card>
				</View>
			)}
		</>
	);
}

// Design 12 "Borçlarım / Alacaklarım": one tab per side, totals of open agreements, then the list.
export function DebtsScreen() {
	const { colors, sizes } = useAppTheme();
	const agreements = useAgreements();
	const [side, setSide] = useState<Side>("payable");

	return (
		<Screen
			testID="debts.screen"
			refreshControl={
				<RefreshControl
					refreshing={agreements.isRefetching}
					onRefresh={() => {
						void agreements.refetch();
					}}
				/>
			}
		>
			<View style={styles.between}>
				<ScreenTitle>{tr.debts.title}</ScreenTitle>
				<View style={[styles.row, { gap: 8 }]}>
					<Pressable
						testID="debts.splits.button"
						accessibilityRole="button"
						accessibilityLabel={tr.split.listOpen}
						onPress={() => {
							router.push("/split");
						}}
						style={[
							styles.iconButton,
							{
								width: sizes.iconButton,
								height: sizes.iconButton,
								backgroundColor: colors.surface,
								borderColor: colors.border,
							},
						]}
					>
						<Ionicons name="receipt-outline" size={22} color={colors.text} />
					</Pressable>
					<Pressable
						testID="debts.contacts.button"
						accessibilityRole="button"
						accessibilityLabel={tr.tabs.contacts}
						onPress={() => {
							router.push("/contacts");
						}}
						style={[
							styles.iconButton,
							{
								width: sizes.iconButton,
								height: sizes.iconButton,
								backgroundColor: colors.surface,
								borderColor: colors.border,
							},
						]}
					>
						<Ionicons name="people-outline" size={22} color={colors.text} />
					</Pressable>
				</View>
			</View>
			<SegmentedControl
				label={tr.debts.title}
				hideLabel
				options={[
					{ value: "payable", label: tr.debts.payable },
					{ value: "receivable", label: tr.debts.receivable },
				]}
				value={side}
				onChange={setSide}
				testID="debts.tab"
			/>
			{agreements.isPending ? (
				<LoadingState testID="debts.loading" />
			) : agreements.isError ? (
				<ErrorState
					message={messageForError(agreements.error)}
					onRetry={() => {
						void agreements.refetch();
					}}
					testID="debts.error"
				/>
			) : (
				<Content agreements={agreements.data} side={side} />
			)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", alignItems: "center" },
	between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	grow: { flex: 1, minWidth: 0 },
	end: { alignItems: "flex-end" },
	actions: { flexDirection: "row", marginTop: 8 },
	item: { paddingVertical: 14 },
	iconButton: {
		alignItems: "center",
		justifyContent: "center",
		borderRadius: 14,
		borderWidth: 1,
	},
});
