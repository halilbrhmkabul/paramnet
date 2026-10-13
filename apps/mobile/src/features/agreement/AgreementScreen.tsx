import {
	daysBetween,
	formatDateTimeTR,
	formatDateTR,
	formatTRY,
	type IsoDate,
} from "@paramnet/shared";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Children, isValidElement, type ReactNode } from "react";
import {
	ActionSheetIOS,
	Alert,
	Platform,
	RefreshControl,
	StyleSheet,
	Text,
	View,
} from "react-native";

import { messageForError } from "@/api/errors";
import { useAgreement, useDecidePayment, useWithdrawPayment } from "@/api/hooks";
import type { AgreementDetail, EventView, InstallmentView, PaymentView } from "@/api/types";
import { AmountText } from "@/components/AmountText";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { Icon, type IconName } from "@/components/Icon";
import { LoadingState } from "@/components/LoadingState";
import { ProgressBar } from "@/components/ProgressBar";
import { Screen } from "@/components/Screen";
import {
	AgreementStatusBadge,
	Badge,
	type BadgeTone,
	InstallmentStatusBadge,
} from "@/components/StatusBadge";
import { IconButton } from "@/components/TopBar";
import { DisputeCancelActions } from "./DisputeCancelActions";
import { describeEvent } from "./HistoryScreen";
import { SharedStateActions } from "./SharedStateActions";
import { dueText } from "@/features/agreements/dueText";
import { DetailTabBar } from "@/features/navigation/AppTabBar";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { useIsOnline } from "@/lib/network";
import type { ColorToken } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

// BR-14: no new payments on closed or disputed agreements; amendment_pending keeps the old terms.
function canAddPayment(agreement: AgreementDetail): boolean {
	return ["personal", "active", "amendment_pending"].includes(agreement.status);
}

// screens.md: "Ödeme ekle" in personal mode; on a shared one the creditor received, the debtor paid.
export function paymentActionLabel(agreement: AgreementDetail): string {
	if (agreement.status === "personal") {
		return tr.agreement.addPayment;
	}
	return agreement.my_role === "creditor" ? tr.payment.received : tr.payment.made;
}

// The payment screen opens empty ("Kısmi") or with the amount filled in ("Tamamını öde").
function openPayment(id: string, prefill?: "all" | "next") {
	router.push({
		pathname: "/agreement/[id]/payment",
		params: prefill === undefined ? { id } : { id, prefill },
	});
}

function nextInstallment(agreement: AgreementDetail): InstallmentView | undefined {
	return agreement.installments.find((row) => row.state.status !== "paid");
}

function lastDue(agreement: AgreementDetail): IsoDate | null {
	return agreement.installments.at(-1)?.due_date ?? null;
}

function screenTitle(agreement: AgreementDetail): string {
	if (agreement.kind === "installment_purchase") {
		return agreement.title;
	}
	return agreement.my_role === "creditor" ? tr.agreement.titleReceivable : tr.agreement.titleDebt;
}

// Design ".kv": a muted label and a bold value on one 48 pt line.
function KeyValue({
	label,
	value,
	icon,
	testID,
}: {
	label: string;
	value: string;
	icon?: ReactNode;
	testID?: string;
}) {
	const { colors, fonts } = useAppTheme();
	return (
		<View style={styles.kv}>
			<Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted }}>
				{label}
			</Text>
			<View style={styles.kvValue}>
				{icon}
				<Text
					testID={testID}
					numberOfLines={2}
					style={[
						styles.end,
						{ fontFamily: fonts.bold, fontSize: 14, color: colors.text },
					]}
				>
					{value}
				</Text>
			</View>
		</View>
	);
}

// Design ".h2" + ".card": a 17/800 heading over rows split by hairlines.
function Section({ title, children }: { title: string; children: ReactNode }) {
	const { colors, typography } = useAppTheme();
	return (
		<View>
			<Text
				accessibilityRole="header"
				style={[typography.headline, styles.h2, { color: colors.text }]}
			>
				{title}
			</Text>
			{children}
		</View>
	);
}

function Rows({ children }: { children: ReactNode }) {
	const { colors } = useAppTheme();
	return (
		<Card style={styles.flush}>
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
	);
}

