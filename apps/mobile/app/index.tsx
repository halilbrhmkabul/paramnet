import { Redirect } from "expo-router";

// F1-06 decides between (auth) and (tabs) from the session.
export default function Index() {
	return <Redirect href="/(tabs)" />;
}
