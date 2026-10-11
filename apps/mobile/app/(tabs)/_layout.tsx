import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

import { AddTabButton } from "@/features/navigation/AddTabButton";
import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, color, size }: { name: IconName; color: ColorValue; size: number }) {
	return <Ionicons name={name} color={color} size={size} />;
}

export default function TabsLayout() {
	const { colors } = useAppTheme();
	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarActiveTintColor: colors.primary,
				tabBarInactiveTintColor: colors.textMuted,
				tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: tr.tabs.home,
					tabBarIcon: ({ color, size }) => (
						<TabIcon name="home-outline" color={color} size={size} />
					),
					tabBarButtonTestID: "tabs.home",
				}}
			/>
			<Tabs.Screen
				name="contacts"
				options={{
					title: tr.tabs.contacts,
					tabBarIcon: ({ color, size }) => (
						<TabIcon name="people-outline" color={color} size={size} />
					),
					tabBarButtonTestID: "tabs.contacts",
				}}
			/>
			<Tabs.Screen
				name="add"
				options={{ title: tr.tabs.new, tabBarButton: () => <AddTabButton /> }}
			/>
			<Tabs.Screen
				name="calendar"
				options={{
					title: tr.tabs.calendar,
					tabBarIcon: ({ color, size }) => (
						<TabIcon name="calendar-outline" color={color} size={size} />
					),
					tabBarButtonTestID: "tabs.calendar",
				}}
			/>
			<Tabs.Screen
				name="requests"
				options={{
					title: tr.tabs.requests,
					tabBarIcon: ({ color, size }) => (
						<TabIcon name="file-tray-outline" color={color} size={size} />
					),
					tabBarButtonTestID: "tabs.requests",
				}}
			/>
		</Tabs>
	);
}
