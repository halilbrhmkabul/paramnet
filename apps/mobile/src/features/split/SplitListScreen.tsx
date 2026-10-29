import { formatDateTR, formatTRY } from "@paramnet/shared";
import { router } from "expo-router";
import { RefreshControl, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useSplits } from "@/api/hooks";
import { AmountText } from "@/components/AmountText";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { ListItem } from "@/components/ListItem";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

import { MemberCard } from "./parts";

// Every split I paid or have a share in (Borçlarım → "Ortak hesaplar"); not in the design, which
// reaches 42 from a share's record.
export function SplitListScreen() {
	const { spacing } = useAppTheme();
	const splits = useSplits();
	return (
		<Screen
			testID="splitList.screen"
			refreshControl={
				<RefreshControl
					refreshing={splits.isRefetching}
					onRefresh={() => {
						void splits.refetch();
					}}
				/>
			}
		>
			{splits.isPending ? (
				<LoadingState testID="splitList.loading" />
			) : splits.isError ? (
				<ErrorState
					message={messageForError(splits.error)}
					onRetry={() => {
						void splits.refetch();
					}}
					testID="splitList.error"
				/>
			) : splits.data.length === 0 ? (
				<EmptyState
					title={tr.split.listEmptyTitle}
					body={tr.split.listEmptyBody}
					actionLabel={tr.split.createTitle}
					onAction={() => {
						router.push("/split/new");
					}}
					actionTestID="splitList.create"
					testID="splitList.empty"
				/>
			) : (
				<View style={{ gap: spacing.sm }}>
					<MemberCard>
						{splits.data.map((s) => (
							<ListItem
								key={s.id}
								title={s.title}
								subtitle={`${fill(tr.split.listItem, {
									date: formatDateTR(s.spent_on, "short"),
									count: String(s.member_count),
								})} · ${
									s.is_owner
										? tr.split.listMine
										: fill(tr.split.listTheirs, {
												name: s.owner_name,
												amount: formatTRY(s.my_share_minor ?? 0),
											})
								}`}
								left={<Avatar name={s.owner_name} size={40} />}
								right={<AmountText minor={s.total_minor} />}
								onPress={() => {
									router.push({ pathname: "/split/[id]", params: { id: s.id } });
								}}
								testID={`splitList.item.${s.id}`}
							/>
						))}
					</MemberCard>
				</View>
			)}
		</Screen>
	);
}
