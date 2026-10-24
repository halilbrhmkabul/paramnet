import { Ionicons } from "@expo/vector-icons";
import type { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];
type IconName = keyof typeof Ionicons.glyphMap;

// Design ".nav": five cells; the middle one is the "İşlem" button.
const ICONS: Record<string, IconName> = {
	index: "home-outline",
	cards: "card-outline",
	debts: "swap-horizontal-outline",
	calendar: "calendar-outline",
};

export function AppTabBar({ state, descriptors, navigation, insets }: TabBarProps) {
	const { colors, fonts } = useAppTheme();
	return (
		<View
			style={[
				styles.nav,
				{
					paddingBottom: Math.max(insets.bottom, 8) + 4,
					backgroundColor: colors.surface,
					borderTopColor: colors.border,
				},
			]}
		>
			{state.routes.map((route, index) => {
				const focused = state.index === index;
				const options = descriptors[route.key]?.options;
				const label = typeof options?.title === "string" ? options.title : route.name;
				// Design 21: İşlem merkezi is a tab of its own; focused, the button gets the ring of ".nv.on .fab".
				if (route.name === "add") {
					return (
						<Pressable
							key={route.key}
							testID="tabs.new.button"
							accessibilityRole="tab"
							accessibilityState={{ selected: focused }}
							accessibilityLabel={tr.tabs.action}
							onPress={() => {
								if (!focused) {
									navigation.navigate(route.name);
								}
							}}
							style={styles.cell}
						>
							<View
								style={[
									styles.fab,
									{ backgroundColor: focused ? colors.accent : colors.primary },
									focused
										? { borderWidth: 4, borderColor: colors.primarySoft }
										: null,
								]}
							>
								<Ionicons name="add" size={22} color={colors.onPrimary} />
							</View>
							<Text
								style={{
									fontFamily: focused ? fonts.extrabold : fonts.semibold,
									fontSize: 11,
									color: focused ? colors.primary : colors.tabInactive,
								}}
							>
								{tr.tabs.action}
							</Text>
						</Pressable>
					);
				}
				const color = focused ? colors.primary : colors.tabInactive;
				return (
					<Pressable
						key={route.key}
						testID={options?.tabBarButtonTestID}
						accessibilityRole="tab"
						accessibilityState={{ selected: focused }}
						accessibilityLabel={label}
						onPress={() => {
							const event = navigation.emit({
								type: "tabPress",
								target: route.key,
								canPreventDefault: true,
							});
							if (!focused && !event.defaultPrevented) {
								navigation.navigate(route.name);
							}
						}}
						style={styles.cell}
					>
						<View
							style={[
								styles.pill,
								{ backgroundColor: focused ? colors.primarySoft : "transparent" },
							]}
						>
							<Ionicons
								name={ICONS[route.name] ?? "ellipse-outline"}
								size={22}
								color={color}
							/>
						</View>
						<Text
							style={{
								fontFamily: focused ? fonts.extrabold : fonts.semibold,
								fontSize: 11,
								color,
							}}
						>
							{label}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	nav: { flexDirection: "row", paddingTop: 8, paddingHorizontal: 8, borderTopWidth: 1 },
	cell: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, minHeight: 52 },
	pill: {
		width: 52,
		height: 30,
		borderRadius: 999,
		alignItems: "center",
		justifyContent: "center",
	},
	fab: {
		width: 48,
		height: 36,
		borderRadius: 13,
		alignItems: "center",
		justifyContent: "center",
	},
});
