import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useDashboard } from "@/api/hooks";
import type { Dashboard, DueItem } from "@/api/types";
import { AmountText } from "@/components/AmountText";
import { Avatar } from "@/components/Avatar";
import { Brand } from "@/components/Brand";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { useSession } from "@/features/auth/sessionStore";
import { DueItemRow } from "@/features/agreements/DueItemRow";
import { useNewDraft } from "@/features/new/draftStore";
import type { NewType } from "@/features/new/formModel";
import { fill, tr } from "@/i18n/tr";
import type { ColorToken } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

type IconName = keyof typeof Ionicons.glyphMap;

// Spec 5.1 step 7: the three most common starts, as the design's quick-action tiles.
const TEMPLATES: {
	type: NewType;
	label: string;
	icon: IconName;
	tone: [ColorToken, ColorToken];
}[] = [
	{
		type: "lent",
		label: tr.new.lent,
		icon: "arrow-up-outline",
		tone: ["success", "successSoft"],
	},
	{
		type: "borrowed",
		label: tr.new.borrowed,
		icon: "arrow-down-outline",
		tone: ["pending", "pendingSoft"],
	},
	{
		type: "boughtInstallment",
		label: tr.new.boughtInstallment,
		icon: "layers-outline",
		tone: ["warning", "warningSoft"],
	},
];