// Design 15: the creditor answers a reported payment right at the top.
function ReportedBanner({
	agreement,
	payment,
}: {
	agreement: AgreementDetail;
	payment: PaymentView;
}) {
	const { colors, fonts, spacing } = useAppTheme();
	const online = useIsOnline();
	const decide = useDecidePayment();
	return (
		<View
			testID={`agreement.reported.${payment.id}`}
			style={[
				styles.banner,
				{ backgroundColor: colors.warningSurface, borderColor: colors.warningBorder },
			]}
		>
			<View style={styles.bannerHead}>
				<Icon name="clock" size={22} tone="warning" strokeWidth={2} />
				<View style={styles.grow}>
					<Text
						style={{ fontFamily: fonts.extrabold, fontSize: 15, color: colors.warning }}
					>
						{fill(tr.agreement.reportedTitle, {
							name: agreement.counterparty.display_name,
							amount: formatTRY(payment.amount_minor),
						})}
					</Text>
					<Text
						style={{
							fontFamily: fonts.medium,
							fontSize: 13,
							lineHeight: 19,
							marginTop: 3,
							color: colors.warning,
						}}
					>
						{fill(tr.agreement.reportedBody, {
							date: formatDateTR(payment.paid_on, "short"),
							method: [tr.payment.methods[payment.method], payment.note]
								.filter((part) => part !== null)
								.join(" · "),
						})}
					</Text>
				</View>
			</View>
			<View style={[styles.pair, { gap: spacing.sm }]}>
				<View style={styles.grow}>
					<Button
						label={tr.agreement.reportedReject}
						variant="secondary"
						disabled={!online}
						onPress={() => {
							decide.mutate({ paymentId: payment.id, decision: "reject" });
						}}
						testID={`agreement.payment.${payment.id}.reject`}
					/>
				</View>
				<View style={styles.grow}>
					<Button
						label={tr.agreement.reportedConfirm}
						disabled={!online}
						loading={decide.isPending && decide.variables.decision === "confirm"}
						onPress={() => {
							decide.mutate({ paymentId: payment.id, decision: "confirm" });
						}}
						testID={`agreement.payment.${payment.id}.confirm`}
					/>
				</View>
			</View>
			{decide.isError ? (
				<Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.overdue }}>
					{messageForError(decide.error)}
				</Text>
			) : null}
		</View>
	);
}

function ShareButton({ agreement }: { agreement: AgreementDetail }) {
	if (agreement.status !== "personal") {
		return null;
	}
	return (
		<View style={{ marginTop: 10 }}>
			<Button
				label={tr.share.action}
				variant="secondary"
				onPress={() => {
					router.push({
						pathname: "/agreement/[id]/share",
						params: { id: agreement.id },
					});
				}}
				testID="agreement.share.button"
			/>
		</View>
	);
}

function PaymentButtons({ agreement }: { agreement: AgreementDetail }) {
	const { colors, typography, spacing } = useAppTheme();
	const online = useIsOnline();
	if (!canAddPayment(agreement)) {
		return null;
	}
	const debtor = agreement.my_role === "debtor";
	const installments = agreement.kind === "installment_purchase";
	return (
		<View style={{ gap: spacing.sm, marginTop: 16 }}>
			{debtor ? (
				<View style={[styles.pair, { gap: 10 }]}>
					<View style={styles.grow}>
						<Button
							label={
								installments
									? tr.agreement.payPartialShort
									: tr.agreement.payPartial
							}
							variant="secondary"
							disabled={!online}
							onPress={() => {
								openPayment(agreement.id);
							}}
							testID="agreement.partialPayment.button"
						/>
					</View>
					<View style={styles.grow}>
						<Button
							label={installments ? tr.agreement.markPaid : tr.agreement.payFull}
							disabled={!online}
							onPress={() => {
								openPayment(agreement.id, installments ? "next" : "all");
							}}
							testID="agreement.primaryAction.button"
						/>
					</View>
				</View>
			) : (
				<Button
					label={paymentActionLabel(agreement)}
					disabled={!online}
					onPress={() => {
						openPayment(agreement.id);
					}}
					testID="agreement.primaryAction.button"
				/>
			)}
			{online ? null : (
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{tr.error.offline}
				</Text>
			)}
		</View>
	);
}

