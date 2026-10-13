import { daysBetween, formatDateTR, formatTRY } from "@paramnet/shared";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useDashboard, useRequests } from "@/api/hooks";
import type { DueItem, RequestItem } from "@/api/types";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Icon } from "@/components/Icon";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { installmentPosition } from "@/features/agreements/DueItemRow";
import { REQUEST_ACTION, requestKey, requestLines, requestTarget } from "./requestText";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { useAppTheme } from "@/theme/useAppTheme";

type Filter = "all" | "actions" | "reminders";

// Reminders cover what is overdue or due within this many days (the push schedule's window).
const REMINDER_DAYS = 3;

const STATUS_LINE: Record<RequestItem["kind"], string> = {
	share: tr.requests.awaitingAnswer,
	counter: tr.requests.awaitingAnswer,
	amendment: tr.requests.awaitingAnswer,
	payment: tr.requests.awaitingConfirm,
	dispute: tr.requests.needsReview,
	cancel: tr.requests.needsReview,
};

// Design 06 ".chip": a pill tab with an optional count.
function Chip({
	label,
	count,
	selected,
	onPress,
	testID,
}: {
	label: string;
	count?: number;
	selected: boolean;
	onPress: () => void;
	testID: string;
}) {
	const { colors, fonts } = useAppTheme();
	return (
		<Pressable
			testID={testID}
			accessibilityRole="tab"
			accessibilityState={{ selected }}
			onPress={onPress}
			style={[
				styles.chip,
				{
					backgroundColor: selected ? colors.primary : colors.surface,
					borderColor: selected ? colors.primary : colors.borderStrong,
				},
			]}
		>
			<Text
				style={{
					fontFamily: fonts.bold,
					fontSize: 14,
					color: selected ? colors.onPrimary : colors.neutral,
				}}
			>
				{label}
			</Text>
			{count === undefined ? null : (
				<View style={[styles.count, { backgroundColor: colors.primarySoft }]}>
					<Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.primary }}>
						{String(count)}
					</Text>
				</View>
			)}
		</Pressable>
	);
}

// Design 06 ".nt.un": an unread dot, avatar, what happened, the action, and its state.
function RequestCard({ item }: { item: RequestItem }) {
	const { colors, fonts } = useAppTheme();
	const { title, subtitle } = requestLines(item);
	const action = REQUEST_ACTION[item.kind];
	const key = requestKey(item);
	return (
		<Pressable
			testID={`requests.item.${key}`}
			accessibilityRole="button"
			accessibilityLabel={`${title}. ${subtitle}. ${action.label}`}
			onPress={() => {
				router.push(requestTarget(item));
			}}
			style={({ pressed }) => [
				styles.card,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					opacity: pressed ? 0.85 : 1,
				},
			]}
		>
			<View style={[styles.unread, { backgroundColor: colors.accent }]} />
			<Avatar name={item.from_name ?? item.title} size={40} />
			<View style={styles.grow}>
				<Text style={{ fontFamily: fonts.extrabold, fontSize: 15, color: colors.text }}>
					{title}
				</Text>
				<Text style={[styles.body, { fontFamily: fonts.medium, color: colors.neutral }]}>
					{subtitle}
				</Text>
				<View style={[styles.action, { backgroundColor: colors.primary }]}>
					<Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.onPrimary }}>
						{action.label}
					</Text>
				</View>
				<Text style={[styles.time, { fontFamily: fonts.medium, color: colors.textMuted }]}>
					{STATUS_LINE[item.kind]}
				</Text>
			</View>
		</Pressable>
	);
}

function ReminderCard({ item }: { item: DueItem }) {
	const { colors, fonts } = useAppTheme();
	const today = useToday();
	const days = daysBetween(today, item.due_date);
	const template =
		item.state.status === "overdue" || days < 0
			? tr.requests.reminderLate
			: days === 0
				? tr.requests.reminderToday
				: tr.requests.reminderSoon;
	const title = fill(template, { title: item.title });
	const body = fill(tr.requests.reminderBody, {
		position: installmentPosition(item.seq, item.installment_count),
		amount: formatTRY(item.due_minor),
		name: item.counterparty_name,
		date: formatDateTR(item.due_date, "dayMonth"),
	});
	const late = template === tr.requests.reminderLate;
	return (
		<Pressable
			testID={`requests.reminder.${item.agreement_id}.${String(item.seq)}`}
			accessibilityRole="button"
			accessibilityLabel={`${title}. ${body}`}
			onPress={() => {
				router.push({ pathname: "/agreement/[id]", params: { id: item.agreement_id } });
			}}
			style={({ pressed }) => [
				styles.card,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					opacity: pressed ? 0.85 : 1,
				},
			]}
		>
			<View
				style={[
					styles.icon,
					{ backgroundColor: late ? colors.overdueSoft : colors.warningSoft },
				]}
			>
				<Icon name="bell" size={20} tone={late ? "overdue" : "warning"} />
			</View>
			<View style={styles.grow}>
				<Text style={{ fontFamily: fonts.extrabold, fontSize: 15, color: colors.text }}>
					{title}
				</Text>
				<Text style={[styles.body, { fontFamily: fonts.medium, color: colors.neutral }]}>
					{body}
				</Text>
				<Text style={[styles.time, { fontFamily: fonts.medium, color: colors.textMuted }]}>
					{tr.requests.reminder}
				</Text>
			</View>
		</Pressable>
	);
}

