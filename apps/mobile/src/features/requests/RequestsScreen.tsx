import { formatTRY } from "@paramnet/shared";
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
import { ScreenTitle } from "@/components/ScreenTitle";
import { SectionHeader } from "@/components/SectionHeader";
import { Badge, type BadgeTone } from "@/components/StatusBadge";
import type { RequestItem } from "@/api/types";
import { useAppTheme } from "@/theme/useAppTheme";
import { fill, tr } from "@/i18n/tr";

// Design 03 / 06: each row says what it needs from me.
const ACTION: Record<RequestItem["kind"], { label: string; tone: BadgeTone }> = {
	share: { label: tr.requests.actionAnswer, tone: "pending" },
	counter: { label: tr.requests.actionAnswer, tone: "pending" },
	amendment: { label: tr.requests.actionAnswer, tone: "pending" },
	payment: { label: tr.requests.actionConfirm, tone: "warning" },
	dispute: { label: tr.requests.actionReview, tone: "overdue" },
	cancel: { label: tr.requests.actionReview, tone: "neutral" },
};

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
													subtitle={
														item.kind === "amendment" ||
														item.kind === "dispute" ||
														item.kind === "cancel"
															? fill(tr.requests[item.kind], {
																	name: item.from_name ?? "",
																})
															: item.kind === "payment"
																? fill(
																		tr.requests.paymentReported,
																		{
																			name:
																				item.from_name ??
																				"",
																			amount: formatTRY(
																				item.amount_minor ??
																					0,
																			),
																		},
																	)
																: `${fill(item.kind === "counter" ? tr.requests.countered : tr.requests.shared, { name: item.from_name ?? "" })} · ${formatTRY(item.principal_minor)}`
													}
													onPress={() => {
														// Plans are answered on the decision screen, everything else on the agreement.
														router.push(
															item.kind !== "share" &&
																item.kind !== "counter" &&
																item.kind !== "amendment"
																? {
																		pathname: "/agreement/[id]",
																		params: {
																			id: item.agreement_id,
																		},
																	}
																: {
																		pathname:
																			"/agreement/[id]/decide",
																		params: {
																			id: item.agreement_id,
																		},
																	},
														);
													}}
													testID={
														item.kind === "dispute" ||
														item.kind === "cancel"
															? `requests.item.${item.kind}.${item.agreement_id}`
															: `requests.item.${item.payment_id ?? item.agreement_id}`
													}
													left={
														<Avatar
															name={item.from_name ?? item.title}
														/>
													}
													right={<Badge {...ACTION[item.kind]} />}
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
