import { daysBetween, formatDateTR, formatTRY, type IsoDate } from "@paramnet/shared";
import { router } from "expo-router";
import { Children, isValidElement, useState, type ReactNode } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useAgreements } from "@/api/hooks";
import type { AgreementSummary } from "@/api/types";
import { ActionButton } from "@/components/ActionButton";
import { AmountText } from "@/components/AmountText";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { Icon } from "@/components/Icon";
import { LoadingState } from "@/components/LoadingState";
import { ProgressBar } from "@/components/ProgressBar";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { SegmentedControl } from "@/components/SegmentedControl";
import {
	AgreementStatusBadge,
	Badge,
	type BadgeTone,
	InstallmentStatusBadge,
} from "@/components/StatusBadge";
import { IconButton } from "@/components/TopBar";
import { dueText } from "@/features/agreements/dueText";
import { useNewDraft } from "@/features/new/draftStore";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { useAppTheme } from "@/theme/useAppTheme";

type Side = "payable" | "receivable";

const CLOSED = new Set(["settled", "cancelled", "rejected"]);
// An upcoming installment inside this many days is shown in amber, like the design's "3. taksit".
const SOON_DAYS = 7;

function openAgreement(id: string) {
	router.push({ pathname: "/agreement/[id]", params: { id } });
}

// Design 12 ".av": people get initials; an installment purchase gets a layers icon in a rounded square.
function RowAvatar({ agreement }: { agreement: AgreementSummary }) {
	const { colors } = useAppTheme();
	if (agreement.kind === "installment_purchase") {
		return (
			<View style={[styles.square, { backgroundColor: colors.warningSoft }]}>
				<Icon name="layers" size={20} tone="warning" />
			</View>
		);
	}
	return <Avatar name={agreement.counterparty.display_name} />;
}

function rowTitle(agreement: AgreementSummary): string {
	return agreement.kind === "installment_purchase"
		? agreement.title
		: agreement.counterparty.display_name;
}

function rowSubtitle(agreement: AgreementSummary): string {
	if (agreement.kind === "installment_purchase") {
		return `${agreement.counterparty.display_name} · ${tr.debts.installmentPurchase}`;
	}
	const due = agreement.next_installment?.due_date ?? null;
	const when =
		due === null
			? tr.debts.noDueDate
			: fill(tr.debts.due, { date: formatDateTR(due, "dayMonth") });
	return `${tr.debts.personalLoan} · ${when}`;
}

function RowBadge({ agreement, today }: { agreement: AgreementSummary; today: IsoDate }) {
	const next = agreement.next_installment;
	if (agreement.reported_minor > 0) {
		return (
			<Badge
				label={fill(tr.debts.awaitingConfirm, {
					amount: formatTRY(agreement.reported_minor),
				})}
				tone="warning"
			/>
		);
	}
	if (next === null) {
		return <AgreementStatusBadge status={agreement.status} />;
	}
	if (agreement.kind === "installment_purchase" && next.due_date !== null) {
		const { status } = next.state;
		const tone: BadgeTone =
			status === "overdue"
				? "overdue"
				: status === "due_today" || daysBetween(today, next.due_date) <= SOON_DAYS
					? "warning"
					: "neutral";
		return (
			<Badge
				label={fill(tr.debts.nextInstallment, {
					seq: String(next.seq),
					date: formatDateTR(next.due_date, "dayMonth"),
				})}
				tone={tone}
			/>
		);
	}
	if (next.state.partial && next.state.status === "upcoming") {
		return <Badge label={tr.installment.partial} tone="pending" />;
	}
	return <InstallmentStatusBadge status={next.state.status} partial={next.state.partial} />;
}

function rowRight(agreement: AgreementSummary, today: IsoDate): string {
	const due = agreement.next_installment?.due_date ?? null;
	if (agreement.kind === "loan" && due !== null) {
		return dueText(due, today);
	}
	return fill(tr.debts.paidCount, {
		paid: String(agreement.paid_installment_count),
		count: String(agreement.installment_count),
	});
}

