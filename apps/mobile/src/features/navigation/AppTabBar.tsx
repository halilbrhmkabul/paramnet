import type { Tabs } from "expo-router";
import { router } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/Icon";
import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

export type TabName = "index" | "cards" | "debts" | "calendar";

// Design ".nav": five cells; the middle one is the "İşlem" button that opens a new record.
const TABS: { name: TabName; label: string; icon: IconName; strokeWidth: number }[] = [
	{ name: "index", label: tr.tabs.home, icon: "home", strokeWidth: 1.9 },
	{ name: "cards", label: tr.tabs.cards, icon: "card", strokeWidth: 1.8 },
	{ name: "debts", label: tr.tabs.debts, icon: "swap", strokeWidth: 1.8 },
	{ name: "calendar", label: tr.tabs.calendar, icon: "calendar", strokeWidth: 1.8 },
];

const TAB_PATHS = {
	index: "/",
	cards: "/cards",
	debts: "/debts",
	calendar: "/calendar",
} as const;

function TabBarView({
	active,
	bottomInset,
	onTab,
	idPrefix,
}: {
	active: TabName | null;
	bottomInset: number;
	onTab: (name: TabName) => void;
	// The tab screen stays mounted under a detail, so the detail's copy needs its own test ids.
	idPrefix: string;
}) {
	const { colors, fonts } = useAppTheme();
	const cell = (tab: (typeof TABS)[number]) => {
		const focused = active === tab.name;
		const color = focused ? colors.primary : colors.tabInactive;
		return (
			<Pressable
				key={tab.name}
				testID={`${idPrefix}.${tab.name === "index" ? "home" : tab.name}`}
				accessibilityRole="tab"
				accessibilityState={{ selected: focused }}
				accessibilityLabel={tab.label}
				onPress={() => {
					onTab(tab.name);
				}}
				style={styles.cell}
			>
				<View
					style={[
						styles.pill,
						{ backgroundColor: focused ? colors.primarySoft : "transparent" },
					]}
				>
					<Icon
						name={tab.icon}
						size={22}
						tone={focused ? "primary" : "tabInactive"}
						strokeWidth={tab.strokeWidth}
					/>
				</View>
				<Text
					style={{
						fontFamily: focused ? fonts.extrabold : fonts.semibold,
						fontSize: 11,
						color,
					}}
				>
					{tab.label}
				</Text>
			</Pressable>
		);
	};
	return (
		<View
			style={[
				styles.nav,
				{
					paddingBottom: Math.max(bottomInset, 8) + 4,
					backgroundColor: colors.surface,
					borderTopColor: colors.border,
				},
			]}
		>
			{TABS.slice(0, 2).map(cell)}
			<Pressable
				testID={`${idPrefix}.new.button`}
				accessibilityRole="button"
				accessibilityLabel={tr.tabs.new}
				onPress={() => {
					router.push("/new");
				}}
				style={styles.cell}
			>
				<View style={[styles.fab, { backgroundColor: colors.primary }]}>
					<Icon name="plus" size={22} tone="onPrimary" strokeWidth={2.2} />
				</View>
				<Text
					style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.tabInactive }}
				>
					{tr.tabs.action}
				</Text>
			</Pressable>
			{TABS.slice(2).map(cell)}
		</View>
	);
}

export function AppTabBar({ state, navigation, insets }: TabBarProps) {
	const current = state.routes[state.index];
	const active: TabName | null = TABS.find((tab) => tab.name === current?.name)?.name ?? null;
	return (
		<TabBarView
			active={active}
			bottomInset={insets.bottom}
			idPrefix="tabs"
			onTab={(name) => {
				const route = state.routes.find((r) => r.name === name);
				if (route === undefined) {
					return;
				}
				const event = navigation.emit({
					type: "tabPress",
					target: route.key,
					canPreventDefault: true,
				});
				if (active !== name && !event.defaultPrevented) {
					navigation.navigate(name);
				}
			}}
		/>
	);
}

// The same bar under a pushed detail screen (design 13, 15, 25 keep the menu visible).
// A tap leaves the detail and lands on that tab.
export function DetailTabBar({ active }: { active: TabName }) {
	const insets = useSafeAreaInsets();
	return (
		<TabBarView
			active={active}
			bottomInset={insets.bottom}
			idPrefix="detailTabs"
			onTab={(name) => {
				if (router.canDismiss()) {
					router.dismissAll();
				}
				router.navigate(TAB_PATHS[name]);
			}}
		/>
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
