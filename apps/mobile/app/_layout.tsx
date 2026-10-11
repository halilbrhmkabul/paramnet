import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router, type Theme } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { ApiProvider, useAuthApi } from "@/api/ApiProvider";
import { useIsSignedIn, useSession } from "@/features/auth/sessionStore";
import { registerDevice } from "@/features/push/device";
import { tr } from "@/i18n/tr";
import { configureForegroundNotifications, onNotificationOpened } from "@/lib/notifications";
import { useAppTheme } from "@/theme/useAppTheme";

const detailHeader = { headerShown: true, title: "", headerShadowVisible: false };

// Keep the native splash until the stored session has been checked (no flash of the welcome screen).
void SplashScreen.preventAutoHideAsync();
configureForegroundNotifications();

function AppNavigator() {
	const auth = useAuthApi();
	const signedIn = useIsSignedIn();
	const restored = useSession((state) => state.restored);
	const finishRestore = useSession((state) => state.finishRestore);

	useEffect(() => {
		if (restored) {
			return;
		}
		// A broken stored session just means signing in again.
		void auth
			.restore()
			.catch(() => null)
			.then(finishRestore)
			.finally(() => {
				void SplashScreen.hideAsync();
			});
	}, [auth, restored, finishRestore]);

	// Refresh this device's push token for the signed-in account (best effort, F1-18).
	useEffect(() => {
		if (signedIn) {
			void registerDevice(auth);
		}
	}, [auth, signedIn]);

	// A tapped reminder opens its agreement (spec 5.9).
	useEffect(() => {
		if (!signedIn) {
			return;
		}
		return onNotificationOpened((agreementId) => {
			router.push({ pathname: "/agreement/[id]", params: { id: agreementId } });
		});
	}, [signedIn]);

	if (!restored) {
		return null;
	}
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Protected guard={signedIn}>
				<Stack.Screen name="(tabs)" />
				<Stack.Screen name="new" options={{ presentation: "modal" }} />
				<Stack.Screen name="agreement/[id]/index" options={detailHeader} />
				<Stack.Screen
					name="agreement/[id]/payment"
					options={{ ...detailHeader, presentation: "modal" }}
				/>
				<Stack.Screen name="agreement/[id]/history" options={detailHeader} />
				<Stack.Screen
					name="agreement/[id]/share"
					options={{ ...detailHeader, presentation: "modal" }}
				/>
				<Stack.Screen name="agreement/[id]/invite-preview" options={detailHeader} />
				<Stack.Screen name="contact/[id]" options={detailHeader} />
				<Stack.Screen
					name="settings/index"
					options={{ ...detailHeader, title: tr.settings.title }}
				/>
			</Stack.Protected>
			<Stack.Protected guard={!signedIn}>
				<Stack.Screen name="(auth)" />
			</Stack.Protected>
		</Stack>
	);
}

export default function RootLayout() {
	const { scheme, colors } = useAppTheme();
	const base = scheme === "dark" ? DarkTheme : DefaultTheme;
	const navigationTheme: Theme = {
		...base,
		colors: {
			...base.colors,
			primary: colors.primary,
			background: colors.bg,
			card: colors.bg,
			text: colors.text,
			border: colors.border,
		},
	};

	return (
		<ApiProvider>
			<ThemeProvider value={navigationTheme}>
				<AppNavigator />
				<StatusBar style="auto" />
			</ThemeProvider>
		</ApiProvider>
	);
}
