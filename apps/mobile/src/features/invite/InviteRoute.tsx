import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";

import { InviteScreen } from "./InviteScreen";
import { useTrack } from "@/api/hooks";
import { useIsSignedIn, useSession } from "@/features/auth/sessionStore";

// Reachable signed out too: the token is kept in memory, the user signs in, and the app comes back
// here afterwards (deep-links.md "Uygulama yüklü, oturum yok").
export function InviteRoute() {
	const { token } = useLocalSearchParams<{ token: string }>();
	const signedIn = useIsSignedIn();
	const pending = useSession((state) => state.pendingInviteToken);
	const setPendingInvite = useSession((state) => state.setPendingInvite);

	const track = useTrack();

	useEffect(() => {
		if (!signedIn) {
			setPendingInvite(token);
		}
	}, [signedIn, token, setPendingInvite]);

	// Counted once the user is in, so a link opened signed out is counted after sign-in.
	useEffect(() => {
		if (signedIn) {
			track({ name: "invite_opened" });
		}
	}, [signedIn, token, track]);

	if (!signedIn) {
		return pending === token ? <Redirect href="/welcome" /> : null;
	}
	return <InviteScreen token={token} />;
}
