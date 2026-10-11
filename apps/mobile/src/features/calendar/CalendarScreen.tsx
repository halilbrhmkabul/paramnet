import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { tr } from "@/i18n/tr";

// Skeleton for F1-05 navigation; the screen content arrives with its own roadmap task.
export function CalendarScreen() {
	return (
		<Screen testID="calendar.screen">
			<ScreenTitle>{tr.tabs.calendar}</ScreenTitle>
		</Screen>
	);
}
