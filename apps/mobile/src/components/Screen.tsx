import type { ReactNode } from "react";
import { ScrollView, View, type RefreshControlProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { useAppTheme } from "@/theme/useAppTheme";

export type ScreenProps = {
	children: ReactNode;
	scroll?: boolean;
	edges?: Edge[];
	refreshControl?: React.ReactElement<RefreshControlProps>;
	footer?: ReactNode;
	testID?: string;
};

export function Screen({
	children,
	scroll = true,
	edges = ["top"],
	refreshControl,
	footer,
	testID,
}: ScreenProps) {
	const { colors, sizes, spacing } = useAppTheme();
	const padding = {
		paddingHorizontal: sizes.screenPadding,
		paddingVertical: spacing.lg,
		gap: spacing.lg,
	};
	return (
		<SafeAreaView testID={testID} edges={edges} style={{ flex: 1, backgroundColor: colors.bg }}>
			{scroll ? (
				<ScrollView
					contentContainerStyle={padding}
					refreshControl={refreshControl}
					keyboardShouldPersistTaps="handled"
				>
					{children}
				</ScrollView>
			) : (
				<View style={[{ flex: 1 }, padding]}>{children}</View>
			)}
			{footer !== undefined ? (
				<View style={{ paddingHorizontal: sizes.screenPadding, paddingBottom: spacing.lg }}>
					{footer}
				</View>
			) : null}
		</SafeAreaView>
	);
}
