import { formatDateTR, formatSignedTRY } from "@paramnet/shared";
import { router } from "expo-router";
import { useRef } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useConfirmRecurring, useRecurring, useSkipRecurring } from "@/api/hooks";
import type { RecurringRule } from "@/api/types";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { RowGroup } from "@/components/RowGroup";
import { Screen } from "@/components/Screen";
import { Badge } from "@/components/StatusBadge";
import { fill, tr } from "@/i18n/tr";
import { newIdempotencyKey } from "@/lib/ids";
import { useAppTheme } from "@/theme/useAppTheme";

import { scheduleLine } from "./planModel";

function amountOf(rule: RecurringRule): string {
	return formatSignedTRY(rule.amount_minor, rule.kind === "income" ? "plus" : "minus");
}

function RuleRow({ rule, index }: { rule: RecurringRule; index: number }) {
	const { colors, typography, fonts, spacing } = useAppTheme();
	const line = scheduleLine(rule);
	return (
		<Pressable
			testID={`recurring.item.${String(index)}`}
			accessibilityRole="button"
			accessibilityLabel={`${rule.name}, ${line}, ${amountOf(rule)}`}
			onPress={() => {
				router.push({ pathname: "/recurring/[id]", params: { id: rule.id } });
			}}
			style={({ pressed }) => [
				styles.row,
				{ gap: spacing.md, paddingHorizontal: spacing.lg, opacity: pressed ? 0.7 : 1 },
			]}
		>
			<View style={styles.grow}>
				<Text style={[typography.rowTitle, { color: colors.text }]}>{rule.name}</Text>
				<Text style={[typography.caption, { color: colors.textMuted }]}>{line}</Text>
			</View>
			<View style={styles.end}>
				<Text
					style={{
						fontFamily: fonts.extrabold,
						fontSize: 15,
						color: rule.kind === "income" ? colors.receivable : colors.text,
						fontVariant: ["tabular-nums"],
					}}
				>
					{amountOf(rule)}
				</Text>
				{rule.paused_at === null ? null : (
					<Badge label={tr.recurring.paused} tone="neutral" />
				)}
			</View>
		</Pressable>
	);
}

// "Planlı": a date has come for a rule that asks each time.
function PendingRow({ rule, date, testID }: { rule: RecurringRule; date: string; testID: string }) {
	const { colors, typography, spacing } = useAppTheme();
	const key = useRef(newIdempotencyKey());
	const confirm = useConfirmRecurring();
	const skip = useSkipRecurring();
	const busy = confirm.isPending || skip.isPending;
	const error = confirm.error ?? skip.error;
	return (
		<View
			testID={testID}
			style={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 12 }}
		>
			<View>
				<Text style={[typography.rowTitle, { color: colors.text }]}>{rule.name}</Text>
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{fill(tr.recurring.pendingLine, {
						date: formatDateTR(date, "dayMonth"),
						amount: amountOf(rule),
					})}
				</Text>
			</View>
			<View style={[styles.buttons, { gap: spacing.sm }]}>
				<View style={styles.grow}>
					<Button
						label={tr.recurring.skip}
						variant="secondary"
						disabled={busy}
						onPress={() => {
							skip.mutate({ id: rule.id, date });
						}}
						testID={`${testID}.skip`}
					/>
				</View>
				<View style={styles.grow}>
					<Button
						label={tr.recurring.confirm}
						loading={confirm.isPending}
						disabled={busy}
						onPress={() => {
							confirm.mutate({ id: rule.id, date, idempotencyKey: key.current });
						}}
						testID={`${testID}.confirm`}
					/>
				</View>
			</View>
			{error === null ? null : (
				<Text
					accessibilityLiveRegion="polite"
					style={[typography.caption, { color: colors.overdue }]}
				>
					{messageForError(error)}
				</Text>
			)}
		</View>
	);
}

// Design 38: the rules, the dates waiting for a decision, and a way to add one.
export function RecurringScreen() {
	const rules = useRecurring();
	const add = (
		<Button
			label={tr.recurring.add}
			onPress={() => {
				router.push("/recurring/new");
			}}
			testID="recurring.add.button"
		/>
	);
	if (rules.isPending) {
		return (
			<Screen testID="recurring.screen" edges={["bottom"]}>
				<LoadingState rows={3} testID="recurring.loading" />
			</Screen>
		);
	}
	if (rules.isError) {
		return (
			<Screen testID="recurring.screen" edges={["bottom"]}>
				<ErrorState
					message={messageForError(rules.error)}
					onRetry={() => {
						void rules.refetch();
					}}
					testID="recurring.error"
				/>
			</Screen>
		);
	}
	if (rules.data.length === 0) {
		return (
			<Screen testID="recurring.screen" edges={["bottom"]}>
				<EmptyState
					title={tr.recurring.emptyTitle}
					body={tr.recurring.emptyBody}
					actionLabel={tr.recurring.add}
					onAction={() => {
						router.push("/recurring/new");
					}}
					actionTestID="recurring.empty.action"
					testID="recurring.empty"
				/>
			</Screen>
		);
	}
	const pending = rules.data.flatMap((rule) =>
		rule.pending_dates.map((date) => ({ rule, date })),
	);
	return (
		<Screen
			testID="recurring.screen"
			edges={["bottom"]}
			footer={add}
			refreshControl={
				<RefreshControl
					refreshing={rules.isRefetching}
					onRefresh={() => {
						void rules.refetch();
					}}
				/>
			}
		>
			{pending.length === 0 ? null : (
				<RowGroup label={tr.recurring.pending} testID="recurring.pending">
					{pending.map(({ rule, date }, index) => (
						<PendingRow
							key={`${rule.id}-${date}`}
							rule={rule}
							date={date}
							testID={`recurring.pending.${String(index)}`}
						/>
					))}
				</RowGroup>
			)}
			<RowGroup label={fill(tr.recurring.active, { count: String(rules.data.length) })}>
				{rules.data.map((rule, index) => (
					<RuleRow key={rule.id} rule={rule} index={index} />
				))}
			</RowGroup>
		</Screen>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", alignItems: "center", minHeight: 62, paddingVertical: 12 },
	grow: { flex: 1, minWidth: 0 },
	end: { alignItems: "flex-end", gap: 3 },
	buttons: { flexDirection: "row" },
});
