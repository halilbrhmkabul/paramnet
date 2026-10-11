import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useDashboard } from "@/api/hooks";
import type { Dashboard } from "@/api/types";
import { AmountText } from "@/components/AmountText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { SectionHeader } from "@/components/SectionHeader";
import { useSession } from "@/features/auth/sessionStore";
import { DueItemRow } from "@/features/agreements/DueItemRow";
import { useNewDraft } from "@/features/new/draftStore";
import type { NewType } from "@/features/new/formModel";
import { fill, tr } from "@/i18n/tr";
import type { ColorToken } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

// Spec 5.1 step 7: the three most common starts.
const TEMPLATES: { type: NewType; label: string }[] = [
	{ type: "lent", label: tr.new.lent },
	{ type: "borrowed", label: tr.new.borrowed },
	{ type: "boughtInstallment", label: tr.new.boughtInstallment },
];

function SummaryCard({
	label,
	minor,
	tone,
	testID,
}: {
	label: string;
	minor: number;
	tone: ColorToken;
	testID: string;
}) {
	const { colors, typography } = useAppTheme();
	return (
		<Card style={styles.summaryCard}>
			<Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
			<AmountText minor={minor} variant="amountL" tone={tone} testID={testID} />
		</Card>
	);
}

function DashboardContent({ data }: { data: Dashboard }) {
	const { colors, typography, spacing } = useAppTheme();
	const start = useNewDraft((state) => state.start);

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
				{TEMPLATES.map(({ type, label }) => (
					<Button
						key={type}
						label={label}
						variant="secondary"
						onPress={() => {
							start(type);
							router.push("/new/form");
						}}
						testID={`home.template.${type}`}
					/>
				))}
			</>
		);
	}

	return (
		<>
			{data.pending_count > 0 ? (
				<Card
					testID="home.pending.band"
					accessibilityLabel={fill(tr.home.pending, {
						count: String(data.pending_count),
					})}
					onPress={() => {
						router.push("/requests");
					}}
				>
					<Text style={[typography.headline, { color: colors.warning }]}>
						{fill(tr.home.pending, { count: String(data.pending_count) })}
					</Text>
				</Card>
			) : null}
			<View style={[styles.grid, { gap: spacing.md }]}>
				<SummaryCard
					label={tr.home.receivable}
					minor={data.receivable_minor}
					tone="receivable"
					testID="home.receivable.amount"
				/>
				<SummaryCard
					label={tr.home.payable}
					minor={data.payable_minor}
					tone="payable"
					testID="home.payable.amount"
				/>
				<SummaryCard
					label={tr.home.collectThisMonth}
					minor={data.collect_this_month_minor}
					tone="text"
					testID="home.collectThisMonth.amount"
				/>
				<SummaryCard
					label={tr.home.dueThisMonth}
					minor={data.due_this_month_minor}
					tone="text"
					testID="home.dueThisMonth.amount"
				/>
			</View>

			{data.overdue.length > 0 ? (
				<View testID="home.overdue.list" style={{ gap: spacing.xs }}>
					<SectionHeader>{tr.home.overdue}</SectionHeader>
					{data.overdue.map((item) => (
						<DueItemRow
							key={`${item.agreement_id}.${String(item.seq)}`}
							item={item}
							testID={`home.overdue.item.${item.agreement_id}.${String(item.seq)}`}
						/>
					))}
				</View>
			) : null}

			<View testID="home.upcoming.list" style={{ gap: spacing.xs }}>
				<SectionHeader>{tr.home.upcoming}</SectionHeader>
				{data.upcoming.length === 0 ? (
					<Text style={[typography.body, { color: colors.textMuted }]}>
						{tr.home.upcomingEmpty}
					</Text>
				) : (
					data.upcoming.map((item) => (
						<DueItemRow
							key={`${item.agreement_id}.${String(item.seq)}`}
							item={item}
							testID={`home.upcoming.item.${item.agreement_id}.${String(item.seq)}`}
						/>
					))
				)}
			</View>
		</>
	);
}

// Spec 6.1: profile and settings open from the avatar at the top right of Home.
function ProfileButton() {
	const { colors, sizes } = useAppTheme();
	return (
		<Pressable
			testID="home.profile.button"
			accessibilityRole="button"
			accessibilityLabel={tr.settings.open}
			onPress={() => {
				router.push("/settings");
			}}
			style={[
				styles.avatar,
				{
					width: sizes.minTouch,
					height: sizes.minTouch,
					borderRadius: sizes.minTouch / 2,
					backgroundColor: colors.surface,
				},
			]}
		>
			<Ionicons name="person-outline" size={22} color={colors.primary} />
		</Pressable>
	);
}

// S05
export function HomeScreen() {
	const dashboard = useDashboard();
	const name = useSession((state) => state.user?.display_name ?? null);

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
			<View style={styles.header}>
				<ScreenTitle>
					{name === null ? tr.tabs.home : fill(tr.home.greeting, { name })}
				</ScreenTitle>
				<ProfileButton />
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
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 8,
	},
	avatar: {
		alignItems: "center",
		justifyContent: "center",
	},
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
	},
	summaryCard: {
		flexGrow: 1,
		flexBasis: "45%",
	},
});
