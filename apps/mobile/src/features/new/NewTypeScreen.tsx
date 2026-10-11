import { router } from "expo-router";
import { Text } from "react-native";

import { useNewDraft } from "./draftStore";
import type { NewType } from "./formModel";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

const TYPES: { type: NewType; title: string; hint: string }[] = [
	{ type: "lent", title: tr.new.lent, hint: tr.new.lentHint },
	{ type: "borrowed", title: tr.new.borrowed, hint: tr.new.borrowedHint },
	{
		type: "boughtInstallment",
		title: tr.new.boughtInstallment,
		hint: tr.new.boughtInstallmentHint,
	},
	{ type: "soldInstallment", title: tr.new.soldInstallment, hint: tr.new.soldInstallmentHint },
];

// S08: choosing first keeps the form to only the fields that type needs (spec 5.2).
export function NewTypeScreen() {
	const { colors, typography } = useAppTheme();
	const start = useNewDraft((state) => state.start);
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
			{TYPES.map(({ type, title, hint }) => (
				<Card
					key={type}
					testID={`new.type.${type}`}
					accessibilityLabel={title}
					onPress={() => {
						start(type);
						router.push("/new/form");
					}}
				>
					<Text style={[typography.headline, { color: colors.text }]}>{title}</Text>
					<Text style={[typography.caption, { color: colors.textMuted }]}>{hint}</Text>
				</Card>
			))}
		</Screen>
	);
}
