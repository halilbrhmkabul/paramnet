import { Stack } from "expo-router";

// Guards redirect into this group at its initial route, which must be welcome (S01), not the first file.
export const unstable_settings = { initialRouteName: "welcome" };

export default function AuthLayout() {
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="welcome" />
			<Stack.Screen name="phone" />
			<Stack.Screen name="otp" />
			<Stack.Screen name="profile" />
			<Stack.Screen name="notifications" />
		</Stack>
	);
}
