import { router } from "expo-router";
import { RefreshControl, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useRequests } from "@/api/hooks";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { ListItem } from "@/components/ListItem";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { Badge } from "@/components/StatusBadge";
import { useAppTheme } from "@/theme/useAppTheme";
import { tr } from "@/i18n/tr";

import { REQUEST_ACTION, requestHref, requestKey, requestLine } from "./requestModel";

const SECTION_TITLES = {
	share: tr.requests.sectionShares,
	payment: tr.requests.sectionPayments,
	amendment: tr.requests.sectionAmendments,
	dispute: tr.requests.sectionDisputes,
	cancel: tr.requests.sectionCancels,
};

// S19: plans shared with me / counter offers, payments waiting for my confirmation, and the other
// side's amendments, disputes and cancellation requests.
export function RequestsScreen() {
	const { colors } = useAppTheme();
	const requests = useRequests();
	return (
		<Screen
			testID="requests.screen"
			edges={["bottom"]}
			refreshControl={
				<RefreshControl
					refreshing={requests.isRefetching}
					onRefresh={() => {
						void requests.refetch();
					}}
				/>
			}
		>
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
				<>
					{(["share", "payment", "amendment", "dispute", "cancel"] as const).map(
						(section) => {
							const items = requests.data.filter((item) =>
								section === "share"
									? item.kind === "share" || item.kind === "counter"
									: item.kind === section,
							);
							return items.length === 0 ? null : (
								<View
									key={section}
									style={{ gap: 8 }}
									testID={`requests.section.${section}`}
								>
									<SectionHeader>{SECTION_TITLES[section]}</SectionHeader>
									<Card style={{ paddingVertical: 0 }}>
										{items.map((item, index) => (
											<View
												key={item.payment_id ?? item.agreement_id}
												style={
													index === 0
														? undefined
														: {
																borderTopWidth: 1,
																borderTopColor: colors.divider,
															}
												}
											>
												<ListItem
													title={item.title}
													subtitle={requestLine(item)}
													onPress={() => {
														router.push(requestHref(item));
													}}
													testID={`requests.item.${requestKey(item)}`}
													left={
														<Avatar
															name={item.from_name ?? item.title}
														/>
													}
													right={<Badge {...REQUEST_ACTION[item.kind]} />}
												/>
											</View>
										))}
									</Card>
								</View>
							);
						},
					)}
				</>
			)}
		</Screen>
	);
}