function Amounts({
	agreement,
	label,
	size = 34,
}: {
	agreement: AgreementDetail;
	label: string;
	size?: number;
}) {
	const { colors, fonts } = useAppTheme();
	const receivable = agreement.my_role === "creditor";
	return (
		<>
			<Text
				testID="agreement.role.text"
				style={{
					fontFamily: fonts.bold,
					fontSize: 13,
					color: colors.textMuted,
					marginTop: 18,
				}}
			>
				{label}
			</Text>
			<View style={styles.baseline}>
				<AmountText
					minor={agreement.outstanding_minor}
					tone={receivable ? "receivable" : "text"}
					style={[
						styles.big,
						{ fontFamily: fonts.extrabold, fontSize: size, lineHeight: size + 6 },
					]}
					testID="agreement.outstanding.text"
				/>
				<Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted }}>
					{"/ "}
					<AmountText
						minor={agreement.principal_minor}
						tone="textMuted"
						style={{ fontFamily: fonts.medium, fontSize: 14 }}
						testID="agreement.total.text"
					/>
				</Text>
			</View>
		</>
	);
}

function Footnote({ left, right }: { left: string; right: string | null }) {
	const { colors, fonts } = useAppTheme();
	const style = { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted };
	return (
		<View style={[styles.between, { marginTop: 6 }]}>
			<Text style={style}>{left}</Text>
			{right === null ? null : <Text style={style}>{right}</Text>}
		</View>
	);
}

// Design 13 / 15: who, what is left of what, the bar, and the payment buttons.
function LoanSummary({ agreement }: { agreement: AgreementDetail }) {
	const { colors, fonts } = useAppTheme();
	const today = useToday();
	const paid = agreement.principal_minor - agreement.outstanding_minor;
	const receivable = agreement.my_role === "creditor";
	const due = nextInstallment(agreement)?.due_date ?? null;
	return (
		<Card testID="agreement.summary" style={styles.summary}>
			<View style={styles.head}>
				<Avatar name={agreement.counterparty.display_name} size={48} />
				<View style={styles.grow}>
					<Text
						testID="agreement.counterparty.text"
						numberOfLines={1}
						style={{ fontFamily: fonts.extrabold, fontSize: 16, color: colors.text }}
					>
						{agreement.counterparty.display_name}
					</Text>
					<Text
						testID="agreement.title.text"
						numberOfLines={1}
						style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted }}
					>
						{agreement.title}
					</Text>
				</View>
				<AgreementStatusBadge
					status={agreement.status}
					size="lg"
					testID="agreement.status.badge"
				/>
			</View>
			<Amounts
				agreement={agreement}
				label={receivable ? tr.agreement.remainingReceivable : tr.agreement.remainingDebt}
			/>
			<View style={{ marginTop: 10 }}>
				<ProgressBar
					value={agreement.principal_minor === 0 ? 0 : paid / agreement.principal_minor}
					label={fill(tr.agreement.paidOf, {
						paid: formatTRY(paid),
						amount: formatTRY(agreement.principal_minor),
					})}
					height={8}
					testID="agreement.progress"
				/>
			</View>
			<Footnote
				left={fill(tr.agreement.paidLine, { amount: formatTRY(paid) })}
				right={
					due === null || agreement.outstanding_minor === 0
						? null
						: `${fill(tr.agreement.dueOn, { date: formatDateTR(due, "dayMonth") })}${
								receivable ? ` · ${dueText(due, today)}` : ""
							}`
				}
			/>
			<Awaiting agreement={agreement} />
			<PaymentButtons agreement={agreement} />
			<ShareButton agreement={agreement} />
		</Card>
	);
}

function Awaiting({ agreement }: { agreement: AgreementDetail }) {
	const { colors, typography } = useAppTheme();
	if (agreement.reported_minor === 0) {
		return null;
	}
	return (
		<Text
			testID="agreement.awaiting.text"
			style={[typography.caption, { color: colors.warning, marginTop: 6 }]}
		>
			{fill(tr.payment.awaiting, { amount: formatTRY(agreement.reported_minor) })}
		</Text>
	);
}

const SEGMENT_COLORS: Record<string, ColorToken> = {
	paid: "accent",
	next: "amber",
	rest: "border",
};

