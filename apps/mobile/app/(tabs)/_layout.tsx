import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { View, type ColorValue } from "react-native";

import { AddTabButton } from "@/features/navigation/AddTabButton";
import { tr } from "@/i18n/tr";
import { fonts } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

type IconName = keyof typeof Ionicons.glyphMap;

// The active tab sits in a soft pill (design "Ana Sayfa" tab bar).
function TabIcon({
	name,
	color,
	size,
	focused,
}: {
	name: IconName;
	color: ColorValue;
	size: number;
	focused: boolean;
}) {
	const { colors } = useAppTheme();
	return (
		<View
			style={{
				width: 52,
				height: 30,
				borderRadius: 999,
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: focused ? colors.primarySoft : "transparent",
			}}
		>
			<Ionicons name={name} color={color} size={size - 2} />
		</View>
	);
}

export default function TabsLayout() {
	const { colors } = useAppTheme();
	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarActiveTintColor: colors.primary,
				tabBarInactiveTintColor: colors.tabInactive,
				tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
				tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 11 },
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: tr.tabs.home,
					tabBarIcon: ({ color, size, focused }) => (
						<TabIcon name="home-outline" color={color} size={size} focused={focused} />
					),
					tabBarButtonTestID: "tabs.home",
				}}
			/>
			<Tabs.Screen
				name="debts"
				options={{
					title: tr.tabs.debts,
					tabBarIcon: ({ color, size, focused }) => (
						<TabIcon
							name="swap-horizontal-outline"
							color={color}
							size={size}
							focused={focused}
						/>
					),
					tabBarButtonTestID: "tabs.debts",
				}}
			/>
			<Tabs.Screen
				name="add"
				options={{ title: tr.tabs.new, tabBarButton: () => <AddTabButton /> }}
			/>
			<Tabs.Screen
				name="requests"
				options={{
					title: tr.tabs.requests,
					tabBarIcon: ({ color, size, focused }) => (
						<TabIcon
							name="file-tray-outline"
							color={color}
							size={size}
							focused={focused}
						/>
					),
					tabBarButtonTestID: "tabs.requests",
				}}
			/>
			<Tabs.Screen
				name="calendar"
				options={{
					title: tr.tabs.calendar,
					tabBarIcon: ({ color, size, focused }) => (
						<TabIcon
							name="calendar-outline"
							color={color}
							size={size}
							focused={focused}
						/>
					),
					tabBarButtonTestID: "tabs.calendar",
				}}
			/>
		</Tabs>
	);
}
