import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { tr } from "@/i18n/tr";

// Skeleton for F1-05 navigation; the screen content arrives with its own roadmap task.
export function ContactsScreen() {
	return (
		<Screen testID="contacts.screen">
			<ScreenTitle>{tr.tabs.contacts}</ScreenTitle>
		</Screen>
	);
}