// Design 12 ".it": avatar, title and subtitle, amount; a progress bar on what I owe; badge and timing.
function AgreementRow({ agreement }: { agreement: AgreementSummary }) {
	const { colors, fonts } = useAppTheme();
	const today = useToday();
	const receivable = agreement.my_role === "creditor";
	const paid = agreement.principal_minor - agreement.outstanding_minor;
	const testID = `debts.item.${agreement.id}`;
	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={`${rowTitle(agreement)} · ${rowSubtitle(agreement)}`}
			onPress={() => {
				openAgreement(agreement.id);
			}}
			style={({ pressed }) => [styles.item, { opacity: pressed ? 0.7 : 1 }]}
		>
			<View style={styles.head}>
				<RowAvatar agreement={agreement} />
				<View style={styles.grow}>
					<Text
						numberOfLines={1}
						style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text }}
					>
						{rowTitle(agreement)}
					</Text>
					<Text
						numberOfLines={1}
						style={[styles.t2, { fontFamily: fonts.medium, color: colors.textMuted }]}
					>
						{rowSubtitle(agreement)}
					</Text>
				</View>
				<View style={styles.end}>
					<AmountText
						minor={agreement.outstanding_minor}
						tone={receivable ? "receivable" : "text"}
						style={{ fontFamily: fonts.extrabold, fontSize: 16, lineHeight: 21 }}
					/>
					{receivable ? null : (
						<Text
							style={{
								fontFamily: fonts.medium,
								fontSize: 12,
								color: colors.textMuted,
							}}
						>
							{fill(tr.debts.of, { amount: formatTRY(agreement.principal_minor) })}
						</Text>
					)}
				</View>
			</View>
			{receivable ? null : (
				<ProgressBar
					value={agreement.principal_minor === 0 ? 0 : paid / agreement.principal_minor}
					label={fill(tr.agreement.paidOf, {
						paid: formatTRY(paid),
						amount: formatTRY(agreement.principal_minor),
					})}
					testID={`${testID}.progress`}
				/>
			)}
			<View style={styles.between}>
				<RowBadge agreement={agreement} today={today} />
				<Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted }}>
					{rowRight(agreement, today)}
				</Text>
			</View>
		</Pressable>
	);
}

// Design ".lb" + ".card": a 13/700 label over a card of rows split by hairlines.
function Section({
	label,
	children,
	testID,
}: {
	label: string;
	children: ReactNode[];
	testID?: string;
}) {
	const { colors, fonts } = useAppTheme();
	return (
		<View testID={testID}>
			<Text style={[styles.label, { fontFamily: fonts.bold, color: colors.textMuted }]}>
				{label}
			</Text>
			<Card style={styles.listCard}>
				{Children.toArray(children).map((child, index) => (
					<View
						// toArray drops empty slots and keys every child.
						key={isValidElement(child) ? child.key : index}
						style={
							index === 0
								? undefined
								: { borderTopWidth: 1, borderTopColor: colors.divider }
						}
					>
						{child}
					</View>
				))}
			</Card>
		</View>
	);
}

