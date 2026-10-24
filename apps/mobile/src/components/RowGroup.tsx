import { Ionicons } from "@expo/vector-icons";
import { Children, Fragment, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@/theme/useAppTheme";

// Design ".lbl" above a ".card" of ".row"s with hairline dividers (Profil 04, Menü 05).
export function RowGroup({
	label,
	children,
	testID,
}: {
	label?: string;
	children: ReactNode;
	testID?: string;
}) {
	const { colors, typography, radius, spacing } = useAppTheme();
	const rows = Children.toArray(children);
	return (
		<View testID={testID}>
			{label === undefined ? null : (
				<Text
					accessibilityRole="header"
					style={[
						typography.label,
						{
							color: colors.textMuted,
							paddingHorizontal: spacing.xs,
							paddingBottom: spacing.sm,
						},
					]}
				>
					{label}
				</Text>
			)}
			<View
				style={{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderWidth: 1,
					borderRadius: radius.lg,
				}}
			>
				{rows.map((row, index) => (
					<Fragment key={index}>
						{index > 0 ? (
							<View style={[styles.divider, { backgroundColor: colors.divider }]} />
						) : null}
						{row}
					</Fragment>
				))}
			</View>
		</View>
	);
}

// One ".row": an icon tile, the title, an optional value and a chevron when it opens something.
export function Row({
	title,
	value,
	icon,
	onPress,
	right,
	tone = "text",
	chevron = true,
	testID,
}: {
	title: string;
	value?: string;
	icon?: keyof typeof Ionicons.glyphMap;
	onPress?: () => void;
	right?: ReactNode;
	tone?: "text" | "overdue";
	// Menü's rows have none in the design.
	chevron?: boolean;
	testID: string;
}) {
	const { colors, typography, spacing } = useAppTheme();
	const content = (
		<>
			{icon === undefined ? null : (
				<View style={[styles.icon, { backgroundColor: colors.surfaceSunken }]}>
					<Ionicons name={icon} size={18} color={colors[tone]} />
				</View>
			)}
			<Text style={[typography.rowTitle, styles.title, { color: colors[tone] }]}>
				{title}
			</Text>
			{value === undefined ? null : (
				<Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
					{value}
				</Text>
			)}
			{right}
			{onPress === undefined || right !== undefined || !chevron ? null : (
				<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
			)}
		</>
	);
	const style = [styles.row, { gap: spacing.md, paddingHorizontal: spacing.lg }];
	if (onPress === undefined) {
		return (
			<View testID={testID} style={style}>
				{content}
			</View>
		);
	}
	return (
		<Pressable
			testID={testID}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={value === undefined ? title : `${title}, ${value}`}
			style={({ pressed }) => [style, { opacity: pressed ? 0.7 : 1 }]}
		>
			{content}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", alignItems: "center", minHeight: 60, paddingVertical: 10 },
	divider: { height: 1 },
	icon: {
		width: 36,
		height: 36,
		borderRadius: 11,
		alignItems: "center",
		justifyContent: "center",
	},
	title: { flex: 1 },
});
