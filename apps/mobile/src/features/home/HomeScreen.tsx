import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { tr } from "@/i18n/tr";

// Skeleton for F1-05 navigation; the screen content arrives with its own roadmap task.
export function HomeScreen() {
	return (
		<Screen testID="home.screen">
			<ScreenTitle>{tr.tabs.home}</ScreenTitle>
		</Screen>
	);
}
