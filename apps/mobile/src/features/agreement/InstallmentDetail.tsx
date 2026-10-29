import { daysBetween, formatDateTR, formatTRY, type IsoDate } from "@paramnet/shared";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import type { AgreementDetail, InstallmentView } from "@/api/types";
import { AmountText } from "@/components/AmountText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { SectionHeader } from "@/components/SectionHeader";
import { AgreementStatusBadge, Badge, type BadgeTone } from "@/components/StatusBadge";
import { nextOpenIndex, paidOnDates, rowTiming } from "./installmentPlan";
import { KeyValue, Rows } from "./parts";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { useIsOnline } from "@/lib/network";
import { useAppTheme } from "@/theme/useAppTheme";

type Look = { tone: BadgeTone; label: string; mark: "paid" | "next" | "late" | "none" };

// Design 25 badges: Ödendi, Yaklaşıyor (next within a week), Planlı; a late row stays red.
function lookOf(row: InstallmentView, today: IsoDate): Look {
	if (row.state.status === "paid") {
		return { tone: "success", label: tr.installment.status.paid, mark: "paid" };
	}
	if (row.state.status === "overdue") {
		return { tone: "overdue", label: tr.installment.status.overdue, mark: "late" };
	}
	if (row.state.status === "due_today") {
		return { tone: "warning", label: tr.installment.status.due_today, mark: "next" };
	}
	return rowTiming(row.due_date, today).kind === "soon"
		? { tone: "warning", label: tr.installment.status.upcoming, mark: "next" }
		: { tone: "neutral", label: tr.agreement.planned, mark: "none" };
}

function dueInText(due: IsoDate | null, today: IsoDate): string | null {
	if (due === null) {
		return null;
	}
	const days = daysBetween(today, due);
	if (days === 0) {
		return tr.agreement.dueToday;
	}
	return days > 0
		? fill(tr.agreement.daysLeft, { days: String(days) })
		: fill(tr.agreement.overdueBy, { days: String(-days) });
}

function Summary({ agreement }: { agreement: AgreementDetail }) {
	const { colors, typography, spacing } = useAppTheme();
	const today = useToday();
	const rows = agreement.installments;
	const paidRows = rows.filter((row) => row.state.status === "paid").length;
	const installed = agreement.principal_minor - agreement.down_payment_minor;
	const paid = agreement.principal_minor - agreement.outstanding_minor;
	const last = rows[rows.length - 1]?.due_date ?? null;
	const markColor = {
		paid: colors.accent,
		next: colors.warningMark,
		late: colors.overdue,
		none: colors.border,
	};
	return (
		<Card testID="agreement.summary" style={{ paddingVertical: 18 }}>
			<View style={styles.between}>
				<Text
					testID="agreement.counterparty.text"
					numberOfLines={1}
					style={[typography.label, styles.shrink, { color: colors.textMuted }]}
				>
					{fill(tr.agreement.installmentKind, {
						name: agreement.counterparty.display_name,
					})}
				</Text>
				<Badge
					label={fill(tr.agreement.paidCount, {
						paid: String(paidRows),
						count: String(rows.length),
					})}
					tone="neutral"
					testID="agreement.paidCount.badge"
				/>
			</View>
			<Text style={[typography.label, { color: colors.textMuted, marginTop: 14 }]}>
				{tr.agreement.remaining}
			</Text>
			<View style={[styles.baseline, { gap: spacing.sm }]}>
				<AmountText
					minor={agreement.outstanding_minor}
					variant="amountXL"
					testID="agreement.outstanding.text"
				/>
				<Text style={[typography.callout, { color: colors.textMuted }]}>/</Text>
				<AmountText
					minor={installed}
					variant="callout"
					tone="textMuted"
					testID="agreement.total.text"
				/>
			</View>
			<View
				accessibilityRole="image"
				accessibilityLabel={fill(tr.agreement.segmentsLabel, {
					count: String(rows.length),
					paid: String(paidRows),
				})}
				testID="agreement.segments"
				style={[styles.segments, { marginTop: spacing.md }]}
			>
				{rows.map((row) => (
					<View
						key={row.seq}
						style={[
							styles.segment,
							{ backgroundColor: markColor[lookOf(row, today).mark] },
						]}
					/>
				))}
			</View>
			<View style={[styles.between, { marginTop: 6, gap: spacing.sm }]}>
				<Text
					testID="agreement.paidWithDown.text"
					style={[typography.caption, styles.shrink, { color: colors.textMuted }]}
				>
					{fill(
						agreement.down_payment_minor > 0
							? tr.agreement.paidWithDown
							: tr.agreement.paidTotal,
						{ amount: formatTRY(paid) },
					)}
				</Text>
				{last === null ? null : (
					<Text style={[typography.caption, { color: colors.textMuted }]}>
						{fill(tr.agreement.lastDue, { date: formatDateTR(last, "short") })}
					</Text>
				)}
			</View>
		</Card>
	);
}

