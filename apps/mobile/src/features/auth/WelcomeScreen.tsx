import { router } from "expo-router";
import { Text } from "react-native";

import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

// S01 skeleton; F1-06 adds the intro cards and the phone/OTP flow.
export function WelcomeScreen() {
	const { colors, typography } = useAppTheme();
	return (
		<Screen
			testID="welcome.screen"
			footer={
				<Button
					label={tr.welcome.cta}
					onPress={() => {
						router.replace("/(tabs)");
					}}
					testID="welcome.start.button"
				/>
			}
		>
			<Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
				{tr.welcome.title}
			</Text>
			<Text style={[typography.body, { color: colors.textMuted }]}>
				{tr.welcome.subtitle}
			</Text>
		</Screen>
	);
}
