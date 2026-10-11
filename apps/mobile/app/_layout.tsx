import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { ApiProvider } from "@/api/ApiProvider";
import { useIsSignedIn } from "@/features/auth/sessionStore";
import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

const detailHeader = { headerShown: true, title: "", headerShadowVisible: false };

export default function RootLayout() {
	const { scheme, colors } = useAppTheme();
	const signedIn = useIsSignedIn();
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
				<StatusBar style="auto" />
			</ThemeProvider>
		</ApiProvider>
	);
}