// Design 25 "Sıradaki": the next row to pay with both ways to record it.
function NextCard({
	agreement,
	primaryLabel,
}: {
	agreement: AgreementDetail;
	primaryLabel: string;
}) {
	const { colors, typography, spacing, radius } = useAppTheme();
	const today = useToday();
	const online = useIsOnline();
	const index = nextOpenIndex(agreement.installments);
	const next = agreement.installments[index];
	if (next === undefined) {
		return null;
	}
	const due = next.amount_minor - next.paid_minor;
	const dueIn = dueInText(next.due_date, today);
	const late = next.state.status === "overdue";
	function openPayment(amount?: number) {
		router.push({
			pathname: "/agreement/[id]/payment",
			params:
				amount === undefined
					? { id: agreement.id }
					: { id: agreement.id, amount: String(amount) },
		});
	}
	return (
		<View
			testID="agreement.next"
			style={{
				borderRadius: radius.lg,
				borderWidth: 1,
				borderColor: colors.warningBorder,
				backgroundColor: colors.warningTint,
				padding: spacing.lg,
			}}
		>
			<View style={styles.between}>
				<View style={styles.shrink}>
					<Text style={[typography.label, { color: colors.warning }]}>
						{fill(tr.agreement.next, { seq: String(next.seq) })}
					</Text>
					<AmountText minor={due} variant="amountL" testID="agreement.next.amount" />
				</View>
				<View style={{ alignItems: "flex-end", gap: spacing.xs }}>
					{next.due_date === null ? null : (
						<Text style={[typography.headline, { color: colors.text }]}>
							{formatDateTR(next.due_date, "dayMonth")}
						</Text>
					)}
					{dueIn === null ? null : (
						<Badge label={dueIn} tone={late ? "overdue" : "warning"} />
					)}
				</View>
			</View>
			<View style={[styles.grid, { gap: spacing.sm, marginTop: 14 }]}>
				<View style={styles.cell}>
					<Button
						label={tr.agreement.partialPay}
						variant="secondary"
						disabled={!online}
						onPress={() => {
							openPayment();
						}}
						testID="agreement.partialPay.button"
					/>
				</View>
				<View style={styles.cell}>
					<Button
						label={primaryLabel}
						disabled={!online}
						onPress={() => {
							openPayment(due);
						}}
						testID="agreement.primaryAction.button"
					/>
				</View>
			</View>
			{online ? null : (
				<Text style={[typography.caption, { color: colors.textMuted, marginTop: 8 }]}>
					{tr.error.offline}
				</Text>
			)}
		</View>
	);
}

function RowNumber({ label, tone }: { label: string; tone: BadgeTone }) {
	const { colors, typography } = useAppTheme();
	const [fg, bg] = {
		success: [colors.success, colors.successSoft],
		warning: [colors.warning, colors.warningSoft],
		overdue: [colors.overdue, colors.overdueSoft],
		pending: [colors.pending, colors.pendingSoft],
		primary: [colors.primary, colors.primarySoft],
		neutral: [colors.textMuted, colors.surfaceSunken],
	}[tone];
	return (
		<View style={[styles.no, { backgroundColor: bg }]}>
			<Text style={[typography.label, { color: fg }]}>{label}</Text>
		</View>
	);
}

function PlanLine({
	no,
	tone,
	title,
	subtitle,
	amount,
	badge,
	testID,
}: {
	no: string;
	tone: BadgeTone;
	title: string;
	subtitle: string;
	amount: number;
	badge: string;
	testID: string;
}) {
	const { colors, typography, spacing } = useAppTheme();
	return (
		<View testID={testID} style={[styles.row, styles.line, { gap: spacing.md }]}>
			<RowNumber label={no} tone={tone} />
			<View style={styles.grow}>
				<Text style={[typography.rowTitle, { color: colors.text }]}>{title}</Text>
				<Text style={[typography.caption, { color: colors.textMuted }]}>{subtitle}</Text>
			</View>
			<View style={{ alignItems: "flex-end", gap: 3 }}>
				<AmountText minor={amount} variant="rowTitle" />
				<Badge label={badge} tone={tone} />
			</View>
		</View>
	);
}

function yearOf(date: IsoDate): string {
	return date.slice(0, 4);
}

