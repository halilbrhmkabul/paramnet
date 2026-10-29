import { Ionicons } from "@expo/vector-icons";
import {
	addDays,
	formatSignedTRY,
	formatTRY,
	monthOf,
	shiftMonth,
	type PartyRole,
} from "@paramnet/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import {
	useAccounts,
	useAgreements,
	useCards,
	useCashSummary,
	useDashboard,
	useMyProfile,
	useRequests,
	useTransactionMonths,
	useUnreadCount,
} from "@/api/hooks";
import type { Card as CardItem, Dashboard } from "@/api/types";
import { Avatar } from "@/components/Avatar";
import { Brand } from "@/components/Brand";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { Badge } from "@/components/StatusBadge";
import { IconButton } from "@/components/TopBar";
import { useSession } from "@/features/auth/sessionStore";
import { useMyAvatar } from "@/features/me/useMyAvatar";
import { untilLabel } from "@/features/calendar/financeModel";
import { useFinanceEvents } from "@/features/calendar/useFinanceEvents";
import { CardFace } from "@/features/cards/cardParts";
import { cutLabel } from "@/features/cards/cardModel";
import { monthTitle, sourceName } from "@/features/cash/cashModel";
import { TransactionRow } from "@/features/cash/parts";
import { useNewDraft } from "@/features/new/draftStore";
import {
	REQUEST_ACTION,
	requestHref,
	requestKey,
	requestLine,
} from "@/features/requests/requestModel";
import { fill, tr } from "@/i18n/tr";
import { clock, useToday } from "@/lib/clock";
import type { ColorToken } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

import {
	dateTile,
	greetingFor,
	recentTransactions,
	shortDay,
	updatedLine,
	upcomingPayments,
} from "./homeModel";

type IconName = keyof typeof Ionicons.glyphMap;

const UPCOMING_DAYS = 30;