// Design 25: one segment per installment instead of a single bar.
function Segments({ agreement }: { agreement: AgreementDetail }) {
	const { colors } = useAppTheme();
	const next = nextInstallment(agreement);
	const paidCount = agreement.paid_installment_count;
	return (
		<View
			testID="agreement.progress"
			accessibilityRole="progressbar"
			accessibilityLabel={fill(tr.debts.paidCount, {
				paid: String(paidCount),
				count: String(agreement.installment_count),
			})}
			accessibilityValue={{
				min: 0,
				max: 100,
				now:
					agreement.principal_minor === 0
						? 0
						: Math.floor(
								((agreement.principal_minor - agreement.outstanding_minor) /
									agreement.principal_minor) *
									100,
							),
			}}
			style={styles.segments}
		>
			{agreement.installments.map((row) => {
				const kind =
					row.state.status === "paid" ? "paid" : row.seq === next?.seq ? "next" : "rest";
				return (
					<View
						key={row.seq}
						style={[
							styles.segment,
							{ backgroundColor: colors[SEGMENT_COLORS[kind] ?? "border"] },
						]}
					/>
				);
			})}
		</View>
	);
}

// Design 25: the purchase, what is left, the plan as segments; then the next installment card.
function InstallmentSummary({ agreement }: { agreement: AgreementDetail }) {
	const { colors, fonts } = useAppTheme();
	const paid = agreement.principal_minor - agreement.outstanding_minor;
	const last = lastDue(agreement);
	return (
		<Card testID="agreement.summary" style={styles.summary}>
			<View style={styles.between}>
				<Text
					testID="agreement.counterparty.text"
					numberOfLines={1}
					style={[
						styles.grow,
						{ fontFamily: fonts.bold, fontSize: 13, color: colors.textMuted },
					]}
				>
					{fill(tr.agreement.installmentKind, {
						name: agreement.counterparty.display_name,
					})}
				</Text>
				<AgreementStatusBadge status={agreement.status} testID="agreement.status.badge" />
				<Badge
					label={fill(tr.debts.paidCount, {
						paid: String(agreement.paid_installment_count),
						count: String(agreement.installment_count),
					})}
					tone="neutral"
				/>
			</View>

			<Amounts agreement={agreement} label={tr.agreement.remaining} size={32} />
			<Segments agreement={agreement} />
			<Footnote
				left={fill(tr.agreement.paidWithDown, { amount: formatTRY(paid) })}
				right={
					last === null
						? null
						: fill(tr.agreement.lastDue, { date: formatDateTR(last, "short") })
				}
			/>
			<Awaiting agreement={agreement} />
			{agreement.my_role === "creditor" ? <PaymentButtons agreement={agreement} /> : null}
			<ShareButton agreement={agreement} />
		</Card>
	);
}

function NextInstallmentCard({ agreement }: { agreement: AgreementDetail }) {
	const { colors, fonts } = useAppTheme();
	const today = useToday();
	const next = nextInstallment(agreement);
	if (next === undefined || agreement.my_role !== "debtor" || !canAddPayment(agreement)) {
		return null;
	}
	const ink = { color: colors.warning };
	return (
		<View
			testID="agreement.next"
			style={[
				styles.banner,
				{ backgroundColor: colors.warningSurface, borderColor: colors.warningBorder },
			]}
		>
			<View style={styles.between}>
				<View>
					<Text style={[{ fontFamily: fonts.extrabold, fontSize: 13 }, ink]}>
						{fill(tr.agreement.nextInstallment, { seq: String(next.seq) })}
					</Text>
					<AmountText
						minor={next.amount_minor - next.paid_minor}
						tone="warning"
						style={{
							fontFamily: fonts.extrabold,
							fontSize: 24,
							lineHeight: 30,
							marginTop: 2,
						}}
					/>
				</View>
				{next.due_date === null ? null : (
					<View style={styles.endColumn}>
						<Text style={[{ fontFamily: fonts.extrabold, fontSize: 15 }, ink]}>
							{formatDateTR(next.due_date, "dayMonth")}
						</Text>
						<Badge
							label={dueText(next.due_date, today)}
							tone={next.state.status === "overdue" ? "overdue" : "warning"}
						/>
					</View>
				)}
			</View>
			<PaymentButtons agreement={agreement} />
		</View>
	);
}

function installmentTone(row: InstallmentView, today: IsoDate): BadgeTone {
	switch (row.state.status) {
		case "paid":
			return "success";
		case "overdue":
			return "overdue";
		case "due_today":
			return "warning";
		default:
			return row.due_date !== null && dueSoon(row.due_date, today) ? "warning" : "neutral";
	}
}

