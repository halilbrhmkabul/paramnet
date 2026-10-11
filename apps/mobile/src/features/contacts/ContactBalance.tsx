import { Text, View } from "react-native";

import { AmountText } from "@/components/AmountText";
import type { TypographyToken } from "@/theme/tokens";
import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

// Signed net: + they owe me (green), − I owe them (orange); the label carries the meaning, not the colour.
export function ContactBalance({
	net,
	variant = "headline",
	testID,
}: {
	net: number;
	variant?: TypographyToken;
	testID?: string;
}) {
	const { colors, typography } = useAppTheme();
	const label =
		net > 0 ? tr.agreement.owesYou : net < 0 ? tr.agreement.youOwe : tr.contacts.settledUp;
	return (
		<View style={{ alignItems: "flex-end" }}>
			{net === 0 ? null : (
				<AmountText
					minor={Math.abs(net)}
					variant={variant}
					tone={net > 0 ? "receivable" : "payable"}
					testID={testID}
				/>
			)}
			<Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
		</View>
	);
}