// Design 03: the bell carries the unread notices and opens Bildirimler (06).
function NotificationsButton() {
	const count = useUnreadCount();
	const { colors, fonts, sizes } = useAppTheme();
	return (
		<Pressable
			testID="home.notifications.button"
			accessibilityRole="button"
			accessibilityLabel={
				count > 0 ? fill(tr.inbox.bell, { count: String(count) }) : tr.inbox.bellNone
			}
			onPress={() => {
				router.push("/inbox");
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
			<Ionicons name="notifications-outline" size={21} color={colors.text} />
			{count > 0 ? (
				<View
					testID="home.notifications.badge"
					style={[
						styles.dot,
						{ backgroundColor: colors.overdue, borderColor: colors.surface },
					]}
				>
					<Text
						style={{
							fontFamily: fonts.extrabold,
							fontSize: 11,
							color: colors.onPrimary,
						}}
					>
						{count > 9 ? "9+" : String(count)}
					</Text>
				</View>
			) : null}
		</Pressable>
	);
}

// Spec 6.1: profile and settings open from the greeting; the ParamNet ID sits under the name.
function Greeting() {
	const { colors, typography, fonts, spacing } = useAppTheme();
	const name = useSession((state) => state.user?.display_name ?? null);
	const profile = useMyProfile();
	const avatar = useMyAvatar(profile.data);
	const id = profile.data?.paramnet_id ?? null;
	return (
		<Pressable
			testID="home.profile.button"
			accessibilityRole="button"
			accessibilityLabel={tr.me.open}
			onPress={() => {
				router.push("/me");
			}}
			style={[styles.greeting, { gap: spacing.md }]}
		>
			<Avatar name={name ?? "?"} size={52} uri={avatar} />
			<View style={styles.grow}>
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{greetingFor(clock.now())}
				</Text>
				<Text
					style={{ fontFamily: fonts.extrabold, fontSize: 18, color: colors.text }}
					numberOfLines={1}
				>
					{name ?? tr.tabs.home}
				</Text>
				{id === null ? null : (
					<Text
						testID="home.paramnetId"
						style={[typography.mono, { color: colors.accent, marginTop: 2 }]}
					>
						{id}
					</Text>
				)}
			</View>
			<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
		</Pressable>
	);
}

// Design 03 "Toplam Nakit" (ADR-053): manual balances, the month's income and expense, a way to the accounts.
function CashCard() {
	const { colors, typography, fonts, spacing, radius } = useAppTheme();
	const today = useToday();
	const month = monthOf(today);
	const accounts = useAccounts();
	const summary = useCashSummary(month);
	const [hidden, setHidden] = useState(false);
	if (accounts.data === undefined || summary.data === undefined) {
		// The debt figures below stay the screen's main content; the card simply waits.
		return null;
	}
	if (accounts.data.accounts.length === 0) {
		return (
			<Pressable
				testID="home.cash.empty"
				accessibilityRole="button"
				accessibilityLabel={`${tr.accounts.homeEmpty}. ${tr.accounts.homeEmptyBody}`}
				onPress={() => {
					router.push("/accounts/new");
				}}
				style={[
					styles.cashEmpty,
					{
						backgroundColor: colors.surface,
						borderColor: colors.border,
						borderRadius: radius.lg,
						gap: spacing.md,
					},
				]}
			>
				<View style={[styles.cashIcon, { backgroundColor: colors.primarySoft }]}>
					<Ionicons name="wallet-outline" size={20} color={colors.primary} />
				</View>
				<View style={styles.grow}>
					<Text style={[typography.rowTitle, { color: colors.text }]}>
						{tr.accounts.homeEmpty}
					</Text>
					<Text style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}>
						{tr.accounts.homeEmptyBody}
					</Text>
				</View>
				<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
			</Pressable>
		);
	}
	const { total_cash_minor, account_count, income_minor, expense_minor, updated_at } =
		summary.data;
	const name = monthTitle(month);
	const amount = (minor: number) => (hidden ? tr.accounts.hidden : formatTRY(minor));
	const meta = [
		fill(tr.accounts.count, { count: String(account_count) }),
		tr.accounts.noBank,
		...(updated_at === null ? [] : [updatedLine(updated_at, today)]),
	].join(" · ");
	return (
		<View
			testID="home.cash.card"
			style={{
				backgroundColor: colors.surface,
				borderColor: colors.border,
				borderWidth: 1,
				borderRadius: radius.xl,
				paddingHorizontal: 18,
				paddingTop: 18,
				paddingBottom: 6,
			}}
		>
			<View style={[styles.line, { gap: spacing.sm }]}>
				<Text style={[typography.label, { color: colors.textMuted }]}>
					{tr.accounts.totalCash}
				</Text>
				<View
					style={[
						styles.cashBadge,
						{ backgroundColor: colors.neutralSoft, borderRadius: radius.pill },
					]}
				>
					<Text style={[typography.badge, { fontSize: 11, color: colors.neutral }]}>
						{tr.accounts.manual}
					</Text>
				</View>
				<View style={styles.grow} />
				<Pressable
					testID="home.cash.toggle"
					accessibilityRole="button"
					accessibilityLabel={hidden ? tr.accounts.show : tr.accounts.hide}
					onPress={() => {
						setHidden((value) => !value);
					}}
					style={styles.eye}
				>
					<Ionicons
						name={hidden ? "eye-off-outline" : "eye-outline"}
						size={20}
						color={colors.textMuted}
					/>
				</Pressable>
			</View>
			<Text
				testID="home.cash.amount"
				style={[
					typography.amountXL,
					{ fontSize: 36, color: colors.primary, fontVariant: ["tabular-nums"] },
				]}
			>
				{amount(total_cash_minor)}
			</Text>
			<Text style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}>
				{meta}
			</Text>
			<View style={[styles.row, { gap: 10, marginTop: spacing.lg }]}>
				<View style={[styles.cashCell, { backgroundColor: colors.successSoft }]}>
					<Text style={[typography.caption, { fontSize: 12, color: colors.success }]}>
						{fill(tr.accounts.monthIncome, { month: name })}
					</Text>
					<Text
						testID="home.cash.income"
						style={{ fontFamily: fonts.extrabold, fontSize: 16, color: colors.text }}
					>
						{hidden ? tr.accounts.hidden : formatSignedTRY(income_minor, "plus")}
					</Text>
				</View>
				<View style={[styles.cashCell, { backgroundColor: colors.surfaceSunken }]}>
					<Text style={[typography.caption, { fontSize: 12, color: colors.overdue }]}>
						{fill(tr.accounts.monthExpense, { month: name })}
					</Text>
					<Text
						testID="home.cash.expense"
						style={{ fontFamily: fonts.extrabold, fontSize: 16, color: colors.text }}
					>
						{hidden ? tr.accounts.hidden : formatSignedTRY(expense_minor, "minus")}
					</Text>
				</View>
			</View>
			<Pressable
				testID="home.cash.link"
				accessibilityRole="link"
				onPress={() => {
					router.push("/accounts");
				}}
				style={[styles.cashLink, { borderTopColor: colors.divider, gap: 10 }]}
			>
				<View style={styles.row}>
					<View
						style={[
							styles.stackIcon,
							{ backgroundColor: colors.pendingSoft, borderColor: colors.surface },
						]}
					>
						<Ionicons name="business-outline" size={13} color={colors.pending} />
					</View>
					<View
						style={[
							styles.stackIcon,
							{
								backgroundColor: colors.successSoft,
								borderColor: colors.surface,
								marginLeft: -6,
							},
						]}
					>
						<Ionicons name="wallet-outline" size={13} color={colors.success} />
					</View>
				</View>
				<Text
					style={[typography.rowTitle, styles.grow, { fontSize: 14, color: colors.text }]}
				>
					{tr.accounts.homeLink}
				</Text>
				<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
			</Pressable>
		</View>
	);
}

