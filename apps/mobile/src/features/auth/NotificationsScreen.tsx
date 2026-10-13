import { useState } from "react";
import { Text, View } from "react-native";

import { useSession } from "./sessionStore";
import { Icon } from "@/components/Icon";
import { useAuthApi } from "@/api/ApiProvider";
import { registerDevice } from "@/features/push/device";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { tr } from "@/i18n/tr";
import { requestNotificationPermission } from "@/lib/notifications";
import { useAppTheme } from "@/theme/useAppTheme";

// S04 part 2: the reason is shown before the system prompt (spec 5.1 step 5).
// Finishing onboarding flips the route guard; the root index then opens the tabs.
export function NotificationsScreen() {
	const { colors, typography, spacing } = useAppTheme();
	const completeOnboarding = useSession((state) => state.completeOnboarding);
	const auth = useAuthApi();
	const [asking, setAsking] = useState(false);

	return (
		<Screen
			testID="notifications.screen"
			edges={["top", "bottom"]}
			footer={
				<View style={{ gap: spacing.sm }}>
					<Button
						label={tr.profile.notificationsAllow}
						loading={asking}
						onPress={() => {
							setAsking(true);
							void requestNotificationPermission()
								.then((permission) =>
									permission === "granted" ? registerDevice(auth) : undefined,
								)
								.finally(() => {
									completeOnboarding();
								});
						}}
						testID="notifications.allow.button"
					/>
					<Button
						label={tr.profile.notificationsLater}
						variant="ghost"
						onPress={completeOnboarding}
						testID="notifications.later.button"
					/>
				</View>
			}
		>
			<Icon name="bell" size={48} tone="primary" strokeWidth={1.6} />
			<ScreenTitle>{tr.profile.notificationsTitle}</ScreenTitle>
			<Text style={[typography.body, { color: colors.textMuted }]}>
				{tr.profile.notificationsReason}
			</Text>
		</Screen>
	);
}