// Like the design's "3 gün sonra" row: an upcoming installment within a week is amber.
function dueSoon(due: IsoDate, today: IsoDate): boolean {
	return daysBetween(today, due) <= 7;
}

const NUMBER_COLORS: Record<BadgeTone, [ColorToken, ColorToken]> = {
	success: ["success", "successSoft"],
	overdue: ["overdue", "overdueSoft"],
	warning: ["warning", "warningSoft"],
	neutral: ["neutral", "surfaceSunken"],
	pending: ["pending", "pendingSoft"],
	primary: ["primary", "primarySoft"],
};

// Design 25 ".ins": a numbered square, the date, and the amount with its state.
function PlanRow({
	mark,
	title,
	subtitle,
	amount,
	tone,
	badge,
	testID,
}: {
	mark: string;
	title: string;
	subtitle: string;
	amount: number;
	tone: BadgeTone;
	badge: ReactNode;
	testID?: string;
}) {
	const { colors, fonts } = useAppTheme();
	const [fg, bg] = NUMBER_COLORS[tone];
	return (
		<View testID={testID} style={styles.ins}>
			<View style={[styles.no, { backgroundColor: colors[bg] }]}>
				<Text style={{ fontFamily: fonts.extrabold, fontSize: 13, color: colors[fg] }}>
					{mark}
				</Text>
			</View>
			<View style={styles.grow}>
				<Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text }}>
					{title}
				</Text>
				<Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted }}>
					{subtitle}
				</Text>
			</View>
			<View style={styles.endColumn}>
				<AmountText
					minor={amount}
					style={{ fontFamily: fonts.extrabold, fontSize: 15, marginBottom: 3 }}
				/>
				{badge}
			</View>
		</View>
	);
}

function Plan({ agreement }: { agreement: AgreementDetail }) {
	const today = useToday();
	const count = agreement.installment_count;
	return (
		<Section
			title={
				agreement.kind === "installment_purchase"
					? tr.agreement.planSection
					: tr.agreement.installments
			}
		>
			<Rows>
				{agreement.down_payment_minor > 0 ? (
					<PlanRow
						mark={tr.agreement.downPaymentMark}
						title={tr.payment.kinds.down_payment}
						subtitle={
							agreement.started_on === null
								? ""
								: formatDateTR(agreement.started_on, "short")
						}
						amount={agreement.down_payment_minor}
						tone="success"
						badge={<Badge label={tr.installment.status.paid} tone="success" />}
					/>
				) : null}
				{agreement.installments.map((row) => {
					const tone = installmentTone(row, today);
					const year = row.due_date === null ? "" : row.due_date.slice(0, 4);
					const subtitle =
						row.state.status === "paid"
							? year
							: row.paid_minor > 0
								? fill(tr.agreement.paidSoFar, {
										amount: formatTRY(row.paid_minor),
									})
								: row.due_date === null
									? tr.installment.noDueDate
									: tone === "neutral"
										? row.seq === count && count > 1
											? `${year} · ${tr.agreement.lastInstallment}`
											: year
										: dueText(row.due_date, today);
					const planned =
						tone === "neutral" && row.state.status === "upcoming" && !row.state.partial;
					return (
						<PlanRow
							key={row.seq}
							mark={String(row.seq)}
							title={
								row.due_date === null
									? tr.installment.noDueDate
									: formatDateTR(row.due_date, "dayMonth")
							}
							subtitle={subtitle}
							amount={row.amount_minor}
							tone={tone}
							badge={
								planned ? (
									<Badge label={tr.agreement.planned} tone="neutral" />
								) : (
									<InstallmentStatusBadge
										status={row.state.status}
										partial={row.state.partial}
									/>
								)
							}
							testID={`agreement.installment.${String(row.seq)}.row`}
						/>
					);
				})}
			</Rows>
		</Section>
	);
}