// Design 03: Borçlarım and Alacaklarım side by side, each with its open record count.
function DebtTotals({ data }: { data: Dashboard }) {
	const { colors, typography, fonts, spacing } = useAppTheme();
	const agreements = useAgreements();
	const count = (role: PartyRole) =>
		(agreements.data ?? []).filter((a) => a.my_role === role && a.outstanding_minor > 0).length;
	const tiles = [
		{
			role: "debtor" as const,
			title: tr.home.payable,
			minor: data.payable_minor,
			hint: tr.home.payableHint,
			tone: "payable" as ColorToken,
			id: "payable",
		},
		{
			role: "creditor" as const,
			title: tr.home.receivable,
			minor: data.receivable_minor,
			hint: tr.home.receivableHint,
			tone: "receivable" as ColorToken,
			id: "receivable",
		},
	];
	return (
		<View style={[styles.row, { gap: 10 }]}>
			{tiles.map((tile) => {
				const records = fill(tr.home.records, { count: String(count(tile.role)) });
				return (
					<Pressable
						key={tile.id}
						testID={`home.${tile.id}.card`}
						accessibilityRole="button"
						accessibilityLabel={fill(tr.home.totalLabel, {
							title: tile.title,
							amount: formatTRY(tile.minor),
							count: records,
						})}
						onPress={() => {
							router.push("/debts");
						}}
						style={({ pressed }) => [
							styles.tile,
							styles.grow,
							{
								gap: spacing.xs,
								backgroundColor: colors.surface,
								borderColor: colors.border,
								opacity: pressed ? 0.8 : 1,
							},
						]}
					>
						<View style={[styles.line, styles.between]}>
							<Text style={[typography.caption, { color: colors.textMuted }]}>
								{tile.title}
							</Text>
							<Badge
								label={records}
								tone="neutral"
								testID={`home.${tile.id}.count`}
							/>
						</View>
						<Text
							testID={`home.${tile.id}.amount`}
							numberOfLines={1}
							adjustsFontSizeToFit
							style={{
								fontFamily: fonts.extrabold,
								fontSize: 18,
								color: colors[tile.tone],
								fontVariant: ["tabular-nums"],
							}}
						>
							{formatTRY(tile.minor)}
						</Text>
						<Text
							style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}
						>
							{tile.hint}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

function QuickActions() {
	const { colors, typography, spacing, radius } = useAppTheme();
	const start = useNewDraft((state) => state.start);
	const cards = useCards();
	const open = (cards.data?.cards ?? []).filter((c) => c.archived_at === null);
	const actions: {
		id: string;
		label: string;
		icon: IconName;
		tone: [ColorToken, ColorToken];
		onPress: () => void;
	}[] = [
		{
			id: "expense",
			label: tr.home.quick.expense,
			icon: "remove-circle-outline",
			tone: ["overdue", "overdueSoft"],
			onPress: () => {
				router.push({ pathname: "/transaction/new", params: { kind: "expense" } });
			},
		},
		{
			id: "payment",
			label: tr.home.quick.payment,
			icon: "checkmark-circle-outline",
			tone: ["success", "successSoft"],
			onPress: () => {
				// Design 09 is a card's payment; with several cards the user picks one first.
				const [only] = open;
				if (open.length === 1 && only !== undefined) {
					router.push({ pathname: "/cards/[id]/pay", params: { id: only.id } });
				} else {
					router.push("/cards");
				}
			},
		},
		{
			id: "request",
			label: tr.home.quick.request,
			icon: "download-outline",
			tone: ["pending", "pendingSoft"],
			onPress: () => {
				router.push("/request");
			},
		},
		{
			id: "lend",
			label: tr.home.quick.lend,
			icon: "arrow-up-outline",
			tone: ["calLoan", "calLoanSoft"],
			onPress: () => {
				start("lent");
				router.push("/new/form");
			},
		},
	];
	return (
		<View style={[styles.row, { gap: spacing.sm }]}>
			{actions.map(({ id, label, icon, tone: [fg, bg], onPress }) => (
				<Pressable
					key={id}
					testID={`home.quick.${id}`}
					accessibilityRole="button"
					accessibilityLabel={label}
					onPress={onPress}
					style={({ pressed }) => [
						styles.quick,
						{
							gap: spacing.sm,
							borderRadius: 18,
							backgroundColor: colors.surface,
							borderColor: colors.border,
							opacity: pressed ? 0.8 : 1,
						},
					]}
				>
					<View
						style={[
							styles.quickIcon,
							{ backgroundColor: colors[bg], borderRadius: radius.sm },
						]}
					>
						<Ionicons name={icon} size={20} color={colors[fg]} />
					</View>
					<Text style={[typography.label, styles.center, { color: colors.text }]}>
						{label}
					</Text>
				</Pressable>
			))}
		</View>
	);
}

// Design 03 amber card: what waits for my answer, up to three rows; the rest in Talepler.
function PendingCard() {
	const { colors, typography, fonts, spacing } = useAppTheme();
	const requests = useRequests();
	const items = requests.data ?? [];
	if (items.length === 0) {
		return null;
	}
	return (
		<View
			testID="home.pending.card"
			style={[
				styles.pending,
				{ backgroundColor: colors.surface, borderColor: colors.warningBorder },
			]}
		>
			<Pressable
				accessibilityRole="link"
				onPress={() => {
					router.push("/requests");
				}}
				style={[styles.pendingHead, { gap: 10, backgroundColor: colors.warningTint }]}
			>
				<Ionicons name="time-outline" size={20} color={colors.warning} />
				<Text
					style={[
						styles.grow,
						{ fontFamily: fonts.extrabold, fontSize: 15, color: colors.warning },
					]}
				>
					{fill(tr.home.pendingTitle, { count: String(items.length) })}
				</Text>
				<Ionicons name="chevron-forward" size={18} color={colors.warning} />
			</Pressable>
			{items.slice(0, 3).map((item) => {
				const name = item.from_name ?? item.title;
				const line = requestLine(item);
				const action = REQUEST_ACTION[item.kind];
				return (
					<Pressable
						key={requestKey(item)}
						testID={`home.pending.item.${requestKey(item)}`}
						accessibilityRole="button"
						accessibilityLabel={`${item.title}, ${line}, ${action.label}`}
						onPress={() => {
							router.push(requestHref(item));
						}}
						style={[
							styles.listRow,
							{
								gap: spacing.md,
								borderTopWidth: 1,
								borderTopColor: colors.divider,
							},
						]}
					>
						<Avatar name={name} size={40} />
						<View style={styles.grow}>
							<Text
								numberOfLines={1}
								style={[typography.rowTitle, { color: colors.text }]}
							>
								{item.title}
							</Text>
							<Text
								numberOfLines={1}
								style={[typography.caption, { color: colors.textMuted }]}
							>
								{line}
							</Text>
						</View>
						<Badge label={action.label} tone={action.tone} />
					</Pressable>
				);
			})}
		</View>
	);
}

function SectionHead({
	title,
	link,
	onLink,
	testID,
}: {
	title: string;
	link: string;
	onLink: () => void;
	testID: string;
}) {
	const { colors, typography } = useAppTheme();
	return (
		<View style={[styles.line, styles.between, { paddingHorizontal: 4 }]}>
			<Text accessibilityRole="header" style={[typography.headline, { color: colors.text }]}>
				{title}
			</Text>
			<Pressable
				testID={testID}
				accessibilityRole="link"
				accessibilityLabel={`${title}: ${link}`}
				onPress={onLink}
				style={[styles.line, styles.link]}
			>
				<Text style={[typography.rowTitle, { fontSize: 14, color: colors.accent }]}>
					{link}
				</Text>
				<Ionicons name="chevron-forward" size={16} color={colors.accent} />
			</Pressable>
		</View>
	);
}

function CardStat({ label, value, tone }: { label: string; value: string; tone: ColorToken }) {
	const { colors, typography, fonts } = useAppTheme();
	return (
		<View style={[styles.grow, styles.stat]}>
			<Text style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}>
				{label}
			</Text>
			<Text
				numberOfLines={1}
				adjustsFontSizeToFit
				style={{
					fontFamily: fonts.extrabold,
					fontSize: 14,
					color: colors[tone],
					marginTop: 3,
				}}
			>
				{value}
			</Text>
		</View>
	);
}

// Design 03 "Kartlarım": the card faces side by side with this statement's figures.
function CardsCarousel() {
	const { colors, spacing } = useAppTheme();
	const today = useToday();
	const cards = useCards();
	const open = (cards.data?.cards ?? []).filter((c) => c.archived_at === null);
	if (open.length === 0) {
		return null;
	}
	const dueTone = (card: CardItem): ColorToken => {
		const tone = untilLabel(card.state.due_date, today).tone;
		return card.state.statement_remaining_minor > 0 && tone !== "neutral" ? tone : "text";
	};
	return (
		<View testID="home.cards" style={{ gap: 10 }}>
			<SectionHead
				title={tr.home.cards}
				link={tr.home.all}
				onLink={() => {
					router.push("/cards");
				}}
				testID="home.cards.all"
			/>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				snapToInterval={312}
				decelerationRate="fast"
				contentContainerStyle={{ gap: spacing.md }}
			>
				{open.map((card) => (
					<Pressable
						key={card.id}
						testID={`home.card.${card.id}`}
						accessibilityRole="button"
						accessibilityLabel={fill(tr.home.cardLabel, {
							card: card.label,
							statement: formatTRY(card.state.statement_minor),
							minimum: formatTRY(card.state.minimum_minor),
							date: shortDay(card.state.due_date),
						})}
						onPress={() => {
							router.push({ pathname: "/cards/[id]", params: { id: card.id } });
						}}
						style={styles.cardSlot}
					>
						<CardFace
							bank={card.bank_name}
							name={card.card_name}
							last4={card.last4}
							color={card.color}
							footer={cutLabel(card)}
						/>
						<View
							style={[
								styles.row,
								styles.mini,
								{ backgroundColor: colors.surface, borderColor: colors.border },
							]}
						>
							<CardStat
								label={tr.home.statement}
								value={formatTRY(card.state.statement_minor)}
								tone="text"
							/>
							<View style={[styles.miniRule, { backgroundColor: colors.divider }]} />
							<CardStat
								label={tr.home.minimum}
								value={formatTRY(card.state.minimum_minor)}
								tone="text"
							/>
							<View style={[styles.miniRule, { backgroundColor: colors.divider }]} />
							<CardStat
								label={tr.home.dueDate}
								value={shortDay(card.state.due_date)}
								tone={dueTone(card)}
							/>
						</View>
					</Pressable>
				))}
			</ScrollView>
		</View>
	);
}

// Design 03 "Yaklaşan Ödemeler": cards, loans, repeating expenses and my installments together.
function UpcomingPayments() {
	const { colors, typography, fonts, spacing, radius } = useAppTheme();
	const today = useToday();
	const data = useFinanceEvents(today, addDays(today, UPCOMING_DAYS));
	const items = upcomingPayments(data.events, data.overdue, 3);
	return (
		<View testID="home.upcoming.list" style={{ gap: 10 }}>
			<SectionHead
				title={tr.home.upcoming}
				link={tr.home.seeCalendar}
				onLink={() => {
					router.push("/calendar");
				}}
				testID="home.upcoming.calendar"
			/>
			{data.isPending ? (
				<LoadingState rows={3} testID="home.upcoming.loading" />
			) : items.length === 0 ? (
				<Text style={[typography.body, { color: colors.textMuted, paddingHorizontal: 4 }]}>
					{tr.home.upcomingEmpty}
				</Text>
			) : (
				<View
					style={[
						styles.list,
						{
							backgroundColor: colors.surface,
							borderColor: colors.border,
							borderRadius: radius.lg,
						},
					]}
				>
					{items.map((event, index) => {
						const tile = dateTile(event.date);
						// A repeating record past its day waits for "Onayla"; it is not late.
						const until =
							event.status === "waiting"
								? { label: tr.calendar.status.waiting, tone: "warning" as const }
								: untilLabel(event.date, today);
						const amount = formatTRY(event.amount_minor ?? 0);
						return (
							<Pressable
								key={event.key}
								testID={`home.upcoming.item.${event.key}`}
								accessibilityRole="button"
								accessibilityLabel={fill(tr.home.upcomingLabel, {
									title: event.title,
									date: shortDay(event.date),
									amount,
									status: until.label,
								})}
								onPress={() => {
									router.push(event.href);
								}}
								style={[
									styles.listRow,
									{ gap: spacing.md },
									index === 0
										? null
										: { borderTopWidth: 1, borderTopColor: colors.divider },
								]}
							>
								<View
									style={[
										styles.dateTile,
										{ backgroundColor: colors.surfaceSunken },
									]}
								>
									<Text
										style={{
											fontFamily: fonts.extrabold,
											fontSize: 17,
											color: colors.text,
										}}
									>
										{tile.day}
									</Text>
									<Text
										style={{
											fontFamily: fonts.bold,
											fontSize: 10,
											letterSpacing: 0.4,
											color: colors.textMuted,
											marginTop: 3,
										}}
									>
										{tile.month}
									</Text>
								</View>
								<View style={[styles.grow, { gap: 4 }]}>
									<Text
										numberOfLines={1}
										style={[typography.rowTitle, { color: colors.text }]}
									>
										{event.title}
									</Text>
									<View style={styles.line}>
										<Badge label={until.label} tone={until.tone} />
									</View>
								</View>
								<Text
									style={{
										fontFamily: fonts.extrabold,
										fontSize: 15,
										color: colors.text,
										fontVariant: ["tabular-nums"],
									}}
								>
									{amount}
								</Text>
							</Pressable>
						);
					})}
				</View>
			)}
		</View>
	);
}

// Design 03 "Son İşlemler": this and last month's latest cash records.
function RecentTransactions() {
	const { colors, typography, radius } = useAppTheme();
	const month = monthOf(useToday());
	const months = useTransactionMonths([shiftMonth(month, -1), month]);
	const items = recentTransactions(
		months.flatMap((q) => q.data?.items ?? []),
		5,
	);
	return (
		<View style={{ gap: 10 }}>
			<SectionHead
				title={tr.home.recent}
				link={tr.home.all}
				onLink={() => {
					router.push("/transactions");
				}}
				testID="home.recent.all"
			/>
			{months.some((q) => q.isPending) ? null : items.length === 0 ? (
				<Text style={[typography.body, { color: colors.textMuted, paddingHorizontal: 4 }]}>
					{tr.home.recentEmpty}
				</Text>
			) : (
				<View
					testID="home.recent.list"
					style={[
						styles.list,
						{
							backgroundColor: colors.surface,
							borderColor: colors.border,
							borderRadius: radius.lg,
						},
					]}
				>
					{items.map((tx, index) => (
						<View
							key={tx.id}
							style={
								index === 0
									? undefined
									: { borderTopWidth: 1, borderTopColor: colors.divider }
							}
						>
							<TransactionRow
								tx={tx}
								sub={fill(tr.home.recentSub, {
									source:
										tx.kind === "transfer"
											? tr.txHistory.transferSub
											: sourceName(tx),
									date: shortDay(tx.occurred_on),
								})}
								onPress={() => {
									router.push({
										pathname: "/transaction/[id]",
										params: { id: tx.id },
									});
								}}
								testID={`home.recent.item.${tx.id}`}
							/>
						</View>
					))}
				</View>
			)}
		</View>
	);
}

// S05, design 03: every module's summary on one screen.
export function HomeScreen() {
	const dashboard = useDashboard();
	return (
		<Screen
			testID="home.screen"
			refreshControl={
				<RefreshControl
					refreshing={dashboard.isRefetching}
					onRefresh={() => {
						void dashboard.refetch();
					}}
				/>
			}
		>
			<View style={[styles.line, styles.between]}>
				<IconButton
					icon="menu-outline"
					label={tr.menu.open}
					onPress={() => {
						router.push("/menu");
					}}
					testID="home.menu.button"
				/>
				<Brand testID="home.brand" />
				<NotificationsButton />
			</View>
			<Greeting />
			<CashCard />
			{dashboard.isPending ? (
				<LoadingState rows={4} testID="home.loading" />
			) : dashboard.isError ? (
				<ErrorState
					message={messageForError(dashboard.error)}
					onRetry={() => {
						void dashboard.refetch();
					}}
					testID="home.error"
				/>
			) : (
				<>
					<DebtTotals data={dashboard.data} />
					<QuickActions />
					<PendingCard />
					<CardsCarousel />
					<UpcomingPayments />
					<RecentTransactions />
				</>
			)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row" },
	line: { flexDirection: "row", alignItems: "center" },
	between: { justifyContent: "space-between" },
	grow: { flex: 1, minWidth: 0 },
	center: { textAlign: "center" },
	iconButton: {
		alignItems: "center",
		justifyContent: "center",
		borderRadius: 14,
		borderWidth: 1,
	},
	dot: {
		position: "absolute",
		top: 4,
		right: 4,
		minWidth: 18,
		height: 18,
		paddingHorizontal: 3,
		borderRadius: 9,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
	},
	greeting: { flexDirection: "row", alignItems: "center", minHeight: 60 },
	tile: { borderWidth: 1, borderRadius: 18, padding: 14 },
	quick: {
		flex: 1,
		alignItems: "center",
		paddingTop: 14,
		paddingBottom: 12,
		paddingHorizontal: 4,
		borderWidth: 1,
		minHeight: 96,
	},
	quickIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
	pending: { borderWidth: 1, borderRadius: 22, overflow: "hidden" },
	pendingHead: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		minHeight: 52,
	},
	listRow: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		minHeight: 66,
	},
	list: { borderWidth: 1, overflow: "hidden" },
	link: { minHeight: 44, gap: 2 },
	cardSlot: { width: 300 },
	mini: { borderWidth: 1, borderRadius: 16, marginTop: 10 },
	miniRule: { width: 1 },
	stat: { paddingHorizontal: 12, paddingVertical: 10 },
	dateTile: {
		width: 44,
		height: 48,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
	},
	cashBadge: { paddingHorizontal: 7, height: 20, justifyContent: "center" },
	eye: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -8 },
	cashCell: { flex: 1, borderRadius: 14, padding: 12, gap: 4 },
	cashLink: {
		flexDirection: "row",
		alignItems: "center",
		minHeight: 52,
		marginTop: 8,
		borderTopWidth: 1,
	},
	stackIcon: {
		width: 26,
		height: 26,
		borderRadius: 8,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
	},
	cashEmpty: {
		flexDirection: "row",
		alignItems: "center",
		borderWidth: 1,
		padding: 16,
		minHeight: 72,
	},
	cashIcon: {
		width: 40,
		height: 40,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
	},
});
