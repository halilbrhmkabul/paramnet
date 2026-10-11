import { Stack } from "expo-router";

export default function NewLayout() {
	return (
		<Stack screenOptions={{ headerShown: true, title: "", headerShadowVisible: false }}>
			<Stack.Screen name="index" options={{ headerShown: false }} />
			<Stack.Screen name="form" />
			<Stack.Screen name="plan" />
		</Stack>
	);
}
