import { router } from "expo-router";

import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { tr } from "@/i18n/tr";

// S08 skeleton; F1-07 adds the four type cards and the form.
export function NewTypeScreen() {
	return (
		<Screen
			testID="new.screen"
			edges={["top", "bottom"]}
			footer={
				<Button
					label={tr.common.close}
					variant="secondary"
					onPress={() => {
						router.back();
					}}
					testID="new.close.button"
				/>
			}
		>
			<ScreenTitle>{tr.new.title}</ScreenTitle>
		</Screen>
	);
}
