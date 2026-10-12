import { formatTRY } from "@paramnet/shared";
import { router } from "expo-router";
import { RefreshControl, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useRequests } from "@/api/hooks";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { ListItem } from "@/components/ListItem";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { SectionHeader } from "@/components/SectionHeader";
import { fill, tr } from "@/i18n/tr";

// S19: plans shared with me / counter offers, and payments waiting for my confirmation.
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
				<>
					{(["share", "payment", "amendment"] as const).map((section) => {
						const items = requests.data.filter((item) =>
							section === "share"
								? item.kind === "share" || item.kind === "counter"
								: item.kind === section,
						);
						return items.length === 0 ? null : (
							<View
								key={section}
								style={{ gap: 4 }}
								testID={`requests.section.${section}`}
							>
								<SectionHeader>
									{section === "payment"
										? tr.requests.sectionPayments
										: tr.requests.sectionShares}
								</SectionHeader>
								{items.map((item) => (
									<ListItem
										key={item.payment_id ?? item.agreement_id}
										title={item.title}
										subtitle={
											item.kind === "amendment"
												? fill(tr.requests.amendment, {
														name: item.from_name ?? "",
													})
												: item.kind === "payment"
													? fill(tr.requests.paymentReported, {
															name: item.from_name ?? "",
															amount: formatTRY(
																item.amount_minor ?? 0,
															),
														})
													: `${fill(item.kind === "counter" ? tr.requests.countered : tr.requests.shared, { name: item.from_name ?? "" })} · ${formatTRY(item.principal_minor)}`
										}
										onPress={() => {
											// Payments are answered on the agreement, plans on the decision screen.
											router.push(
												item.kind === "payment"
													? {
															pathname: "/agreement/[id]",
															params: { id: item.agreement_id },
														}
													: {
															pathname: "/agreement/[id]/decide",
															params: { id: item.agreement_id },
														},
											);
										}}
										testID={`requests.item.${item.payment_id ?? item.agreement_id}`}
									/>
								))}
							</View>
						);
					})}
				</>
			)}
		</Screen>
	);
}
