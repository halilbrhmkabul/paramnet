import { formatTRY } from "@paramnet/shared";
import { router } from "expo-router";
import { RefreshControl } from "react-native";

import { messageForError } from "@/api/errors";
import { useRequests } from "@/api/hooks";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { ListItem } from "@/components/ListItem";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { fill, tr } from "@/i18n/tr";

// S19 "Paylaşımlar": plans shared with me and counter offers waiting for my answer. Payments and
// amendments join with F2-07 / F2-08.
export function RequestsScreen() {
	const requests = useRequests();
	return (
		<Screen
			testID="requests.screen"
			refreshControl={
				<RefreshControl
					refreshing={requests.isRefetching}
					onRefresh={() => {
						void requests.refetch();
					}}
				/>
			}
		>
			<ScreenTitle>{tr.tabs.requests}</ScreenTitle>
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
			) : requests.data.length === 0 ? (
				<EmptyState
					title={tr.requests.emptyTitle}
					body={tr.requests.emptyBody}
					testID="requests.empty"
				/>
			) : (
				requests.data.map((item) => (
					<ListItem
						key={item.agreement_id}
						title={item.title}
						subtitle={`${fill(item.kind === "counter" ? tr.requests.countered : tr.requests.shared, { name: item.from_name ?? "" })} · ${formatTRY(item.principal_minor)}`}
						onPress={() => {
							router.push({
								pathname: "/agreement/[id]/decide",
								params: { id: item.agreement_id },
							});
						}}
						testID={`requests.item.${item.agreement_id}`}
					/>
				))
			)}
		</Screen>
	);
}
