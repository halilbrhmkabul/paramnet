import { Tabs } from "expo-router";

import { AppTabBar } from "@/features/navigation/AppTabBar";
import { tr } from "@/i18n/tr";

// Design ".nav": Ana Sayfa · Kartlarım · İşlem · Borçlarım · Takvim (F4-01).
export default function TabsLayout() {
	return (
		<Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <AppTabBar {...props} />}>
			<Tabs.Screen
				name="index"
				options={{ title: tr.tabs.home, tabBarButtonTestID: "tabs.home" }}
			/>
			<Tabs.Screen
				name="cards"
				options={{ title: tr.tabs.cards, tabBarButtonTestID: "tabs.cards" }}
			/>
			<Tabs.Screen name="add" options={{ title: tr.tabs.action }} />
			<Tabs.Screen
				name="debts"
				options={{ title: tr.tabs.debts, tabBarButtonTestID: "tabs.debts" }}
			/>
			<Tabs.Screen
				name="calendar"
				options={{ title: tr.tabs.calendar, tabBarButtonTestID: "tabs.calendar" }}
			/>
		</Tabs>
	);
}
