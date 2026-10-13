import { router } from "expo-router";
import { Children, isValidElement, type ReactNode } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useAgreements, useDashboard, useRequests } from "@/api/hooks";
import type { AgreementSummary, Dashboard, RequestItem } from "@/api/types";
import { AmountText } from "@/components/AmountText";
import { Avatar } from "@/components/Avatar";
import { Brand } from "@/components/Brand";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Icon, type IconName } from "@/components/Icon";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { Badge } from "@/components/StatusBadge";
import { IconButton } from "@/components/TopBar";
import { useSession } from "@/features/auth/sessionStore";
import { DueItemRow } from "@/features/agreements/DueItemRow";
import { useNewDraft } from "@/features/new/draftStore";
import {
	REQUEST_ACTION,
	requestKey,
	requestLines,
	requestTarget,
} from "@/features/requests/requestText";
import { fill, tr } from "@/i18n/tr";
import { clock } from "@/lib/clock";
import type { ColorToken } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

const CLOSED = new Set(["settled", "cancelled", "rejected"]);
const PENDING_ROWS = 3;

// "Günaydın," until noon, "İyi günler," until six, then "İyi akşamlar," (Istanbul time, UTC+3).
function greeting(now: Date): string {
	const hour = (now.getUTCHours() + 3) % 24;
	if (hour >= 5 && hour < 12) {
		return tr.home.morning;
	}
	return hour >= 12 && hour < 18 ? tr.home.day : tr.home.evening;
}

// Design 03: the bell carries what waits for me; Bildirimler is where it is answered.
function NotificationsButton({ count }: { count: number }) {
	const { colors, fonts } = useAppTheme();
	return (
		<IconButton
			icon="bell"
			label={
				count > 0
					? fill(tr.home.notifications, { count: String(count) })
					: tr.home.notificationsNone
			}
			onPress={() => {
				router.push("/requests");
			}}
			testID="home.notifications.button"
			badge={
				count > 0 ? (
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
				) : null
			}
		/>
	);
}

// Spec 6.1: profile and settings open from the greeting.
function Greeting() {
	const { colors, fonts } = useAppTheme();
	const name = useSession((state) => state.user?.display_name ?? null);
	return (
		<Pressable
			testID="home.profile.button"
			accessibilityRole="button"
			accessibilityLabel={tr.settings.open}
			onPress={() => {
				router.push("/settings");
			}}
			style={styles.greeting}
		>
			<Avatar name={name ?? "?"} size={52} />
			<View style={styles.grow}>
				<Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted }}>
					{greeting(clock.now())}
				</Text>
				<Text
					numberOfLines={1}
					style={{
						fontFamily: fonts.extrabold,
						fontSize: 18,
						letterSpacing: -0.2,
						color: colors.text,
					}}
				>
					{name ?? tr.tabs.home}
				</Text>
			</View>
			<Icon name="chevronRight" size={20} tone="textMuted" />
		</Pressable>
	);
}

// Design 03 ".qa": four tiles; the ones whose module is not built yet stay in place, disabled.
const ACTIONS: {
	key: "expense" | "payment" | "request" | "lend";
	icon: IconName;
	tone: [ColorToken, ColorToken];
	soon: boolean;
}[] = [
	{ key: "expense", icon: "receipt", tone: ["expense", "expenseSoft"], soon: true },
	{ key: "payment", icon: "checkCircle", tone: ["success", "successSoft"], soon: false },
	{ key: "request", icon: "request", tone: ["pending", "pendingSoft"], soon: true },
	{ key: "lend", icon: "lend", tone: ["violet", "violetSoft"], soon: false },
];

function QuickActions() {
	const { colors, fonts } = useAppTheme();
	const start = useNewDraft((state) => state.start);
	const run = {
		expense: () => undefined,
		request: () => undefined,
		// Payments are recorded on the agreement; Borçlarım is where it is picked.
		payment: () => {
			router.navigate("/debts");
		},
		lend: () => {
			start("lent");
			router.push("/new/form");
		},
	};
	return (
		<View style={styles.tiles}>
			{ACTIONS.map(({ key, icon, tone: [fg, bg], soon }) => (
				<Pressable
					key={key}
					testID={`home.action.${key}`}
					accessibilityRole="button"
					accessibilityLabel={
						soon ? `${tr.home.actions[key]}, ${tr.common.soon}` : tr.home.actions[key]
					}
					accessibilityState={{ disabled: soon }}
					disabled={soon}
					onPress={run[key]}
					style={({ pressed }) => [
						styles.tile,
						{
							backgroundColor: colors.surface,
							borderColor: colors.border,
							opacity: soon ? 0.55 : pressed ? 0.8 : 1,
						},
					]}
				>
					<View style={[styles.tileIcon, { backgroundColor: colors[bg] }]}>
						<Icon name={icon} size={22} tone={fg} />
					</View>
					<Text
						style={[
							styles.center,
							{ fontFamily: fonts.bold, fontSize: 13, color: colors.text },
						]}
					>
						{tr.home.actions[key]}
					</Text>
					{soon ? (
						<Text
							style={{
								fontFamily: fonts.semibold,
								fontSize: 10,
								color: colors.textMuted,
							}}
						>
							{tr.common.soon}
						</Text>
					) : null}
				</Pressable>
			))}
		</View>
	);
}

