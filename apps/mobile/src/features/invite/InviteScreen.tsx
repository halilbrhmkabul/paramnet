import { Redirect } from "expo-router";

import { messageForError } from "@/api/errors";
import { useResolveInvite } from "@/api/hooks";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { fill, tr } from "@/i18n/tr";

// deep-links.md "Uygulama tarafı": resolve the token; another number sees nothing of the plan, the
// right account goes to the decision screen (no second OTP: the account's number is verified).
export function InviteScreen({ token }: { token: string }) {
	const invite = useResolveInvite(token);
	if (invite.isPending) {
		return (
			<Screen testID="invite.screen">
				<LoadingState testID="invite.loading" />
			</Screen>
		);
	}
	if (invite.isError) {
		return (
			<Screen testID="invite.screen">
				<ErrorState
					message={messageForError(invite.error)}
					onRetry={() => {
						void invite.refetch();
					}}
					testID="invite.error"
				/>
			</Screen>
		);
	}
	const { status, mismatch, agreement_id: agreementId, creator_name: creatorName } = invite.data;
	if (status === "active" && mismatch !== true && typeof agreementId === "string") {
		return (
			<Redirect href={{ pathname: "/agreement/[id]/decide", params: { id: agreementId } }} />
		);
	}
	return (
		<Screen testID="invite.screen">
			{status === "active" && mismatch === true ? (
				<EmptyState
					title={tr.inviteLink.mismatchTitle}
					body={fill(tr.inviteLink.mismatchBody, { name: creatorName ?? "" })}
					testID="invite.mismatch"
				/>
			) : (
				<EmptyState
					title={tr.inviteLink.invalidTitle}
					body={tr.inviteLink.invalidBody}
					testID="invite.invalid"
				/>
			)}
		</Screen>
	);
}
