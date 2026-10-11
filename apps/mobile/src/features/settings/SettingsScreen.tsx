import { formatPhoneTR } from "@paramnet/shared";
import { useQueryClient } from "@tanstack/react-query";
import { View } from "react-native";

import { useAuthApi } from "@/api/ApiProvider";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ListItem } from "@/components/ListItem";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { Badge } from "@/components/StatusBadge";
import { useSession } from "@/features/auth/sessionStore";
import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

// Items arrive with their roadmap tasks: notifications (F1-18), KVKK texts, export and account deletion (F3-03).
const UPCOMING = [
	{ key: "notifications", label: tr.settings.notifications },
	{ key: "appLock", label: tr.settings.appLock },
	{ key: "export", label: tr.settings.export },
	{ key: "kvkk", label: tr.settings.kvkk },
	{ key: "deleteAccount", label: tr.settings.deleteAccount },
] as const;

// S20 skeleton
export function SettingsScreen() {
	const { spacing } = useAppTheme();
	const auth = useAuthApi();
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
						void auth.signOut().finally(() => {
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