function TotalCard({
	label,
	note,
	minor,
	count,
	tone,
	testID,
}: {
	label: string;
	note: string;
	minor: number;
	count: number;
	tone: ColorToken;
	testID: string;
}) {
	const { colors, fonts } = useAppTheme();
	return (
		<Card
			accessibilityLabel={label}
			onPress={() => {
				router.navigate("/debts");
			}}
			style={[styles.grow, styles.total]}
		>
			<View style={styles.between}>
				<Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted }}>
					{label}
				</Text>
				<Badge
					label={fill(tr.home.recordCount, { count: String(count) })}
					tone="neutral"
					testID={`${testID}.count`}
				/>
			</View>
			<AmountText
				minor={minor}
				tone={tone}
				style={{ fontFamily: fonts.extrabold, fontSize: 18, lineHeight: 24 }}
				testID={`${testID}.amount`}
			/>
			<Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted }}>
				{note}
			</Text>
		</Card>
	);
}

function Rows({ children }: { children: ReactNode }) {
	const { colors } = useAppTheme();
	return (
		<>
			{Children.toArray(children).map((child, index) => (
				<View
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
		</>
	);
}

// Design 03: an amber header with the count, then the first few things that wait for me.
function PendingCard({ count, items }: { count: number; items: RequestItem[] }) {
	const { colors, fonts } = useAppTheme();
	const label = fill(tr.home.pending, { count: String(count) });
	return (
		<View
			style={[
				styles.pending,
				{ backgroundColor: colors.surface, borderColor: colors.warningBorder },
			]}
		>
			<Pressable
				testID="home.pending.band"
				accessibilityRole="button"
				accessibilityLabel={label}
				onPress={() => {
					router.push("/requests");
				}}
				style={[styles.pendingHead, { backgroundColor: colors.warningSurface }]}
			>
				<Icon name="clock" size={20} tone="warning" strokeWidth={2} />
				<Text
					style={[
						styles.grow,
						{ fontFamily: fonts.extrabold, fontSize: 15, color: colors.warning },
					]}
				>
					{label}
				</Text>
				<Icon name="chevronRight" size={18} tone="warning" />
			</Pressable>
			<Rows>
				{items.slice(0, PENDING_ROWS).map((item) => {
					const { title, subtitle } = requestLines(item);
					const action = REQUEST_ACTION[item.kind];
					return (
						<Pressable
							key={requestKey(item)}
							testID={`home.pending.item.${requestKey(item)}`}
							accessibilityRole="button"
							accessibilityLabel={`${title}, ${action.label}`}
							onPress={() => {
								router.push(requestTarget(item));
							}}
							style={styles.pendingRow}
						>
							<Avatar name={item.from_name ?? item.title} size={40} />
							<View style={styles.grow}>
								<Text
									numberOfLines={1}
									style={{
										fontFamily: fonts.bold,
										fontSize: 15,
										color: colors.text,
									}}
								>
									{title}
								</Text>
								<Text
									numberOfLines={1}
									style={{
										fontFamily: fonts.medium,
										fontSize: 13,
										marginTop: 2,
										color: colors.textMuted,
									}}
								>
									{subtitle}
								</Text>
							</View>
							<Badge label={action.label} tone={action.tone} />
						</Pressable>
					);
				})}
			</Rows>
		</View>
	);
}

// Design ".sh": a 17/800 heading with a link on the right.
function SectionHead({ title, link, onLink }: { title: string; link: string; onLink: () => void }) {
	const { colors, fonts, typography } = useAppTheme();
	return (
		<View style={[styles.between, styles.sectionHead]}>
			<Text accessibilityRole="header" style={[typography.headline, { color: colors.text }]}>
				{title}
			</Text>
			<Pressable
				accessibilityRole="link"
				accessibilityLabel={link}
				onPress={onLink}
				style={styles.link}
			>
				<Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.accent }}>
					{link}
				</Text>
				<Icon name="chevronRight" size={16} tone="accent" strokeWidth={2} />
			</Pressable>
		</View>
	);
}

function count(
	agreements: AgreementSummary[] | undefined,
	role: AgreementSummary["my_role"],
): number {
	return (agreements ?? []).filter((a) => a.my_role === role && !CLOSED.has(a.status)).length;
}

function DashboardContent({ data }: { data: Dashboard }) {
	const { colors, typography } = useAppTheme();
	const agreements = useAgreements();
	const requests = useRequests();

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

	const due = [
		...data.overdue.map((item) => ({ item, prefix: "home.overdue.item" })),
		...data.upcoming.map((item) => ({ item, prefix: "home.upcoming.item" })),
	];

	return (
		<>
			<View style={styles.pair}>
				<TotalCard
					label={tr.home.payable}
					note={tr.home.payableNote}
					minor={data.payable_minor}
					count={count(agreements.data, "debtor")}
					tone="text"
					testID="home.payable"
				/>
				<TotalCard
					label={tr.home.receivable}
					note={tr.home.receivableNote}
					minor={data.receivable_minor}
					count={count(agreements.data, "creditor")}
					tone="receivable"
					testID="home.receivable"
				/>
			</View>

			<QuickActions />

			{data.pending_count > 0 ? (
				<PendingCard count={data.pending_count} items={requests.data ?? []} />
			) : null}

			<View testID="home.upcoming.list">
				<SectionHead
					title={tr.home.upcoming}
					link={tr.home.seeCalendar}
					onLink={() => {
						router.navigate("/calendar");
					}}
				/>
				{due.length === 0 ? (
					<Text style={[typography.body, { color: colors.textMuted }]}>
						{tr.home.upcomingEmpty}
					</Text>
				) : (
					<Card style={styles.flush}>
						<Rows>
							{due.map(({ item, prefix }) => {
								const id = `${prefix}.${item.agreement_id}.${String(item.seq)}`;
								return <DueItemRow key={id} item={item} testID={id} />;
							})}
						</Rows>
					</Card>
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
			gap={24}
			refreshControl={
				<RefreshControl
					refreshing={dashboard.isRefetching}
					onRefresh={() => {
						void dashboard.refetch();
					}}
				/>
			}
		>
			<View style={styles.header}>
				<View style={styles.top}>
					<IconButton
						icon="menu"
						label={tr.home.menu}
						onPress={() => {
							router.push("/settings");
						}}
						testID="home.menu.button"
					/>
					<View style={styles.brand}>
						<Brand testID="home.brand" />
					</View>
					<NotificationsButton count={dashboard.data?.pending_count ?? 0} />
				</View>
				<Greeting />
			</View>
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
	header: { gap: 14 },
	top: { flexDirection: "row", alignItems: "center", gap: 8 },
	brand: { flex: 1, alignItems: "center" },
	pair: { flexDirection: "row", gap: 10 },
	between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	grow: { flex: 1, minWidth: 0 },
	center: { textAlign: "center" },
	dot: {
		position: "absolute",
		top: 6,
		right: 6,
		minWidth: 18,
		height: 18,
		paddingHorizontal: 3,
		borderRadius: 9,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
	},
	greeting: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		minHeight: 60,
		paddingHorizontal: 4,
	},
	total: { padding: 14, borderRadius: 18, gap: 4 },
	tiles: { flexDirection: "row", gap: 8 },
	tile: {
		flex: 1,
		alignItems: "center",
		gap: 8,
		paddingTop: 14,
		paddingBottom: 12,
		paddingHorizontal: 4,
		borderRadius: 18,
		borderWidth: 1,
		minHeight: 96,
	},
	tileIcon: {
		width: 44,
		height: 44,
		borderRadius: 14,
		alignItems: "center",
		justifyContent: "center",
	},
	pending: { borderRadius: 22, borderWidth: 1, overflow: "hidden" },
	pendingHead: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingVertical: 14,
		paddingHorizontal: 16,
		minHeight: 52,
	},
	pendingRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingVertical: 12,
		paddingHorizontal: 16,
		minHeight: 66,
	},
	sectionHead: { paddingHorizontal: 4, paddingBottom: 10 },
	link: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 44 },
	flush: { padding: 0, gap: 0 },
});
