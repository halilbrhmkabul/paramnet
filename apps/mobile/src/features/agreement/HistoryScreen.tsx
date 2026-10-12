import { formatDateTimeTR, formatTRY } from "@paramnet/shared";
import { useLocalSearchParams } from "expo-router";

import { messageForError } from "@/api/errors";
import { useAgreement } from "@/api/hooks";
import type { EventView } from "@/api/types";
import { ErrorState } from "@/components/ErrorState";
import { ListItem } from "@/components/ListItem";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { fill, tr } from "@/i18n/tr";

function describe(event: EventView): string {
	switch (event.type) {
		case "created":
			return tr.history.created;
		case "payment_recorded":
			return fill(tr.history.paymentRecorded, { amount: formatTRY(event.amount_minor ?? 0) });
		case "updated":
			return tr.history.updated;
		case "cancelled":
			return tr.history.cancelled;
		case "settled":
			return tr.history.settled;
		case "shared":
			return tr.history.shared;
		case "share_withdrawn":
			return tr.history.shareWithdrawn;
		case "invite_expired":
			return tr.history.inviteExpired;
		case "accepted":
			return tr.history.accepted;
		case "countered":
			return tr.history.countered;
		case "rejected":
			return tr.history.rejected;
		case "made_personal":
			return tr.history.madePersonal;
		case "payment_reported":
			return fill(tr.history.paymentReported, { amount: formatTRY(event.amount_minor ?? 0) });
		case "payment_confirmed":
			return fill(tr.history.paymentConfirmed, {
				amount: formatTRY(event.amount_minor ?? 0),
			});
		case "payment_rejected":
			return fill(tr.history.paymentRejected, { amount: formatTRY(event.amount_minor ?? 0) });
		case "amendment_proposed":
			return tr.history.amendmentProposed;
		case "amendment_accepted":
			return tr.history.amendmentAccepted;
		case "amendment_rejected":
			return tr.history.amendmentRejected;
		case "amendment_withdrawn":
			return tr.history.amendmentWithdrawn;
		case "payment_withdrawn":
			return fill(tr.history.paymentWithdrawn, {
				amount: formatTRY(event.amount_minor ?? 0),
			});
		case "dispute_opened":
			return tr.history.disputeOpened;
		case "dispute_resolved":
			return tr.history.disputeResolved;
		case "cancel_requested":
			return tr.history.cancelRequested;
		case "cancel_accepted":
			return tr.history.cancelAccepted;
		case "cancel_rejected":
			return tr.history.cancelRejected;
		case "forgiven":
			return fill(tr.history.forgiven, { amount: formatTRY(event.amount_minor ?? 0) });
	}
}

// S17: the append-only event log, oldest first.
export function HistoryScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const agreement = useAgreement(id);
	return (
		<Screen testID="history.screen" edges={["bottom"]}>
			<ScreenTitle>{tr.history.title}</ScreenTitle>
			{agreement.isPending ? (
				<LoadingState testID="history.loading" />
			) : agreement.isError ? (
				<ErrorState
					message={messageForError(agreement.error)}
					onRetry={() => {
						void agreement.refetch();
					}}
					testID="history.error"
				/>
			) : (
				agreement.data.events.map((event) => (
					<ListItem
						key={event.id}
						title={describe(event)}
						subtitle={`${formatDateTimeTR(event.at)} · ${tr.history.actors[event.actor]}`}
						testID={`history.event.${event.id}`}
					/>
				))
			)}
		</Screen>
	);
}
