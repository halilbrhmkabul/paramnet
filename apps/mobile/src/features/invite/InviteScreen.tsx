import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";

// S14 arrives with F2-06; F2-05 only routes the link here.
export function InviteScreen({ token }: { token: string }) {
	return (
		<Screen testID="invite.screen">
			<LoadingState testID={`invite.loading.${token}`} />
		</Screen>
	);
}
