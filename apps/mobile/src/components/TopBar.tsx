import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

// Design ".ib.s": a 44 pt white square with a hairline border.
export function IconButton({
	icon,
	label,
	onPress,
	testID,
	badge,
}: {
	icon: keyof typeof Ionicons.glyphMap;
	label: string;
	onPress: () => void;
	testID?: string;
	badge?: ReactNode;
}) {
	const { colors, sizes } = useAppTheme();
	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			style={({ pressed }) => [
				styles.iconButton,
				{
					width: sizes.iconButton,
					height: sizes.iconButton,
					backgroundColor: colors.surface,
					borderColor: colors.border,
					opacity: pressed ? 0.7 : 1,
				},
			]}
		>
			<Ionicons name={icon} size={21} color={colors.text} />
			{badge}
		</Pressable>
	);
}

// Design ".top": back (or close), a centred 17/800 title, and an optional action on the right.
export function TopBar({
	title,
	onBack,
	close = false,
	right,
}: {
	title: string;
	onBack?: () => void;
	close?: boolean;
	right?: ReactNode;
}) {
	const { colors, typography } = useAppTheme();
	const insets = useSafeAreaInsets();
	return (
		<View style={[styles.bar, { paddingTop: insets.top + 12, backgroundColor: colors.bg }]}>
			{onBack === undefined ? (
				<View style={styles.slot} />
			) : (
				<IconButton
					icon={close ? "close" : "chevron-back"}
					label={close ? tr.common.close : tr.common.back}
					onPress={onBack}
					testID="topbar.back"
				/>
			)}
			<Text
				accessibilityRole="header"
				numberOfLines={1}
				style={[typography.headline, styles.title, { color: colors.text }]}
			>
				{title}
			</Text>
			{right ?? <View style={styles.slot} />}
		</View>
	);
}

type HeaderProps = {
	navigation: { goBack: () => void };
	options: {
		title?: string;
		presentation?: string;
		headerRight?: (props: { canGoBack: boolean }) => ReactNode;
	};
	back?: unknown;
};

// Stack screen options that draw TopBar; a screen sets its title and right action with <Stack.Screen>.
export function topBarHeader({ close }: { close?: boolean } = {}) {
	return {
		headerShown: true,
		title: "",
		header: ({ navigation, options, back }: HeaderProps) => (
			<TopBar
				title={typeof options.title === "string" ? options.title : ""}
				close={close ?? options.presentation === "modal"}
				right={options.headerRight?.({ canGoBack: back !== undefined })}
				onBack={
					back === undefined
						? undefined
						: () => {
								navigation.goBack();
							}
				}
			/>
		),
	};
}

const styles = StyleSheet.create({
	bar: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingHorizontal: 16,
		paddingBottom: 8,
	},
	title: { flex: 1, textAlign: "center" },
	slot: { width: 44 },
	iconButton: {
		alignItems: "center",
		justifyContent: "center",
		borderRadius: 14,
		borderWidth: 1,
	},
});
