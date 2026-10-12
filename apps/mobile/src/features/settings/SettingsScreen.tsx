import { formatPhoneTR } from "@paramnet/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Share, Text, View } from "react-native";

import { useApi, useAuthApi } from "@/api/ApiProvider";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ListItem } from "@/components/ListItem";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { Badge } from "@/components/StatusBadge";
import { useSession } from "@/features/auth/sessionStore";
import { unregisterDevice } from "@/features/push/device";
import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

// Not built yet: per-agreement notification preferences and the app lock (BACKLOG).
const UPCOMING = [
	{ key: "notifications", label: tr.settings.notifications },
	{ key: "appLock", label: tr.settings.appLock },
] as const;

// S20
export function SettingsScreen() {
	const { colors, spacing, typography } = useAppTheme();
	const auth = useAuthApi();
	const api = useApi();
	// KVKK m.11: the data goes out through the system share sheet (save to Files, mail it, ...).
	const exportData = useMutation({
		mutationFn: async () => {
			const data = await api.exportMyData();
			await Share.share({
				title: tr.settings.exportTitle,
				message: JSON.stringify(data, null, 2),
			});
		},
	});
	const user = useSession((state) => state.user);
	const signOut = useSession((state) => state.signOut);
	const queryClient = useQueryClient();

	return (
		<Screen
			testID="settings.screen"
			edges={["bottom"]}
			footer={
				<Button
					label={tr.settings.signOut}
					variant="secondary"
					onPress={() => {
						// The local session ends even if the server call fails; there is nothing to keep.
						// Flipping the session guard takes the user back to welcome.
						void unregisterDevice(auth)
							.then(() => auth.signOut())
							.finally(() => {
								// The next person on this device must not see the previous account's data.
								queryClient.clear();
								signOut();
							});
					}}
					testID="settings.signOut.button"
				/>
			}
		>
			<Card>
				<ScreenTitle testID="settings.name.text">{user?.display_name ?? ""}</ScreenTitle>
				<ListItem
					title={tr.settings.phone}
					subtitle={user === null ? undefined : formatPhoneTR(user.phone_e164)}
					testID="settings.phone"
				/>
			</Card>
			<View style={{ gap: spacing.xs }}>
				<ListItem
					title={tr.settings.export}
					onPress={() => {
						exportData.mutate();
					}}
					right={
						exportData.isPending ? (
							<Badge label={tr.common.loading} tone="textMuted" />
						) : undefined
					}
					testID="settings.export.item"
				/>
				{exportData.isError ? (
					<Text style={[typography.callout, { color: colors.overdue }]}>
						{tr.settings.exportFailed}
					</Text>
				) : null}
				<ListItem
					title={tr.settings.kvkk}
					onPress={() => {
						router.push({ pathname: "/legal/[doc]", params: { doc: "kvkk" } });
					}}
					testID="settings.kvkk.item"
				/>
				<ListItem
					title={tr.settings.terms}
					onPress={() => {
						router.push({ pathname: "/legal/[doc]", params: { doc: "terms" } });
					}}
					testID="settings.terms.item"
				/>
				<ListItem
					title={tr.settings.deleteAccount}
					onPress={() => {
						router.push("/settings/delete");
					}}
					testID="settings.deleteAccount.item"
				/>
				{UPCOMING.map(({ key, label }) => (
					<ListItem
						key={key}
						title={label}
						right={<Badge label={tr.settings.comingSoon} tone="textMuted" />}
						testID={`settings.${key}.item`}
					/>
				))}
			</View>
		</Screen>
	);
}
