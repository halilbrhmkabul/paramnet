import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { messageForError } from "@/api/errors";
import { useInbox, useMarkNotificationsRead, useMyProfile, useSetReminderPrefs } from "@/api/hooks";
import type { InboxItem, NotificationCategory, ReminderDay } from "@/api/types";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { IconButton, TopBar } from "@/components/TopBar";
import { notificationRoute } from "@/features/push/notificationRoute";
import { tr } from "@/i18n/tr";
import { clock } from "@/lib/clock";
import type { ColorToken } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

import { REMINDER_DAYS, groupOf, notificationText, timeLabel, type InboxGroup } from "./inboxModel";

type Filter = "all" | NotificationCategory;

const FILTERS: readonly Exclude<Filter, "info">[] = ["all", "approval", "reminder", "completed"];
const GROUPS: readonly InboxGroup[] = ["today", "week", "older"];
// The design's "Kontrol et": a reported payment is checked on the agreement, not decided on a plan.
const CHECK_TEMPLATES = new Set(["paymentReported", "paymentPending"]);

const ICONS: Record<
	Exclude<NotificationCategory, "approval">,
	{ icon: keyof typeof Ionicons.glyphMap; tone: readonly [ColorToken, ColorToken] }
> = {
	reminder: { icon: "calendar-outline", tone: ["warning", "warningSoft"] },
	completed: { icon: "checkmark-circle-outline", tone: ["success", "successSoft"] },
	info: { icon: "information-circle-outline", tone: ["neutral", "neutralSoft"] },
};

function Chip({
	label,
	count,
	selected,
	onPress,
	testID,
}: {
	label: string;
	count: number | null;
	selected: boolean;
	onPress: () => void;
	testID: string;
}) {
	const { colors, typography, fonts, radius } = useAppTheme();
	return (
		<Pressable
			testID={testID}
			accessibilityRole="tab"
			accessibilityLabel={count === null ? label : `${label}, ${String(count)}`}
			accessibilityState={{ selected }}
			onPress={onPress}
			style={[
				styles.chip,
				{
					borderRadius: radius.pill,
					backgroundColor: selected ? colors.primary : colors.surface,
					borderColor: selected ? colors.primary : colors.borderStrong,
				},
			]}
		>
			<Text
				style={[
					typography.label,
					{ fontSize: 14, color: selected ? colors.onPrimary : colors.textMuted },
				]}
			>
				{label}
			</Text>
			{count === null ? null : (
				<View style={[styles.chipCount, { backgroundColor: colors.primarySoft }]}>
					<Text
						style={{ fontFamily: fonts.extrabold, fontSize: 11, color: colors.primary }}
					>
						{String(count)}
					</Text>
				</View>
			)}
		</Pressable>
	);
}

function ItemIcon({ item }: { item: InboxItem }) {
	const { colors } = useAppTheme();
	if (item.category === "approval") {
		return <Avatar name={item.payload.name ?? "?"} size={40} />;
	}
	const { icon, tone } = ICONS[item.category];
	return (
		<View style={[styles.itemIcon, { backgroundColor: colors[tone[1]] }]}>
			<Ionicons name={icon} size={20} color={colors[tone[0]]} />
		</View>
	);
}

function ActionButton({
	label,
	primary,
	onPress,
	testID,
}: {
	label: string;
	primary: boolean;
	onPress: () => void;
	testID: string;
}) {
	const { colors, typography } = useAppTheme();
	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			style={({ pressed }) => [
				styles.action,
				primary
					? { backgroundColor: colors.primary }
					: { borderWidth: 1, borderColor: colors.borderStrong },
				{ opacity: pressed ? 0.7 : 1 },
			]}
		>
			<Text
				style={[
					typography.label,
					{ fontSize: 14, color: primary ? colors.onPrimary : colors.textMuted },
				]}
			>
				{label}
			</Text>
		</Pressable>
	);
}

