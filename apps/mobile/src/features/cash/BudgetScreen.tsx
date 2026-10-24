import {
	EXPENSE_CATEGORIES,
	budgetLevel,
	formatTRY,
	monthOf,
	type TransactionCategory,
} from "@paramnet/shared";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useBudgets, useSetBudget } from "@/api/hooks";
import type { BudgetItem } from "@/api/types";
import { AmountInput } from "@/components/AmountInput";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Badge } from "@/components/StatusBadge";
import { IconButton } from "@/components/TopBar";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import type { ColorToken } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

import { categoryLabel, monogram, monthTitle } from "./cashModel";
import { barWidth, dailyAllowance, monthClock, percentOf } from "./planModel";

const label = (category: TransactionCategory) =>
	categoryLabel({ kind: "expense", category }) ?? category;

function Bar({
	percent,
	tone,
	height = 8,
	accessibilityLabel,
}: {
	percent: number;
	tone: ColorToken;
	height?: number;
	accessibilityLabel: string;
}) {
	const { colors } = useAppTheme();
	return (
		<View
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={accessibilityLabel}
			style={{
				height,
				borderRadius: height / 2,
				backgroundColor: colors.track,
				overflow: "hidden",
			}}
		>
			<View
				style={{
					width: barWidth(percent),
					height: "100%",
					borderRadius: height / 2,
					backgroundColor: colors[tone],
				}}
			/>
		</View>
	);
}

function CategoryRow({ item, onPress }: { item: BudgetItem; onPress: () => void }) {
	const { colors, typography, fonts, spacing } = useAppTheme();
	const level = budgetLevel(item.spent_minor, item.limit_minor);
	const percent = percentOf(item.spent_minor, item.limit_minor);
	const name = label(item.category);
	const tone: ColorToken = level === "over" ? "overdue" : level === "near" ? "warning" : "accent";
	return (
		<Pressable
			testID={`budget.item.${item.category}`}
			accessibilityRole="button"
			accessibilityLabel={`${name}, ${formatTRY(item.spent_minor)} / ${formatTRY(item.limit_minor)}`}
			onPress={onPress}
			style={({ pressed }) => [
				styles.item,
				{ gap: spacing.sm, paddingHorizontal: spacing.lg, opacity: pressed ? 0.7 : 1 },
			]}
		>
			<View style={[styles.line, { gap: spacing.md }]}>
				<View style={[styles.mark, { backgroundColor: colors.surfaceSunken }]}>
					<Text
						style={{ fontFamily: fonts.extrabold, fontSize: 12, color: colors.neutral }}
					>
						{monogram(name)}
					</Text>
				</View>
				<View style={styles.grow}>
					<Text style={[typography.rowTitle, { color: colors.text }]}>{name}</Text>
					<Text style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}>
						{item.count === 0
							? tr.budget.none
							: fill(tr.budget.count, { count: String(item.count) })}
					</Text>
				</View>
				<View style={styles.end}>
					<Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.text }}>
						{formatTRY(item.spent_minor)}
					</Text>
					<Text style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}>
						{`/ ${formatTRY(item.limit_minor)}`}
					</Text>
				</View>
			</View>
			<Bar
				percent={percent}
				tone={tone}
				accessibilityLabel={fill(tr.budget.progress, { name, percent: String(percent) })}
			/>
			{level === "ok" ? null : (
				<View style={styles.start}>
					<Badge
						testID={`budget.item.${item.category}.badge`}
						label={
							level === "over"
								? fill(tr.budget.over, {
										amount: formatTRY(item.spent_minor - item.limit_minor),
										percent: String(percent),
									})
								: fill(tr.budget.near, { percent: String(percent) })
						}
						tone={level === "over" ? "overdue" : "warning"}
					/>
				</View>
			)}
		</Pressable>
	);
}

