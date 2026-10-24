import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/theme/useAppTheme";

// Design ".chip": a pill filter (Bildirimler 06, İşlem geçmişi 36) or a choice (kategori, 22).
export function Chip({
	label,
	count = null,
	selected,
	onPress,
	role = "tab",
	testID,
}: {
	label: string;
	count?: number | null;
	selected: boolean;
	onPress: () => void;
	role?: "tab" | "radio";
	testID: string;
}) {
	const { colors, typography, fonts, radius } = useAppTheme();
	return (
		<Pressable
			testID={testID}
			accessibilityRole={role}
			accessibilityLabel={count === null ? label : `${label}, ${String(count)}`}
			accessibilityState={role === "tab" ? { selected } : { checked: selected }}
			onPress={onPress}
			style={[
				styles.chip,
				{
					borderRadius: radius.pill,
					backgroundColor: selected ? colors.primary : colors.surface,
					borderColor: selected ? colors.primary : colors.borderStrong,
				},
			]}
		>
			<Text
				style={[
					typography.label,
					{ fontSize: 14, color: selected ? colors.onPrimary : colors.textMuted },
				]}
			>
				{label}
			</Text>
			{count === null ? null : (
				<View style={[styles.count, { backgroundColor: colors.primarySoft }]}>
					<Text
						style={{ fontFamily: fonts.extrabold, fontSize: 11, color: colors.primary }}
					>
						{String(count)}
					</Text>
				</View>
			)}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	chip: {
		minHeight: 44,
		paddingHorizontal: 14,
		borderWidth: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	count: {
		minWidth: 20,
		height: 20,
		borderRadius: 10,
		paddingHorizontal: 5,
		alignItems: "center",
		justifyContent: "center",
	},
});
