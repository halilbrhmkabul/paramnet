import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { useAppTheme } from "@/theme/useAppTheme";

// Design "kv": a label and its value on one line.
export function KeyValue({
	label,
	value,
	testID,
}: {
	label: string;
	// A badge or other node instead of text, e.g. the record's status.
	value: ReactNode;
	testID?: string;
}) {
	const { colors, typography, spacing } = useAppTheme();
	return (
		<View style={[styles.rowBetween, styles.kv, { gap: spacing.md }]}>
			<Text style={[typography.callout, { color: colors.textMuted }]}>{label}</Text>
			{typeof value === "string" ? (
				<Text
					testID={testID}
					style={[typography.rowTitle, styles.end, { color: colors.text }]}
					numberOfLines={2}
				>
					{value}
				</Text>
			) : (
				value
			)}
		</View>
	);
}

// Rows inside one card, separated by hairlines (design "card" + "row+row").
export function Rows({ children }: { children: ReactNode[] }) {
	const { colors } = useAppTheme();
	return (
		<Card style={{ paddingVertical: 0 }}>
			{children.map((child, index) => (
				<View
					key={index}
					style={
						index === 0
							? undefined
							: { borderTopWidth: 1, borderTopColor: colors.divider }
					}
				>
					{child}
				</View>
			))}
		</Card>
	);
}

const styles = StyleSheet.create({
	rowBetween: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		gap: 8,
	},
	kv: { minHeight: 48, paddingVertical: 12 },
	end: { flexShrink: 1, textAlign: "right" },
});
