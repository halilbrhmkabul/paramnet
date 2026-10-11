import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { tr } from "@/i18n/tr";

// S19: in Faz 1 (personal mode) nothing can be waiting for a decision, so only the empty state exists.
export function RequestsScreen() {
	return (
		<Screen testID="requests.screen">
			<ScreenTitle>{tr.tabs.requests}</ScreenTitle>
			<EmptyState
				title={tr.requests.emptyTitle}
				body={tr.requests.emptyBody}
				testID="requests.empty"
			/>
		</Screen>
	);
}