function PaymentRow({ payment }: { payment: PaymentView }) {
	const { colors, fonts, spacing } = useAppTheme();
	const online = useIsOnline();
	const withdraw = useWithdrawPayment();
	return (
		<View style={{ gap: spacing.xs }}>
			<View testID={`agreement.payment.${payment.id}`} style={styles.ins}>
				<View style={styles.grow}>
					<Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text }}>
						{`${formatDateTR(payment.paid_on, "short")} · ${tr.payment.kinds[payment.kind]}`}
					</Text>
					<Text
						numberOfLines={1}
						style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted }}
					>
						{[tr.payment.methods[payment.method], payment.note]
							.filter((part) => part !== null)
							.join(" · ")}
					</Text>
				</View>
				<View style={styles.endColumn}>
					<AmountText
						minor={payment.amount_minor}
						style={{ fontFamily: fonts.extrabold, fontSize: 15, marginBottom: 3 }}
					/>
					<Badge
						label={tr.payment.statuses[payment.status]}
						tone={payment.status === "confirmed" ? "success" : "pending"}
					/>
				</View>
			</View>
			{/* spec 5.5: the reporter can take a reported payment back. */}
			{payment.status === "reported" && payment.by_me ? (
				<Button
					label={tr.payment.withdraw}
					variant="ghost"
					disabled={!online}
					loading={withdraw.isPending}
					onPress={() => {
						withdraw.mutate(payment.id);
					}}
					testID={`agreement.payment.${payment.id}.withdraw`}
				/>
			) : null}
			{withdraw.isError ? (
				<Text
					style={{
						fontFamily: fonts.medium,
						fontSize: 14,
						color: colors.overdue,
						paddingHorizontal: 16,
					}}
				>
					{messageForError(withdraw.error)}
				</Text>
			) : null}
		</View>
	);
}

function recordLabel(agreement: AgreementDetail): string {
	if (agreement.status === "personal") {
		return tr.agreement.recordPersonal;
	}
	return agreement.status === "pending" || agreement.status === "countered"
		? tr.agreement.recordPending
		: tr.agreement.recordShared;
}

function AgreementInfo({ agreement }: { agreement: AgreementDetail }) {
	const installments = agreement.kind === "installment_purchase";
	const last = lastDue(agreement);
	const shared = recordLabel(agreement) === tr.agreement.recordShared;
	return (
		<Section title={installments ? tr.agreement.infoSection : tr.agreement.sectionAgreement}>
			<Rows>
				{installments ? (
					<KeyValue
						label={tr.agreement.totalPrice}
						value={formatTRY(agreement.principal_minor)}
					/>
				) : (
					<KeyValue
						label={tr.agreement.kindLabel}
						value={`${tr.agreement.kinds[agreement.kind]} · ${
							agreement.installment_count === 1
								? tr.agreement.planSingle
								: fill(tr.agreement.planInstallments, {
										count: String(agreement.installment_count),
									})
						}`}
					/>
				)}
				{agreement.started_on === null ? null : (
					<KeyValue
						label={
							installments
								? tr.agreement.purchaseDate
								: agreement.my_role === "creditor"
									? tr.new.startedOnLent
									: tr.new.startedOnBorrowed
						}
						value={formatDateTR(agreement.started_on, "long")}
						testID="agreement.startedOn.text"
					/>
				)}
				{installments || last === null ? null : (
					<KeyValue
						label={tr.agreement.repaymentDate}
						value={formatDateTR(last, "long")}
					/>
				)}
				{agreement.notes === null ? null : (
					<KeyValue label={tr.agreement.notesLabel} value={agreement.notes} />
				)}
				<KeyValue
					label={tr.agreement.recordLabel}
					value={recordLabel(agreement)}
					icon={
						shared ? (
							<Icon name="shieldCheck" size={14} tone="success" strokeWidth={2.2} />
						) : null
					}
				/>
			</Rows>
		</Section>
	);
}

const EVENT_STYLE: Partial<
	Record<EventView["type"], { icon: IconName; fg: ColorToken; bg: ColorToken }>
> = {
	created: { icon: "arrowUp", fg: "pending", bg: "pendingSoft" },
	shared: { icon: "arrowUp", fg: "pending", bg: "pendingSoft" },
	payment_reported: { icon: "clock", fg: "warning", bg: "warningSoft" },
	amendment_proposed: { icon: "clock", fg: "warning", bg: "warningSoft" },
	cancel_requested: { icon: "clock", fg: "warning", bg: "warningSoft" },
	dispute_opened: { icon: "exclamation", fg: "overdue", bg: "overdueSoft" },
	payment_rejected: { icon: "exclamation", fg: "overdue", bg: "overdueSoft" },
	rejected: { icon: "exclamation", fg: "overdue", bg: "overdueSoft" },
};
const DEFAULT_EVENT = { icon: "check", fg: "success", bg: "successSoft" } as const;