function InboxRow({
	item,
	onOpen,
	onLater,
}: {
	item: InboxItem;
	onOpen: (item: InboxItem) => void;
	onLater: (item: InboxItem) => void;
}) {
	const { colors, typography, fonts } = useAppTheme();
	const { title, detail } = notificationText(item.template, item.payload);
	const unread = item.read_at === null;
	const approval = item.category === "approval";
	const time = `${timeLabel(item.created_at, clock.now())} · ${tr.inbox.status[item.category]}`;
	const testID = `inbox.item.${String(item.id)}`;
	const body = (
		<>
			{unread ? (
				<View
					testID={`${testID}.unread`}
					style={[styles.dot, { backgroundColor: colors.accent }]}
				/>
			) : null}
			<ItemIcon item={item} />
			<View style={styles.grow}>
				<Text
					style={{
						fontFamily: fonts.extrabold,
						fontSize: 15,
						lineHeight: 20,
						color: colors.text,
					}}
				>
					{title}
				</Text>
				{detail === "" ? null : (
					<Text
						style={[
							typography.caption,
							{ fontFamily: fonts.medium, color: colors.textMuted, marginTop: 3 },
						]}
					>
						{detail}
					</Text>
				)}
				{approval ? (
					<View style={styles.actions}>
						{CHECK_TEMPLATES.has(item.template) ? (
							<ActionButton
								label={tr.inbox.check}
								primary
								onPress={() => {
									onOpen(item);
								}}
								testID={`${testID}.review.button`}
							/>
						) : (
							<>
								<ActionButton
									label={tr.inbox.review}
									primary
									onPress={() => {
										onOpen(item);
									}}
									testID={`${testID}.review.button`}
								/>
								{unread ? (
									<ActionButton
										label={tr.inbox.later}
										primary={false}
										onPress={() => {
											onLater(item);
										}}
										testID={`${testID}.later.button`}
									/>
								) : null}
							</>
						)}
					</View>
				) : null}
				<Text
					style={[
						typography.caption,
						{ fontSize: 12, color: colors.textMuted, marginTop: 6 },
					]}
				>
					{time}
				</Text>
			</View>
		</>
	);
	const cardStyle = [
		styles.card,
		{ backgroundColor: colors.surface, borderColor: colors.border },
	];
	const label = [unread ? tr.inbox.unread : null, title, detail, time].filter(Boolean).join(", ");
	// Approval notices act through their buttons; the others open as a whole.
	if (approval) {
		return (
			<View testID={testID} accessibilityLabel={label} style={cardStyle}>
				{body}
			</View>
		);
	}
	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={() => {
				onOpen(item);
			}}
			style={({ pressed }) => [cardStyle, { opacity: pressed ? 0.85 : 1 }]}
		>
			{body}
		</Pressable>
	);
}

function ReminderPrefs() {
	const { colors, typography, radius, spacing } = useAppTheme();
	const profile = useMyProfile();
	const save = useSetReminderPrefs();
	const days = profile.data?.reminder_before_days ?? [];
	const toggle = (day: ReminderDay) => {
		const next = new Set(days);
		if (next.has(day)) {
			next.delete(day);
		} else {
			next.add(day);
		}
		save.mutate(REMINDER_DAYS.filter((d) => next.has(d)));
	};
	return (
		<View>
			<Text
				accessibilityRole="header"
				style={[
					typography.label,
					{
						color: colors.textMuted,
						paddingHorizontal: spacing.xs,
						paddingBottom: spacing.sm,
					},
				]}
			>
				{tr.inbox.remindersTitle}
			</Text>
			<View
				style={[
					styles.card,
					styles.column,
					{ backgroundColor: colors.surface, borderColor: colors.border },
				]}
			>
				<Text style={[typography.callout, { fontSize: 14, color: colors.textMuted }]}>
					{tr.inbox.remindersIntro}
				</Text>
				<View style={[styles.wrap, { gap: spacing.sm }]}>
					{REMINDER_DAYS.map((day) => {
						const on = days.includes(day);
						return (
							<Pressable
								key={day}
								testID={`inbox.reminder.${String(day)}`}
								accessibilityRole="togglebutton"
								accessibilityLabel={tr.inbox.reminderDays[day]}
								accessibilityState={{
									selected: on,
									disabled: profile.data === undefined,
								}}
								disabled={profile.data === undefined || save.isPending}
								onPress={() => {
									toggle(day);
								}}
								style={[
									styles.dayChip,
									{
										borderRadius: radius.sm - 2,
										backgroundColor: on ? colors.primarySoft : colors.surface,
										borderColor: on ? colors.accent : colors.borderStrong,
									},
								]}
							>
								{on ? (
									<Ionicons name="checkmark" size={14} color={colors.primary} />
								) : null}
								<Text
									style={[
										typography.label,
										{ color: on ? colors.primary : colors.textMuted },
									]}
								>
									{tr.inbox.reminderDays[day]}
								</Text>
							</Pressable>
						);
					})}
				</View>
				{save.isError ? (
					<Text
						accessibilityLiveRegion="polite"
						style={[typography.caption, { color: colors.overdue }]}
					>
						{tr.inbox.prefsFailed}
					</Text>
				) : null}
			</View>
		</View>
	);
}

