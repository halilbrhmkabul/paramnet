import { Stack } from "expo-router";

import { topBarHeader } from "@/components/TopBar";

// Design 23 closes with ×; the plan (24) goes back with ‹.
export default function NewLayout() {
	return (
		<Stack screenOptions={topBarHeader()}>
			<Stack.Screen name="index" options={{ headerShown: false }} />
			<Stack.Screen name="form" options={topBarHeader({ close: true })} />
			<Stack.Screen name="plan" />
		</Stack>
	);
}
