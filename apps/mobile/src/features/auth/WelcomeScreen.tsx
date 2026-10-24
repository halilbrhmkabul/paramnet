import { Ionicons } from "@expo/vector-icons";
import { formatTRY } from "@paramnet/shared";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AmountText } from "@/components/AmountText";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

const POINT_ICONS = ["calendar-outline", "swap-horizontal-outline"] as const;

// Sample figures of the decorative card (design 01); not anyone's data.
const SAMPLE = { cash: 2_834_000, debt: 1_683_300, receivable: 525_000 };

// S01, design 01: dark forest welcome with a stack of cards, two promises and the two entry points.
export function WelcomeScreen() {
	const { colors, typography, radius, sizes, spacing, fonts } = useAppTheme();

	return (
		<SafeAreaView
			testID="welcome.screen"
			edges={["top", "bottom"]}
			style={{ flex: 1, backgroundColor: colors.heroBg }}
		>
			<ScrollView
				contentContainerStyle={[styles.content, { paddingHorizontal: spacing.xl }]}
				bounces={false}
			>
				<View
					style={styles.stack}
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
				>
					<View
						style={[
							styles.ghost,
							{
								top: 70,
								right: -70,
								borderColor: colors.heroGlow,
								opacity: 0.6,
								transform: [{ rotate: "-14deg" }],
							},
						]}
					/>
					<View
						style={[
							styles.ghost,
							{
								top: 110,
								right: -40,
								borderColor: colors.heroGlow,
								transform: [{ rotate: "-7deg" }],
							},
						]}
					/>
					<View
						style={[
							styles.ghost,
							styles.card,
							{
								top: 150,
								right: -10,
								backgroundColor: colors.heroCard,
								borderColor: colors.heroGlow,
							},
						]}
					>
						<Text style={[typography.caption, { color: colors.heroSoft }]}>
							{tr.welcome.previewLabel}
						</Text>
						<AmountText minor={SAMPLE.cash} variant="amountL" tone="heroText" />
						<View style={[styles.chips, { gap: spacing.sm }]}>
							<Text
								style={[
									typography.micro,
									styles.chip,
									{ color: colors.heroText, backgroundColor: colors.heroChip },
								]}
							>
								{fill(tr.welcome.previewDebt, { amount: formatTRY(SAMPLE.debt) })}
							</Text>
							<Text
								style={[
									typography.micro,
									styles.chip,
									{ color: colors.heroAccent, backgroundColor: colors.heroChip },
								]}
							>
								{fill(tr.welcome.previewReceivable, {
									amount: formatTRY(SAMPLE.receivable),
								})}
							</Text>
						</View>
					</View>
				</View>

				<View
					testID="welcome.brand"
					accessibilityRole="header"
					accessibilityLabel={tr.common.appName}
					style={[styles.brand, { gap: 10 }]}
				>
					<View style={[styles.mark, { backgroundColor: colors.heroAccent }]}>
						<Ionicons name="leaf-outline" size={20} color={colors.onHeroAccent} />
					</View>
					<Text
						style={{
							fontFamily: fonts.extrabold,
							fontSize: 20,
							color: colors.heroText,
						}}
					>
						{tr.brand.first}
						<Text style={{ fontFamily: fonts.medium, color: colors.heroAccent }}>
							{tr.brand.second}
						</Text>
					</Text>
				</View>

				<View style={styles.copy}>
					<Text
						accessibilityRole="header"
						style={[
							styles.title,
							{ fontFamily: fonts.extrabold, color: colors.heroText },
						]}
					>
						{tr.welcome.title}
					</Text>
					<View style={{ gap: 14, marginTop: spacing.xl }}>
						{tr.welcome.points.map((point, index) => (
							<View key={point.title} style={styles.point}>
								<View
									style={[styles.pointIcon, { backgroundColor: colors.heroChip }]}
								>
									<Ionicons
										name={POINT_ICONS[index] ?? "calendar-outline"}
										size={18}
										color={colors.heroAccent}
									/>
								</View>
								<View style={styles.pointText}>
									<Text style={[typography.rowTitle, { color: colors.heroText }]}>
										{point.title}
									</Text>
									<Text
										style={[
											typography.caption,
											{ color: colors.heroSoft, marginTop: 2 },
										]}
									>
										{point.body}
									</Text>
								</View>
							</View>
						))}
					</View>
				</View>

				<View style={[styles.actions, { gap: 10, paddingTop: spacing.xxl }]}>
					<Pressable
						testID="welcome.create.button"
						accessibilityRole="button"
						accessibilityLabel={tr.welcome.create}
						onPress={() => {
							router.push("/onboarding");
						}}
						style={({ pressed }) => [
							styles.button,
							{
								minHeight: sizes.buttonPrimary,
								borderRadius: radius.md,
								backgroundColor: colors.heroAccent,
								opacity: pressed ? 0.8 : 1,
							},
						]}
					>
						<Text style={[typography.button, { color: colors.onHeroAccent }]}>
							{tr.welcome.create}
						</Text>
					</Pressable>
					<Pressable
						testID="welcome.signIn.button"
						accessibilityRole="button"
						accessibilityLabel={tr.welcome.signIn}
						onPress={() => {
							router.push({ pathname: "/login", params: { mode: "signin" } });
						}}
						style={({ pressed }) => [
							styles.button,
							{
								minHeight: sizes.buttonPrimary,
								borderRadius: radius.md,
								borderWidth: 1,
								borderColor: colors.heroLine,
								opacity: pressed ? 0.8 : 1,
							},
						]}
					>
						<Text style={[typography.button, { color: colors.heroText }]}>
							{tr.welcome.signIn}
						</Text>
					</Pressable>
					<Text
						style={[typography.caption, styles.disclaimer, { color: colors.heroMuted }]}
					>
						{tr.welcome.disclaimer}
					</Text>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	content: { flexGrow: 1, paddingTop: 28, paddingBottom: 40 },
	stack: { ...StyleSheet.absoluteFill },
	ghost: { position: "absolute", width: 300, height: 190, borderRadius: 24, borderWidth: 1 },
	card: { padding: 20, gap: 2 },
	chips: { flexDirection: "row", marginTop: "auto" },
	chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: "hidden" },
	brand: { flexDirection: "row", alignItems: "center" },
	mark: {
		width: 34,
		height: 34,
		borderRadius: 10,
		alignItems: "center",
		justifyContent: "center",
	},
	copy: { marginTop: 330 },
	title: { fontSize: 30, lineHeight: 35, letterSpacing: -0.75 },
	point: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
	pointIcon: {
		width: 36,
		height: 36,
		borderRadius: 11,
		alignItems: "center",
		justifyContent: "center",
	},
	pointText: { flex: 1 },
	actions: { marginTop: "auto" },
	button: { alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
	disclaimer: { textAlign: "center", marginTop: 6, fontSize: 12 },
});