// Design ".st": the event's text without the amount, which sits on the right.
function eventTitle(event: EventView): string {
	const text = describeEvent(event);
	const suffix = event.amount_minor == null ? "" : `: ${formatTRY(event.amount_minor)}`;
	return suffix !== "" && text.endsWith(suffix) ? text.slice(0, -suffix.length) : text;
}

function Step({
	icon,
	fg,
	bg,
	title,
	subtitle,
	amount,
	dashed = false,
	last,
}: {
	icon: IconName | null;
	fg: ColorToken;
	bg: ColorToken;
	title: string;
	subtitle: string;
	amount?: number | null;
	dashed?: boolean;
	last: boolean;
}) {
	const { colors, fonts } = useAppTheme();
	return (
		<View style={styles.step}>
			{last ? null : <View style={[styles.line, { backgroundColor: colors.border }]} />}
			<View
				style={[
					styles.dot,
					dashed
						? {
								backgroundColor: colors.surface,
								borderWidth: 2,
								borderStyle: "dashed",
								borderColor: colors.textMuted,
							}
						: { backgroundColor: colors[bg] },
				]}
			>
				{icon === null ? null : <Icon name={icon} size={12} tone={fg} strokeWidth={3} />}
			</View>
			<View style={styles.grow}>
				<Text
					style={{
						fontFamily: fonts.bold,
						fontSize: 14,
						color: dashed ? colors.neutral : colors.text,
					}}
				>
					{title}
				</Text>
				<Text
					style={{
						fontFamily: fonts.medium,
						fontSize: 12,
						marginTop: 2,
						color: colors.textMuted,
					}}
				>
					{subtitle}
				</Text>
			</View>
			{amount == null ? null : (
				<AmountText minor={amount} style={{ fontFamily: fonts.extrabold, fontSize: 14 }} />
			)}
		</View>
	);
}

function Timeline({ agreement }: { agreement: AgreementDetail }) {
	const latest = agreement.events.slice(-4);
	const due = lastDue(agreement);
	const showDue = due !== null && agreement.outstanding_minor > 0;
	return (
		<Section title={tr.agreement.sectionTimeline}>
			<Card style={styles.timeline}>
				{latest.map((event, index) => {
					const look = EVENT_STYLE[event.type] ?? DEFAULT_EVENT;
					return (
						<Step
							key={event.id}
							icon={look.icon}
							fg={look.fg}
							bg={look.bg}
							title={eventTitle(event)}
							subtitle={`${formatDateTimeTR(event.at)} · ${tr.history.actors[event.actor]}`}
							amount={event.amount_minor}
							last={!showDue && index === latest.length - 1}
						/>
					);
				})}
				{showDue ? (
					<Step
						icon={null}
						fg="neutral"
						bg="surface"
						dashed
						title={tr.agreement.timelineDue}
						subtitle={fill(tr.agreement.timelineDueBody, {
							date: formatDateTR(due, "long"),
							amount: formatTRY(agreement.outstanding_minor),
						})}
						last
					/>
				) : null}
			</Card>
			<Button
				label={tr.agreement.history}
				variant="ghost"
				onPress={() => {
					router.push({
						pathname: "/agreement/[id]/history",
						params: { id: agreement.id },
					});
				}}
				testID="agreement.history.button"
			/>
		</Section>
	);
}

function openMenu(agreement: AgreementDetail) {
	const options: { label: string; run: () => void }[] = [
		{
			label: tr.agreement.history,
			run: () => {
				router.push({ pathname: "/agreement/[id]/history", params: { id: agreement.id } });
			},
		},
		...(agreement.status === "personal"
			? [
					{
						label: tr.share.action,
						run: () => {
							router.push({
								pathname: "/agreement/[id]/share",
								params: { id: agreement.id },
							});
						},
					},
				]
			: []),
	];
	if (Platform.OS === "ios") {
		ActionSheetIOS.showActionSheetWithOptions(
			{
				options: [...options.map((o) => o.label), tr.common.cancel],
				cancelButtonIndex: options.length,
			},
			(index) => {
				options[index]?.run();
			},
		);
		return;
	}
	Alert.alert(screenTitle(agreement), undefined, [
		...options.map((o) => ({ text: o.label, onPress: o.run })),
		{ text: tr.common.cancel, style: "cancel" as const },
	]);
}