// Add or change one category's monthly limit; an existing one can be removed.
function LimitSheet({
	visible,
	initial,
	free,
	onClose,
}: {
	visible: boolean;
	initial: BudgetItem | null;
	free: readonly TransactionCategory[];
	onClose: () => void;
}) {
	const { colors, typography, spacing } = useAppTheme();
	const [category, setCategory] = useState<TransactionCategory | null>(
		initial?.category ?? free[0] ?? null,
	);
	const [limit, setLimit] = useState<number | null>(initial?.limit_minor ?? null);
	const [error, setError] = useState<string | null>(null);
	const save = useSetBudget();
	const done = { onSuccess: onClose };
	return (
		<Modal
			visible={visible}
			animationType="slide"
			presentationStyle="pageSheet"
			onRequestClose={onClose}
		>
			<Screen
				testID="budget.sheet"
				edges={["top", "bottom"]}
				footer={
					<View style={{ gap: spacing.sm }}>
						{error === null && save.error === null ? null : (
							<Text
								accessibilityLiveRegion="polite"
								style={[typography.caption, { color: colors.overdue }]}
							>
								{error ?? messageForError(save.error)}
							</Text>
						)}
						<Button
							label={tr.budget.save}
							loading={save.isPending}
							onPress={() => {
								if (category === null || limit === null || limit === 0) {
									setError(tr.budget.limitRequired);
									return;
								}
								setError(null);
								save.mutate({ category, limitMinor: limit }, done);
							}}
							testID="budget.sheet.save.button"
						/>
						{initial === null ? null : (
							<Button
								label={tr.budget.remove}
								variant="ghost"
								onPress={() => {
									save.mutate(
										{ category: initial.category, limitMinor: null },
										done,
									);
								}}
								testID="budget.sheet.remove.button"
							/>
						)}
						<Button
							label={tr.common.close}
							variant="secondary"
							onPress={onClose}
							testID="budget.sheet.close.button"
						/>
					</View>
				}
			>
				<ScreenTitle>
					{initial === null ? tr.budget.formTitle : label(initial.category)}
				</ScreenTitle>
				{initial === null ? (
					<View style={{ gap: spacing.xs }}>
						<Text style={[typography.label, { color: colors.textMuted }]}>
							{tr.budget.category}
						</Text>
						<View
							accessibilityRole="radiogroup"
							style={[styles.wrap, { gap: spacing.sm }]}
						>
							{free.map((option) => (
								<Chip
									key={option}
									label={label(option)}
									selected={option === category}
									role="radio"
									onPress={() => {
										setCategory(option);
									}}
									testID={`budget.sheet.category.${option}`}
								/>
							))}
						</View>
					</View>
				) : null}
				<AmountInput
					label={tr.budget.limit}
					value={limit}
					onChangeValue={setLimit}
					testID="budget.sheet.limit.input"
				/>
			</Screen>
		</Modal>
	);
}

