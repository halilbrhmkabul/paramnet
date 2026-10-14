import { Redirect } from "expo-router";

import { useIsSignedIn, useSession } from "@/features/auth/sessionStore";

export default function Index() {
	const signedIn = useIsSignedIn();
	// A verified number with a setup step open (e.g. restored session) continues there: PIN, then profile.
	const needsPin = useSession((state) => state.user !== null && state.pinRequired);
	const needsProfile = useSession((state) => state.user !== null && !state.onboarded);
	return (
		<Redirect
			href={signedIn ? "/(tabs)" : needsPin ? "/pin" : needsProfile ? "/profile" : "/welcome"}
		/>
	);
}
