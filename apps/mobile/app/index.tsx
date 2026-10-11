import { Redirect } from "expo-router";

import { useIsSignedIn, useSession } from "@/features/auth/sessionStore";

export default function Index() {
	const signedIn = useIsSignedIn();
	// A verified number without a profile (e.g. restored session) continues at the profile step.
	const needsProfile = useSession((state) => state.user !== null && !state.onboarded);
	return <Redirect href={signedIn ? "/(tabs)" : needsProfile ? "/profile" : "/welcome"} />;
}