// Design 06: the inbox (ADR-051), newest first in Istanbul-day groups, with the reminder preference.
export function InboxScreen() {
	const { colors, typography, spacing, sizes } = useAppTheme();
	const { focus } = useLocalSearchParams<{ focus?: string }>();
	const [filter, setFilter] = useState<Filter>("all");
	const inbox = useInbox(filter === "all" ? null : filter);
	const markRead = useMarkNotificationsRead();
	const scroll = useRef<ScrollView>(null);
	const items = inbox.data?.pages.flatMap((page) => page.items) ?? [];
	const counts = inbox.data?.pages[0];
	const now = clock.now();

	const open = (item: InboxItem) => {
		if (item.read_at === null) {
			markRead.mutate([item.id]);
		}
		if (item.agreement_id !== null) {
			router.push(notificationRoute(item.agreement_id, item.template));
		}
	};

	let content;
	if (inbox.isPending) {
		content = <LoadingState testID="inbox.loading" />;
	} else if (inbox.isError) {
		content = (
			<ErrorState
				message={messageForError(inbox.error)}
				onRetry={() => {
					void inbox.refetch();
				}}
				testID="inbox.error"
			/>
		);
	} else if (items.length === 0) {
		content =
			filter === "all" ? (
				<EmptyState
					title={tr.inbox.emptyTitle}
					body={tr.inbox.emptyBody}
					testID="inbox.empty"
				/>
			) : (
				<Text
					testID="inbox.empty"
					style={[typography.callout, { color: colors.textMuted }]}
				>
					{tr.inbox.emptyFiltered}
				</Text>
			);
	} else {
		content = (
			<>
				{GROUPS.map((group) => {
					const inGroup = items.filter((item) => groupOf(item.created_at, now) === group);
					if (inGroup.length === 0) {
						return null;
					}
					return (
						<View key={group} testID={`inbox.group.${group}`}>
							<Text
								accessibilityRole="header"
								style={[
									typography.label,
									{
										color: colors.textMuted,
										paddingHorizontal: spacing.xs,
										paddingBottom: spacing.sm,
									},
								]}
							>
								{tr.inbox.groups[group]}
							</Text>
							<View style={{ gap: 10 }}>
								{inGroup.map((item) => (
									<InboxRow
										key={item.id}
										item={item}
										onOpen={open}
										onLater={(later) => {
											markRead.mutate([later.id]);
										}}
									/>
								))}
							</View>
						</View>
					);
				})}
				{inbox.hasNextPage ? (
					<Pressable
						testID="inbox.loadMore.button"
						accessibilityRole="button"
						onPress={() => {
							void inbox.fetchNextPage();
						}}
						style={styles.loadMore}
					>
						<Text style={[typography.rowTitle, { color: colors.accent }]}>
							{tr.inbox.loadMore}
						</Text>
					</Pressable>
				) : null}
			</>
		);
	}

	return (
		<SafeAreaView
			testID="inbox.screen"
			edges={["bottom"]}
			style={{ flex: 1, backgroundColor: colors.bg }}
		>
			<TopBar
				title={tr.inbox.title}
				onBack={
					router.canGoBack()
						? () => {
								router.back();
							}
						: undefined
				}
				right={
					<IconButton
						icon="checkmark-done-outline"
						label={tr.inbox.markAll}
						onPress={() => {
							markRead.mutate(null);
						}}
						testID="inbox.markAll.button"
					/>
				}
			/>
			<ScrollView
				ref={scroll}
				contentContainerStyle={{ paddingBottom: spacing.xxl, gap: 18 }}
			>
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					accessibilityRole="tablist"
					contentContainerStyle={{
						gap: spacing.sm,
						paddingHorizontal: sizes.screenPadding,
						paddingTop: spacing.sm,
					}}
				>
					{FILTERS.map((key) => (
						<Chip
							key={key}
							label={tr.inbox.filters[key]}
							count={
								key === "all"
									? (counts?.unread_count ?? null)
									: key === "approval"
										? (counts?.approval_count ?? null)
										: null
							}
							selected={filter === key}
							onPress={() => {
								setFilter(key);
							}}
							testID={`inbox.filter.${key}`}
						/>
					))}
				</ScrollView>
				<View style={{ paddingHorizontal: sizes.screenPadding, gap: 18 }}>
					{content}
					<View
						onLayout={(event) => {
							// Profil > "Bildirim tercihleri" lands on this card.
							if (focus === "reminders") {
								scroll.current?.scrollTo({
									y: event.nativeEvent.layout.y,
									animated: false,
								});
							}
						}}
					>
						<ReminderPrefs />
					</View>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	grow: { flex: 1 },
	chip: {
		minHeight: 44,
		paddingHorizontal: 14,
		borderWidth: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	chipCount: {
		minWidth: 20,
		height: 20,
		borderRadius: 10,
		paddingHorizontal: 5,
		alignItems: "center",
		justifyContent: "center",
	},
	card: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: "row", gap: 12 },
	column: { flexDirection: "column", gap: 10 },
	dot: { position: "absolute", left: 6, top: 22, width: 6, height: 6, borderRadius: 3 },
	itemIcon: {
		width: 40,
		height: 40,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
	},
	actions: { flexDirection: "row", gap: 8, marginTop: 10 },
	action: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, justifyContent: "center" },
	wrap: { flexDirection: "row", flexWrap: "wrap" },
	dayChip: {
		minHeight: 44,
		paddingHorizontal: 12,
		borderWidth: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	loadMore: { minHeight: 44, alignItems: "center", justifyContent: "center" },
});