function rowSubtitle(
	row: InstallmentView,
	paidOn: string | null,
	isLast: boolean,
	today: IsoDate,
): string {
	if (row.state.status === "paid") {
		return paidOn === null
			? tr.installment.status.paid
			: fill(tr.agreement.paidOnRow, { date: formatDateTR(paidOn, "short") });
	}
	if (row.paid_minor > 0) {
		return fill(tr.agreement.paidSoFar, { amount: formatTRY(row.paid_minor) });
	}
	if (row.due_date === null) {
		return tr.installment.noDueDate;
	}
	const timing = rowTiming(row.due_date, today);
	if (timing.kind === "soon") {
		return fill(tr.agreement.inDays, { days: String(timing.days) });
	}
	if (timing.kind === "today" || timing.kind === "past") {
		return dueInText(row.due_date, today) ?? "";
	}
	return isLast
		? fill(tr.agreement.lastRowYear, { year: yearOf(row.due_date) })
		: yearOf(row.due_date);
}

function PlanSection({ agreement }: { agreement: AgreementDetail }) {
	const today = useToday();
	const rows = agreement.installments;
	const dates = paidOnDates(rows, agreement.payments);
	const down = agreement.payments.find((p) => p.kind === "down_payment");
	return (
		<View style={{ gap: 10 }}>
			<SectionHeader>{tr.agreement.planSection}</SectionHeader>
			<Rows>
				{[
					...(down === undefined
						? []
						: [
								<PlanLine
									key="down"
									no="P"
									tone="success"
									title={tr.agreement.downRow}
									subtitle={formatDateTR(down.paid_on, "short")}
									amount={down.amount_minor}
									badge={tr.installment.status.paid}
									testID="agreement.plan.down"
								/>,
							]),
					...rows.map((row, index) => {
						const look = lookOf(row, today);
						return (
							<PlanLine
								key={row.seq}
								no={String(row.seq)}
								tone={look.tone}
								title={
									row.due_date === null
										? tr.installment.noDueDate
										: formatDateTR(row.due_date, "dayMonth")
								}
								subtitle={rowSubtitle(
									row,
									dates[index] ?? null,
									index === rows.length - 1 && rows.length > 1,
									today,
								)}
								amount={row.amount_minor}
								badge={look.label}
								testID={`agreement.installment.${String(row.seq)}.row`}
							/>
						);
					}),
				]}
			</Rows>
		</View>
	);
}

function InfoSection({ agreement, record }: { agreement: AgreementDetail; record: string }) {
	const { colors, typography } = useAppTheme();
	const sold = agreement.my_role === "creditor";
	return (
		<View style={{ gap: 10 }}>
			<SectionHeader>{tr.agreement.infoSection}</SectionHeader>
			<Rows>
				{[
					<KeyValue
						key="price"
						label={tr.agreement.price}
						value={formatTRY(agreement.principal_minor)}
					/>,
					...(agreement.started_on === null
						? []
						: [
								<KeyValue
									key="started"
									label={sold ? tr.agreement.soldOn : tr.agreement.purchasedOn}
									value={formatDateTR(agreement.started_on, "long")}
									testID="agreement.purchasedOn.text"
								/>,
							]),
					...(agreement.notes === null
						? []
						: [
								<KeyValue
									key="notes"
									label={tr.agreement.notesLabel}
									value={agreement.notes}
								/>,
							]),
					<KeyValue
						key="record"
						label={tr.agreement.recordLabel}
						value={
							<View style={[styles.row, styles.shrink, { gap: 8 }]}>
								<Text
									numberOfLines={1}
									style={[
										typography.rowTitle,
										styles.shrink,
										{ color: colors.text },
									]}
								>
									{record}
								</Text>
								<AgreementStatusBadge
									status={agreement.status}
									testID="agreement.status.badge"
								/>
							</View>
						}
					/>,
				]}
			</Rows>
		</View>
	);
}

// Design 25: an elden taksit record — what is left, the next row, the plan and the facts.
export function InstallmentDetail({
	agreement,
	primaryLabel,
	canPay,
	record,
}: {
	agreement: AgreementDetail;
	primaryLabel: string;
	canPay: boolean;
	record: string;
}) {
	return (
		<>
			<Summary agreement={agreement} />
			{canPay ? <NextCard agreement={agreement} primaryLabel={primaryLabel} /> : null}
			<PlanSection agreement={agreement} />
			<InfoSection agreement={agreement} record={record} />
		</>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", alignItems: "center" },
	between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	baseline: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" },
	grid: { flexDirection: "row" },
	cell: { flex: 1, minWidth: 0 },
	grow: { flex: 1, minWidth: 0 },
	shrink: { flexShrink: 1, minWidth: 0 },
	segments: { flexDirection: "row", gap: 4 },
	segment: { flex: 1, height: 8, borderRadius: 4 },
	line: { paddingVertical: 10, minHeight: 60 },
	no: {
		width: 30,
		height: 30,
		borderRadius: 9,
		alignItems: "center",
		justifyContent: "center",
	},
});
