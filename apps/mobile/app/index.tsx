import { Redirect } from "expo-router";

import { useIsSignedIn } from "@/features/auth/sessionStore";

export default function Index() {
	return <Redirect href={useIsSignedIn() ? "/(tabs)" : "/welcome"} />;
}
