import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router, type Theme } from "expo-router";
// Per-weight imports: the package root would bundle every weight of both families.
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono/500Medium";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { Manrope_800ExtraBold } from "@expo-google-fonts/manrope/800ExtraBold";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";

import { ApiProvider, useAuthApi } from "@/api/ApiProvider";
import { useTrack } from "@/api/hooks";
import { topBarHeader } from "@/components/TopBar";
import { useIsSignedIn, useSession } from "@/features/auth/sessionStore";
import { registerDevice } from "@/features/push/device";
import { tr } from "@/i18n/tr";
import { notificationRoute } from "@/features/push/notificationRoute";
import { configureForegroundNotifications, onNotificationOpened } from "@/lib/notifications";
import { initSentry } from "@/lib/sentry";
import { useAppTheme } from "@/theme/useAppTheme";

// Design ".top" for every pushed screen: back (or close on a modal) and a centred title.
const detailHeader = topBarHeader();

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
				<Stack.Screen
					name="requests"
					options={{ ...detailHeader, title: tr.tabs.notifications }}
				/>
				<Stack.Screen
					name="contacts"
					options={{ ...detailHeader, title: tr.tabs.contacts }}
				/>
				<Stack.Screen name="contact/[id]" options={detailHeader} />
				<Stack.Screen name="me/index" options={{ ...detailHeader, title: tr.me.title }} />
				<Stack.Screen
					name="me/edit"
					options={{
						...detailHeader,
						title: tr.editProfile.title,
						presentation: "modal",
					}}
				/>
				<Stack.Screen
					name="me/discoverability"
					options={{ ...detailHeader, title: tr.discoverability.title }}
				/>
				<Stack.Screen name="me/legal" options={{ ...detailHeader, title: tr.me.legal }} />
				<Stack.Screen name="me/delete" options={detailHeader} />
				{/* F4-03 (ADR-053): own accounts and cash records. */}
				<Stack.Screen
					name="accounts/index"
					options={{ ...detailHeader, title: tr.accounts.title }}
				/>
				<Stack.Screen
					name="accounts/new"
					options={{
						...detailHeader,
						title: tr.accountForm.titleNew,
						presentation: "modal",
					}}
				/>
				<Stack.Screen
					name="accounts/[id]/edit"
					options={{
						...detailHeader,
						title: tr.accountForm.titleEdit,
						presentation: "modal",
					}}
				/>
				<Stack.Screen
					name="accounts/[id]/adjust"
					options={{ ...detailHeader, title: tr.adjust.title, presentation: "modal" }}
				/>
				{/* The form draws its own bar: the Gider / Gelir / Transfer switch sits in it (design 22). */}
				<Stack.Screen name="transaction/new" options={{ presentation: "modal" }} />
				<Stack.Screen name="transaction/[id]/edit" options={{ presentation: "modal" }} />
				<Stack.Screen
					name="transaction/[id]/index"
					options={{ ...detailHeader, title: tr.txDetail.title }}
				/>
				<Stack.Screen
					name="transactions"
					options={{ ...detailHeader, title: tr.txHistory.title }}
				/>
				{/* F4-04 (ADR-054). */}
				<Stack.Screen
					name="recurring/index"
					options={{ ...detailHeader, title: tr.recurring.title }}
				/>
				<Stack.Screen
					name="recurring/new"
					options={{
						...detailHeader,
						title: tr.recurring.formNew,
						presentation: "modal",
					}}
				/>
				<Stack.Screen
					name="recurring/[id]"
					options={{
						...detailHeader,
						title: tr.recurring.formEdit,
						presentation: "modal",
					}}
				/>
				{/* F4-05 (ADR-055). */}
				<Stack.Screen
					name="cards/new"
					options={{
						...detailHeader,
						title: tr.cardForm.titleNew,
						presentation: "modal",
					}}
				/>
				<Stack.Screen name="cards/[id]/index" options={detailHeader} />
				<Stack.Screen
					name="cards/[id]/edit"
					options={{
						...detailHeader,
						title: tr.cardForm.titleEdit,
						presentation: "modal",
					}}
				/>
				<Stack.Screen
					name="cards/[id]/pay"
					options={{ ...detailHeader, title: tr.cardPay.title, presentation: "modal" }}
				/>
				<Stack.Screen name="cards/[id]/paid" options={{ presentation: "modal" }} />
				{/* F4-06 (ADR-056). */}
				<Stack.Screen
					name="loans/index"
					options={{ ...detailHeader, title: tr.loans.title }}
				/>
				<Stack.Screen
					name="loans/new"
					options={{
						...detailHeader,
						title: tr.loanForm.titleNew,
						presentation: "modal",
					}}
				/>
				<Stack.Screen name="loans/[id]/index" options={detailHeader} />
				<Stack.Screen
					name="loans/[id]/edit"
					options={{
						...detailHeader,
						title: tr.loanForm.titleEdit,
						presentation: "modal",
					}}
				/>
				<Stack.Screen
					name="loans/[id]/pay"
					options={{ ...detailHeader, title: tr.loanPay.title, presentation: "modal" }}
				/>
				<Stack.Screen
					name="interest"
					options={{ ...detailHeader, title: tr.interest.title }}
				/>
				{/* F4-08 (ADR-058). */}
				<Stack.Screen
					name="request/index"
					options={{ ...detailHeader, title: tr.request.title, presentation: "modal" }}
				/>
				<Stack.Screen name="request/sent" options={{ presentation: "modal" }} />
				<Stack.Screen
					name="agreement/[id]/delivery"
					options={{ ...detailHeader, title: tr.delivery.title }}
				/>
				{/* F4-11 (ADR-061). */}
				<Stack.Screen
					name="split/index"
					options={{ ...detailHeader, title: tr.split.listTitle }}
				/>
				<Stack.Screen
					name="split/new"
					options={{
						...topBarHeader({ close: true }),
						title: tr.split.createTitle,
						presentation: "modal",
					}}
				/>
				<Stack.Screen
					name="split/[id]/index"
					options={{ ...detailHeader, title: tr.split.detailTitle }}
				/>
				<Stack.Screen
					name="split/[id]/invite"
					options={{ ...detailHeader, title: tr.split.inviteTitle }}
				/>
				<Stack.Screen
					name="split/join/[code]"
					options={{ ...detailHeader, title: tr.split.joinTitle }}
				/>
				<Stack.Screen name="budget" options={detailHeader} />
				<Stack.Screen
					name="reports"
					options={{ ...detailHeader, title: tr.report.title }}
				/>
				{/* Ana menü draws its own header (name, ID and a close button, design 05). */}
				<Stack.Screen name="menu" options={{ presentation: "modal" }} />
				{/* Bildirimler draws its own bar: the "mark all read" action lives in it (design 06). */}
				<Stack.Screen name="inbox" />
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
	// The splash stays up until the fonts are in (no flash of the system font); a font that fails to
	// load falls back to the system font rather than blocking the app.
	const [fontsLoaded, fontError] = useFonts({
		Manrope_500Medium,
		Manrope_600SemiBold,
		Manrope_700Bold,
		Manrope_800ExtraBold,
		IBMPlexMono_500Medium,
	});
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

	if (!fontsLoaded && fontError === null) {
		return null;
	}
	return (
		<ApiProvider>
			<ThemeProvider value={navigationTheme}>
				<AppNavigator />
				<StatusBar style="auto" />
			</ThemeProvider>
		</ApiProvider>
	);
}