function Detail({ agreement }: { agreement: AgreementDetail }) {
	const { colors, typography } = useAppTheme();
	const reportedToMe =
		agreement.my_role === "creditor"
			? agreement.payments.filter((p) => p.status === "reported" && !p.by_me)
			: [];
	const installments = agreement.kind === "installment_purchase";

	return (
		<>
			<Stack.Screen
				options={{
					title: screenTitle(agreement),
					headerRight: () => (
						<IconButton
							icon="more"
							label={tr.agreement.more}
							onPress={() => {
								openMenu(agreement);
							}}
							testID="agreement.more.button"
						/>
					),
				}}
			/>
			{reportedToMe.map((payment) => (
				<ReportedBanner key={payment.id} agreement={agreement} payment={payment} />
			))}

			{installments ? (
				<>
					<InstallmentSummary agreement={agreement} />
					<NextInstallmentCard agreement={agreement} />
				</>
			) : (
				<LoanSummary agreement={agreement} />
			)}

			{agreement.status === "settled" ? (
				<Card
					testID="agreement.settled"
					style={{ backgroundColor: colors.successSoft, borderColor: colors.successSoft }}
				>
					<Text style={[typography.headline, { color: colors.success }]}>
						{tr.settled.title}
					</Text>
				</Card>
			) : null}

			<SharedStateActions agreement={agreement} />

			{installments ? (
				<>
					<Plan agreement={agreement} />
					<AgreementInfo agreement={agreement} />
				</>
			) : (
				<>
					<AgreementInfo agreement={agreement} />
					{agreement.installment_count > 1 ? <Plan agreement={agreement} /> : null}
				</>
			)}

			{agreement.payments.length === 0 ? null : (
				<Section title={tr.agreement.payments}>
					<Rows>
						{agreement.payments.map((payment) => (
							<PaymentRow key={payment.id} payment={payment} />
						))}
					</Rows>
				</Section>
			)}

			<Timeline agreement={agreement} />
			<DisputeCancelActions agreement={agreement} />
		</>
	);
}

// S11 · design 13 (borç), 15 (alacak), 25 (elden taksit)
export function AgreementScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const agreement = useAgreement(id);

	return (
		<View style={styles.fill}>
			<Screen
				testID="agreement.screen"
				edges={[]}
				gap={20}
				refreshControl={
					<RefreshControl
						refreshing={agreement.isRefetching}
						onRefresh={() => {
							void agreement.refetch();
						}}
					/>
				}
			>
				{agreement.isPending ? (
					<LoadingState testID="agreement.loading" />
				) : agreement.isError ? (
					<ErrorState
						message={messageForError(agreement.error)}
						onRetry={() => {
							void agreement.refetch();
						}}
						testID="agreement.error"
					/>
				) : (
					<Detail agreement={agreement.data} />
				)}
			</Screen>
			<DetailTabBar active="debts" />
		</View>
	);
}

const styles = StyleSheet.create({
	fill: { flex: 1 },
	head: { flexDirection: "row", alignItems: "center", gap: 12 },
	between: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 8,
	},
	baseline: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 8 },
	pair: { flexDirection: "row" },
	grow: { flex: 1, minWidth: 0 },
	end: { flexShrink: 1, textAlign: "right" },
	endColumn: { alignItems: "flex-end" },
	summary: { paddingVertical: 18, gap: 0 },
	big: { fontSize: 34, lineHeight: 40, letterSpacing: -0.85 },
	h2: { marginHorizontal: 4, marginBottom: 10 },
	flush: { padding: 0, gap: 0 },
	kv: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
		minHeight: 48,
		paddingVertical: 12,
		paddingHorizontal: 16,
	},
	kvValue: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
	banner: { borderRadius: 20, borderWidth: 1, padding: 16 },
	bannerHead: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14 },
	segments: { flexDirection: "row", gap: 4, marginTop: 12 },
	segment: { flex: 1, height: 8, borderRadius: 4 },
	ins: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingVertical: 10,
		paddingHorizontal: 16,
		minHeight: 60,
	},
	no: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
	timeline: { paddingVertical: 6, gap: 0 },
	step: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 10 },
	line: { position: "absolute", left: 11, top: 34, bottom: -10, width: 2 },
	dot: {
		width: 24,
		height: 24,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 1,
	},
});
