import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router, type Theme } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";

import { ApiProvider, useAuthApi } from "@/api/ApiProvider";
import { useTrack } from "@/api/hooks";
import { useIsSignedIn, useSession } from "@/features/auth/sessionStore";
import { registerDevice } from "@/features/push/device";
import { tr } from "@/i18n/tr";
import { notificationRoute } from "@/features/push/notificationRoute";
import { configureForegroundNotifications, onNotificationOpened } from "@/lib/notifications";
import { initSentry } from "@/lib/sentry";
import { useAppTheme } from "@/theme/useAppTheme";

const detailHeader = { headerShown: true, title: "", headerShadowVisible: false };

initSentry();

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

	// One app_opened per start of a signed-in session (spec 13.3, retention).
	const track = useTrack();
	const counted = useRef(false);
	useEffect(() => {
		if (signedIn && !counted.current) {
			counted.current = true;
			track({ name: "app_opened" });
		}
	}, [signedIn, track]);

	// Refresh this device's push token for the signed-in account (best effort, F1-18).
	useEffect(() => {
		if (signedIn) {
			void registerDevice(auth);
		}
	}, [auth, signedIn]);

	// An invite link opened while signed out continues once the user is in (F2-05).
	const pendingInvite = useSession((state) => state.pendingInviteToken);
	const setPendingInvite = useSession((state) => state.setPendingInvite);
	useEffect(() => {
		if (signedIn && pendingInvite !== null) {
			setPendingInvite(null);
			router.push({ pathname: "/invite/[token]", params: { token: pendingInvite } });
		}
	}, [signedIn, pendingInvite, setPendingInvite]);

	// A new account whose number already has shared plans lands on Talepler (F2-10); an invite link wins.
	const openRequests = useSession((state) => state.openRequestsAfterOnboarding);
	const setOpenRequests = useSession((state) => state.setOpenRequestsAfterOnboarding);
	useEffect(() => {
		if (signedIn && openRequests && pendingInvite === null) {
			setOpenRequests(false);
			router.navigate("/requests");
		}
	}, [signedIn, openRequests, pendingInvite, setOpenRequests]);

	// A tapped reminder opens its agreement (spec 5.9).
	useEffect(() => {
		if (!signedIn) {
			return;
		}
		return onNotificationOpened((agreementId, template) => {
			track({ name: "reminder_opened", template: template ?? "unknown" });
			router.push(notificationRoute(agreementId, template));
		});
	}, [signedIn, track]);

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
				<Stack.Screen name="agreement/[id]/decide" options={detailHeader} />
				<Stack.Screen
					name="agreement/[id]/amend"
					options={{ ...detailHeader, presentation: "modal" }}
				/>
				<Stack.Screen
					name="agreement/[id]/dispute"
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
				<Stack.Screen name="settings/delete" options={detailHeader} />
			</Stack.Protected>
			{/* Open whether signed in or not; the route sends signed-out users through sign-in first. */}
			<Stack.Screen name="invite/[token]" options={detailHeader} />
			<Stack.Protected guard={!signedIn}>
				<Stack.Screen name="(auth)" />
			</Stack.Protected>
			{/* KVKK notice and terms are read before accepting them at sign-up, so they are public. Declared
			last: a signed-out redirect lands on the first open screen, which must be (auth). */}
			<Stack.Screen name="legal/[doc]" options={detailHeader} />
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