// Design 03: the bell carries what waits for me; Talepler is where it is answered.
function NotificationsButton({ count }: { count: number }) {
	const { colors, fonts, sizes } = useAppTheme();
	return (
		<Pressable
			testID="home.notifications.button"
			accessibilityRole="button"
			accessibilityLabel={
				count > 0
					? fill(tr.home.notifications, { count: String(count) })
					: tr.home.notificationsNone
			}
			onPress={() => {
				router.push("/requests");
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

// Spec 6.1: profile and settings open from the greeting.
function Greeting() {
	const { colors, typography, fonts, spacing } = useAppTheme();
	const name = useSession((state) => state.user?.display_name ?? null);
	return (
		<Pressable
			testID="home.profile.button"
			accessibilityRole="button"
			accessibilityLabel={tr.settings.open}
			onPress={() => {
				router.push("/settings");
			}}
			style={[styles.greeting, { gap: spacing.md }]}
		>
			<Avatar name={name ?? "?"} size={52} />
			<View style={styles.grow}>
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{tr.home.hello}
				</Text>
				<Text
					style={{ fontFamily: fonts.extrabold, fontSize: 18, color: colors.text }}
					numberOfLines={1}
				>
					{name ?? tr.tabs.home}
				</Text>
			</View>
			<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
		</Pressable>
	);
}

function QuickActions() {
	const { colors, typography, spacing, radius } = useAppTheme();
	const start = useNewDraft((state) => state.start);
	return (
		<View style={[styles.tiles, { gap: spacing.sm }]}>
			{TEMPLATES.map(({ type, label, icon, tone: [fg, bg] }) => (
				<Pressable
					key={type}
					testID={`home.template.${type}`}
					accessibilityRole="button"
					accessibilityLabel={label}
					onPress={() => {
						start(type);
						router.push("/new/form");
					}}
					style={({ pressed }) => [
						styles.tile,
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
							styles.tileIcon,
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

function TotalCard({
	label,
	minor,
	monthMinor,
	tone,
	testID,
	monthTestID,
}: {
	label: string;
	minor: number;
	monthMinor: number;
	tone: ColorToken;
	testID: string;
	monthTestID: string;
}) {
	const { colors, typography, spacing } = useAppTheme();
	return (
		<Card
			accessibilityLabel={label}
			onPress={() => {
				router.push("/debts");
			}}
			style={[styles.grow, { gap: spacing.xs, borderRadius: 18 }]}
		>
			<Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
			<AmountText minor={minor} variant="headline" tone={tone} testID={testID} />
			<View style={[styles.line, { gap: spacing.xs }]}>
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{tr.home.thisMonth}
				</Text>
				<AmountText
					minor={monthMinor}
					variant="caption"
					tone="textMuted"
					testID={monthTestID}
				/>
			</View>
		</Card>
	);
}

function DueList({ items, prefix }: { items: DueItem[]; prefix: string }) {
	const { colors } = useAppTheme();
	return (
		<Card style={{ paddingVertical: 0 }}>
			{items.map((item, index) => (
				<View
					key={`${item.agreement_id}.${String(item.seq)}`}
					style={
						index === 0
							? undefined
							: { borderTopWidth: 1, borderTopColor: colors.divider }
					}
				>
					<DueItemRow
						item={item}
						testID={`${prefix}.${item.agreement_id}.${String(item.seq)}`}
					/>
				</View>
			))}
		</Card>
	);
}

function DashboardContent({ data }: { data: Dashboard }) {
	const { colors, typography, spacing } = useAppTheme();

	if (!data.has_agreements) {
		return (
			<>
				<EmptyState
					title={tr.home.emptyTitle}
					body={tr.home.emptyBody}
					actionLabel={tr.home.addFirst}
					onAction={() => {
						router.push("/new");
					}}
					testID="home.empty"
				/>
				<SectionHeader>{tr.home.quickStart}</SectionHeader>
				<QuickActions />
			</>
		);
	}

	return (
		<>
			<View style={[styles.row, { gap: spacing.sm }]}>
				<TotalCard
					label={tr.home.receivable}
					minor={data.receivable_minor}
					monthMinor={data.collect_this_month_minor}
					tone="receivable"
					testID="home.receivable.amount"
					monthTestID="home.collectThisMonth.amount"
				/>
				<TotalCard
					label={tr.home.payable}
					minor={data.payable_minor}
					monthMinor={data.due_this_month_minor}
					tone="payable"
					testID="home.payable.amount"
					monthTestID="home.dueThisMonth.amount"
				/>
			</View>

			{data.pending_count > 0 ? (
				<Pressable
					testID="home.pending.band"
					accessibilityRole="button"
					accessibilityLabel={fill(tr.home.pending, {
						count: String(data.pending_count),
					})}
					onPress={() => {
						router.push("/requests");
					}}
					style={[
						styles.band,
						{
							backgroundColor: colors.warningSoft,
							borderColor: colors.warningSoft,
							gap: spacing.sm,
						},
					]}
				>
					<Ionicons name="time-outline" size={20} color={colors.warning} />
					<Text style={[typography.rowTitle, styles.grow, { color: colors.warning }]}>
						{fill(tr.home.pending, { count: String(data.pending_count) })}
					</Text>
					<Ionicons name="chevron-forward" size={18} color={colors.warning} />
				</Pressable>
			) : null}

			<QuickActions />

			{data.overdue.length > 0 ? (
				<View testID="home.overdue.list" style={{ gap: spacing.sm }}>
					<SectionHeader>{tr.home.overdue}</SectionHeader>
					<DueList items={data.overdue} prefix="home.overdue.item" />
				</View>
			) : null}

			<View testID="home.upcoming.list" style={{ gap: spacing.sm }}>
				<View style={styles.between}>
					<SectionHeader>{tr.home.upcoming}</SectionHeader>
					<Pressable
						accessibilityRole="link"
						onPress={() => {
							router.push("/calendar");
						}}
						style={styles.link}
					>
						<Text style={[typography.rowTitle, { color: colors.accent }]}>
							{tr.home.seeCalendar}
						</Text>
					</Pressable>
				</View>
				{data.upcoming.length === 0 ? (
					<Text style={[typography.body, { color: colors.textMuted }]}>
						{tr.home.upcomingEmpty}
					</Text>
				) : (
					<DueList items={data.upcoming} prefix="home.upcoming.item" />
				)}
			</View>
		</>
	);
}

// S05, design 03
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
			<View style={styles.between}>
				<Brand testID="home.brand" />
				<NotificationsButton count={dashboard.data?.pending_count ?? 0} />
			</View>
			<Greeting />
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
				<DashboardContent data={dashboard.data} />
			)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row" },
	line: { flexDirection: "row", alignItems: "center" },
	between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	grow: { flex: 1, minWidth: 0 },
	center: { textAlign: "center" },
	brand: { flexDirection: "row", alignItems: "center", gap: 8 },
	mark: {
		width: 26,
		height: 26,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
	},
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
	tiles: { flexDirection: "row" },
	tile: {
		flex: 1,
		alignItems: "center",
		paddingTop: 14,
		paddingBottom: 12,
		paddingHorizontal: 4,
		borderWidth: 1,
		minHeight: 96,
	},
	tileIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
	band: {
		flexDirection: "row",
		alignItems: "center",
		borderRadius: 18,
		borderWidth: 1,
		paddingHorizontal: 16,
		minHeight: 56,
	},
	link: { minHeight: 44, justifyContent: "center" },
});
