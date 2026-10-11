import { StyleSheet, Text, View } from "react-native";

import { Button } from "./Button";
import { useAppTheme } from "@/theme/useAppTheme";

export type EmptyStateProps = {
	title: string;
	body?: string;
	actionLabel?: string;
	onAction?: () => void;
	actionTestID?: string;
	testID: string;
};

export function EmptyState({
	title,
	body,
	actionLabel,
	onAction,
	actionTestID,
	testID,
}: EmptyStateProps) {
	const { colors, typography, spacing } = useAppTheme();
	return (
		<View testID={testID} style={[styles.container, { gap: spacing.md, padding: spacing.xl }]}>
			<Text
				accessibilityRole="header"
				style={[typography.headline, styles.center, { color: colors.text }]}
			>
				{title}
			</Text>
			{body !== undefined ? (
				<Text style={[typography.body, styles.center, { color: colors.textMuted }]}>
					{body}
				</Text>
			) : null}
			{actionLabel !== undefined && onAction !== undefined ? (
				<Button
					label={actionLabel}
					onPress={onAction}
					testID={actionTestID ?? `${testID}.action.button`}
				/>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		alignItems: "stretch",
		justifyContent: "center",
	},
	center: {
		textAlign: "center",
	},
});