// Design 39: this month's limits per expense category.
export function BudgetScreen() {
	const { colors, typography, fonts, spacing, radius } = useAppTheme();
	const today = useToday();
	const month = monthOf(today);
	const budgets = useBudgets(month);
	const [tab, setTab] = useState<"all" | "warn">("all");
	const [editing, setEditing] = useState<BudgetItem | "new" | null>(null);

	const header = (
		<View style={[styles.line, { gap: spacing.sm }]}>
			<Text
				accessibilityRole="header"
				style={[typography.title, styles.grow, { color: colors.text }]}
			>
				{fill(tr.budget.title, { month: monthTitle(month) })}
			</Text>
			<IconButton
				icon="add"
				label={tr.budget.add}
				onPress={() => {
					setEditing("new");
				}}
				testID="budget.add.button"
			/>
		</View>
	);

	let body: React.ReactNode;
	if (budgets.isPending) {
		body = <LoadingState rows={4} testID="budget.loading" />;
	} else if (budgets.isError) {
		body = (
			<ErrorState
				message={messageForError(budgets.error)}
				onRetry={() => {
					void budgets.refetch();
				}}
				testID="budget.error"
			/>
		);
	} else if (budgets.data.items.length === 0) {
		body = (
			<EmptyState
				title={tr.budget.emptyTitle}
				body={tr.budget.emptyBody}
				actionLabel={tr.budget.add}
				onAction={() => {
					setEditing("new");
				}}
				actionTestID="budget.empty.action"
				testID="budget.empty"
			/>
		);
	} else {
		const { items, total_limit_minor, total_spent_minor } = budgets.data;
		const clock = monthClock(today, month);
		const spentPercent = percentOf(total_spent_minor, total_limit_minor);
		const shown =
			tab === "all"
				? items
				: items.filter((i) => budgetLevel(i.spent_minor, i.limit_minor) !== "ok");
		body = (
			<>
				<View
					testID="budget.summary"
					style={{
						backgroundColor: colors.surface,
						borderColor: colors.border,
						borderWidth: 1,
						borderRadius: radius.lg,
						padding: 16,
						gap: 6,
					}}
				>
					<View style={styles.between}>
						<Text style={[typography.label, { color: colors.textMuted }]}>
							{tr.budget.spentOfTotal}
						</Text>
						<Text
							style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}
						>
							{fill(tr.budget.daysLeft, { count: String(clock.daysLeft) })}
						</Text>
					</View>
					<View style={[styles.line, { gap: 8, alignItems: "baseline" }]}>
						<Text
							testID="budget.spent.amount"
							style={{
								fontFamily: fonts.extrabold,
								fontSize: 28,
								color: colors.text,
								fontVariant: ["tabular-nums"],
							}}
						>
							{formatTRY(total_spent_minor)}
						</Text>
						<Text style={[typography.callout, { color: colors.textMuted }]}>
							{`/ ${formatTRY(total_limit_minor)}`}
						</Text>
					</View>
					<Bar
						percent={spentPercent}
						tone={spentPercent > 100 ? "overdue" : "accent"}
						height={10}
						accessibilityLabel={fill(tr.budget.monthProgress, {
							spent: String(spentPercent),
							elapsed: String(clock.elapsedPercent),
						})}
					/>
					<Text style={[typography.micro, { color: colors.textMuted }]}>
						{fill(tr.budget.today, { percent: String(clock.elapsedPercent) })}
					</Text>
					<Text
						testID="budget.daily.text"
						style={[typography.caption, { color: colors.text }]}
					>
						{total_spent_minor > total_limit_minor
							? fill(tr.budget.overTotal, {
									amount: formatTRY(total_spent_minor - total_limit_minor),
								})
							: fill(tr.budget.dailyLeft, {
									amount: formatTRY(
										dailyAllowance(
											total_limit_minor,
											total_spent_minor,
											clock.daysLeft,
										),
									),
								})}
					</Text>
				</View>
				<SegmentedControl
					label={tr.budget.all}
					hideLabel
					options={[
						{ value: "all", label: tr.budget.all },
						{ value: "warn", label: tr.budget.warn },
					]}
					value={tab}
					onChange={setTab}
					testID="budget.tab"
				/>
				{shown.length === 0 ? (
					<Text
						testID="budget.warnEmpty"
						style={[typography.body, { color: colors.textMuted }]}
					>
						{tr.budget.warnEmpty}
					</Text>
				) : (
					<View
						style={{
							backgroundColor: colors.surface,
							borderColor: colors.border,
							borderWidth: 1,
							borderRadius: radius.lg,
						}}
					>
						{shown.map((item, index) => (
							<View key={item.category}>
								{index > 0 ? (
									<View
										style={[
											styles.divider,
											{ backgroundColor: colors.divider },
										]}
									/>
								) : null}
								<CategoryRow
									item={item}
									onPress={() => {
										setEditing(item);
									}}
								/>
							</View>
						))}
					</View>
				)}
			</>
		);
	}

	const used = new Set(budgets.data?.items.map((i) => i.category) ?? []);
	const free = EXPENSE_CATEGORIES.filter((c) => !used.has(c));
	return (
		<Screen testID="budget.screen" edges={["bottom"]}>
			{header}
			{body}
			{editing === null ? null : (
				<LimitSheet
					visible
					initial={editing === "new" ? null : editing}
					free={free}
					onClose={() => {
						setEditing(null);
					}}
				/>
			)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	grow: { flex: 1, minWidth: 0 },
	line: { flexDirection: "row", alignItems: "center" },
	between: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
	item: { paddingVertical: 14 },
	mark: {
		width: 36,
		height: 36,
		borderRadius: 11,
		alignItems: "center",
		justifyContent: "center",
	},
	end: { alignItems: "flex-end" },
	start: { alignItems: "flex-start" },
	divider: { height: 1 },
	wrap: { flexDirection: "row", flexWrap: "wrap" },
});