function Content({ agreements, side }: { agreements: AgreementSummary[]; side: Side }) {
	const { colors, fonts, typography, spacing } = useAppTheme();
	const start = useNewDraft((state) => state.start);
	const receivable = side === "receivable";
	const role = receivable ? "creditor" : "debtor";
	const mine = agreements.filter((a) => a.my_role === role);
	const open = mine.filter((a) => !CLOSED.has(a.status));
	const closed = mine.filter((a) => CLOSED.has(a.status));
	const total = open.reduce((sum, a) => sum + a.outstanding_minor, 0);

	return (
		<>
			<Card style={{ gap: 0 }}>
				<Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textMuted }}>
					{receivable ? tr.debts.totalReceivable : tr.debts.totalPayable}
				</Text>
				<AmountText
					minor={total}
					tone={receivable ? "receivable" : "text"}
					style={[styles.total, { fontFamily: fonts.extrabold }]}
					testID="debts.total.amount"
				/>
				<Text
					style={{
						fontFamily: fonts.medium,
						fontSize: 12,
						marginTop: 2,
						color: colors.textMuted,
					}}
				>
					{receivable ? tr.debts.noteReceivable : tr.debts.notePayable}
				</Text>
				<View style={[styles.actions, { gap: spacing.sm }]}>
					{receivable ? (
						<>
							<ActionButton
								label={tr.debts.lend}
								icon="arrowUpRight"
								strokeWidth={2.2}
								onPress={() => {
									start("lent");
									router.push("/new/form");
								}}
								testID="debts.action.lent"
							/>
							<ActionButton
								label={tr.debts.addPerson}
								icon="user"
								onPress={() => {
									router.push("/contacts");
								}}
								testID="debts.action.contacts"
							/>
						</>
					) : (
						<>
							<ActionButton
								label={tr.debts.borrow}
								icon="arrowDownLeft"
								strokeWidth={2.2}
								onPress={() => {
									start("borrowed");
									router.push("/new/form");
								}}
								testID="debts.action.borrowed"
							/>
							<ActionButton
								label={tr.debts.request}
								icon="request"
								soon
								onPress={() => undefined}
								testID="debts.action.request"
							/>
						</>
					)}
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
					{receivable ? tr.debts.emptyReceivable : tr.debts.emptyPayable}
				</Text>
			) : (
				<Section label={receivable ? tr.debts.sectionReceivable : tr.debts.sectionPayable}>
					{open.map((agreement) => (
						<AgreementRow key={agreement.id} agreement={agreement} />
					))}
				</Section>
			)}

			{closed.length === 0 ? null : (
				<Section label={tr.debts.closed} testID="debts.closed">
					{closed.map((agreement) => (
						<Pressable
							key={agreement.id}
							testID={`debts.closed.${agreement.id}`}
							accessibilityRole="button"
							accessibilityLabel={`${rowTitle(agreement)} · ${rowSubtitle(agreement)}`}
							onPress={() => {
								openAgreement(agreement.id);
							}}
							style={[styles.item, styles.head]}
						>
							<RowAvatar agreement={agreement} />
							<View style={styles.grow}>
								<Text
									numberOfLines={1}
									style={{
										fontFamily: fonts.bold,
										fontSize: 15,
										color: colors.text,
									}}
								>
									{rowTitle(agreement)}
								</Text>
								<Text
									numberOfLines={1}
									style={[
										styles.t2,
										{ fontFamily: fonts.medium, color: colors.textMuted },
									]}
								>
									{rowSubtitle(agreement)}
								</Text>
							</View>
							<AgreementStatusBadge status={agreement.status} />
						</Pressable>
					))}
				</Section>
			)}
		</>
	);
}

// Design 12 "Borç & Alacak": one tab per side, the open total with two actions, then the list.
export function DebtsScreen() {
	const agreements = useAgreements();
	const [side, setSide] = useState<Side>("payable");

	return (
		<Screen
			testID="debts.screen"
			gap={18}
			refreshControl={
				<RefreshControl
					refreshing={agreements.isRefetching}
					onRefresh={() => {
						void agreements.refetch();
					}}
				/>
			}
		>
			<View style={styles.top}>
				<View style={styles.grow}>
					<ScreenTitle>{tr.debts.title}</ScreenTitle>
				</View>
				<IconButton
					icon="plus"
					label={tr.debts.newRecord}
					onPress={() => {
						router.push("/new");
					}}
					testID="debts.new.button"
				/>
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
	top: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 4 },
	head: { flexDirection: "row", alignItems: "center", gap: 12 },
	between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	grow: { flex: 1, minWidth: 0 },
	end: { alignItems: "flex-end" },
	actions: { flexDirection: "row", marginTop: 14 },
	item: { paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
	t2: { fontSize: 13, lineHeight: 18, marginTop: 2 },
	label: { fontSize: 13, lineHeight: 18, paddingHorizontal: 4, paddingBottom: 8 },
	listCard: { padding: 0, gap: 0 },
	total: {
		fontSize: 30,
		lineHeight: 38,
		letterSpacing: -0.6,
		marginTop: 2,
	},
	square: {
		width: 42,
		height: 42,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
	},
});