function Section({
	label,
	empty,
	testID,
	children,
}: {
	label: string;
	empty: string | null;
	testID: string;
	children: ReactNode;
}) {
	const { colors, fonts } = useAppTheme();
	return (
		<View testID={testID}>
			<Text style={[styles.label, { fontFamily: fonts.bold, color: colors.textMuted }]}>
				{label}
			</Text>
			{empty === null ? (
				<View style={styles.list}>{children}</View>
			) : (
				<Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted }}>
					{empty}
				</Text>
			)}
		</View>
	);
}

// S19 · design 06 "Bildirimler": what waits for my answer, and payments due within three days.
export function RequestsScreen() {
	const requests = useRequests();
	const dashboard = useDashboard();
	const today = useToday();
	const [filter, setFilter] = useState<Filter>("all");

	const reminders = dashboard.data
		? [...dashboard.data.overdue, ...dashboard.data.upcoming].filter(
				(item) => daysBetween(today, item.due_date) <= REMINDER_DAYS,
			)
		: [];
	const items = requests.data ?? [];

	return (
		<Screen
			testID="requests.screen"
			edges={["bottom"]}
			gap={18}
			refreshControl={
				<RefreshControl
					refreshing={requests.isRefetching}
					onRefresh={() => {
						void requests.refetch();
						void dashboard.refetch();
					}}
				/>
			}
		>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				accessibilityRole="tablist"
				contentContainerStyle={styles.chips}
				style={styles.chipRow}
			>
				<Chip
					label={tr.requests.filterAll}
					count={items.length + reminders.length}
					selected={filter === "all"}
					onPress={() => {
						setFilter("all");
					}}
					testID="requests.filter.all"
				/>
				<Chip
					label={tr.requests.filterActions}
					count={items.length}
					selected={filter === "actions"}
					onPress={() => {
						setFilter("actions");
					}}
					testID="requests.filter.actions"
				/>
				<Chip
					label={tr.requests.filterReminders}
					selected={filter === "reminders"}
					onPress={() => {
						setFilter("reminders");
					}}
					testID="requests.filter.reminders"
				/>
			</ScrollView>

			{requests.isPending ? (
				<LoadingState testID="requests.loading" />
			) : requests.isError ? (
				<ErrorState
					message={messageForError(requests.error)}
					onRetry={() => {
						void requests.refetch();
					}}
					testID="requests.error"
				/>
			) : items.length === 0 && reminders.length === 0 ? (
				<EmptyState
					title={tr.requests.emptyTitle}
					body={tr.requests.emptyBody}
					testID="requests.empty"
				/>
			) : (
				<>
					{filter === "reminders" ? null : (
						<Section
							label={tr.requests.sectionActions}
							empty={items.length === 0 ? tr.requests.actionsEmpty : null}
							testID="requests.section.actions"
						>
							{items.map((item) => (
								<RequestCard key={requestKey(item)} item={item} />
							))}
						</Section>
					)}
					{filter === "actions" ? null : (
						<Section
							label={tr.requests.sectionReminders}
							empty={reminders.length === 0 ? tr.requests.remindersEmpty : null}
							testID="requests.section.reminders"
						>
							{reminders.map((item) => (
								<ReminderCard
									key={`${item.agreement_id}.${String(item.seq)}`}
									item={item}
								/>
							))}
						</Section>
					)}
				</>
			)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	chipRow: { marginHorizontal: -16, flexGrow: 0 },
	chips: { gap: 8, paddingHorizontal: 16 },
	chip: {
		height: 40,
		paddingHorizontal: 14,
		borderRadius: 999,
		borderWidth: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	count: {
		minWidth: 20,
		height: 20,
		borderRadius: 10,
		paddingHorizontal: 5,
		alignItems: "center",
		justifyContent: "center",
	},
	label: { fontSize: 13, lineHeight: 18, paddingHorizontal: 4, paddingBottom: 8 },
	list: { gap: 10 },
	card: { borderRadius: 18, borderWidth: 1, padding: 14, flexDirection: "row", gap: 12 },
	unread: { position: "absolute", left: 6, top: 22, width: 6, height: 6, borderRadius: 3 },
	icon: {
		width: 40,
		height: 40,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
	},
	grow: { flex: 1, minWidth: 0 },
	body: { fontSize: 13, lineHeight: 19, marginTop: 3 },
	action: {
		alignSelf: "flex-start",
		height: 40,
		paddingHorizontal: 14,
		borderRadius: 12,
		justifyContent: "center",
		marginTop: 10,
	},
	time: { fontSize: 12, marginTop: 6 },
});
