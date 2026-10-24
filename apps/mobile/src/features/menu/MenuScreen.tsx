import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { useAgreements, useMyProfile } from "@/api/hooks";
import type { AgreementSummary } from "@/api/types";
import { Avatar } from "@/components/Avatar";
import { Row, RowGroup } from "@/components/RowGroup";
import { Screen } from "@/components/Screen";
import { IconButton } from "@/components/TopBar";
import { useSession } from "@/features/auth/sessionStore";
import { useMyAvatar } from "@/features/me/useMyAvatar";
import { fill, tr } from "@/i18n/tr";
import { supportEmail } from "@/lib/config";
import { useAppTheme } from "@/theme/useAppTheme";

const CLOSED: readonly AgreementSummary["status"][] = ["settled", "cancelled", "rejected"];

function Header() {
	const { colors, fonts, spacing } = useAppTheme();
	const profile = useMyProfile();
	const sessionName = useSession((state) => state.user?.display_name ?? "");
	const name = profile.data?.display_name ?? sessionName;
	const avatar = useMyAvatar(profile.data);
	return (
		<View style={[styles.header, { gap: spacing.md }]}>
			<Pressable
				testID="menu.profile.button"
				accessibilityRole="button"
				accessibilityLabel={`${tr.menu.openProfile}, ${name}`}
				onPress={() => {
					router.push("/me");
				}}
				style={[styles.header, styles.grow, { gap: spacing.md }]}
			>
				<Avatar name={name === "" ? "?" : name} size={44} uri={avatar} />
				<View style={styles.grow}>
					<Text
						numberOfLines={1}
						style={{ fontFamily: fonts.extrabold, fontSize: 16, color: colors.text }}
					>
						{name}
					</Text>
					{profile.data === undefined ? null : (
						<Text
							testID="menu.paramnetId.text"
							style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.accent }}
						>
							{profile.data.paramnet_id}
						</Text>
					)}
				</View>
			</Pressable>
			<IconButton
				icon="close"
				label={tr.menu.close}
				onPress={() => {
					router.back();
				}}
				testID="menu.close.button"
			/>
		</View>
	);
}

// Design ".tile": an icon chip, the module's name and one line about it.
function InstallmentsTile() {
	const { colors, typography, fonts, radius } = useAppTheme();
	const agreements = useAgreements();
	const active = (agreements.data ?? []).filter(
		(a) => a.kind === "installment_purchase" && !CLOSED.includes(a.status),
	).length;
	const line =
		active === 0 ? tr.menu.noPlans : fill(tr.menu.activePlans, { count: String(active) });
	return (
		<Pressable
			testID="menu.module.installments"
			accessibilityRole="button"
			accessibilityLabel={`${tr.menu.installments}, ${line}`}
			onPress={() => {
				// Borçlarım lists the plans until Elden Taksit gets its own screens (F4-09).
				router.navigate("/debts");
			}}
			style={({ pressed }) => [
				styles.tile,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderRadius: 18,
					padding: 14,
					gap: 10,
					opacity: pressed ? 0.7 : 1,
				},
			]}
		>
			<View
				style={[
					styles.tileIcon,
					{ backgroundColor: colors.warningSoft, borderRadius: radius.sm - 2 },
				]}
			>
				<Ionicons name="layers-outline" size={20} color={colors.warning} />
			</View>
			<View style={{ gap: 2 }}>
				<Text style={{ fontFamily: fonts.extrabold, fontSize: 15, color: colors.text }}>
					{tr.menu.installments}
				</Text>
				<Text style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}>
					{agreements.data === undefined ? " " : line}
				</Text>
			</View>
		</Pressable>
	);
}

// Design 05 (ADR-051): only modules that exist are listed; the rest come with their own tasks.
export function MenuScreen() {
	const { colors, typography, spacing } = useAppTheme();
	const email = supportEmail();
	const version = Constants.expoConfig?.version ?? "";
	return (
		<Screen testID="menu.screen" edges={["top", "bottom"]}>
			<Header />
			<View>
				<Text
					accessibilityRole="header"
					style={[
						typography.label,
						{
							color: colors.textMuted,
							paddingHorizontal: spacing.xs,
							paddingBottom: spacing.sm,
						},
					]}
				>
					{tr.menu.modules}
				</Text>
				<View style={[styles.grid, { gap: 10 }]}>
					<InstallmentsTile />
					<View style={styles.grow} />
				</View>
			</View>
			<RowGroup label={tr.menu.app}>
				<Row
					title={tr.menu.notifications}
					chevron={false}
					onPress={() => {
						router.push("/inbox");
					}}
					testID="menu.notifications.item"
				/>
				<Row
					title={tr.menu.privacy}
					chevron={false}
					onPress={() => {
						router.push("/me");
					}}
					testID="menu.privacy.item"
				/>
				{email === null ? null : (
					<Row
						title={tr.menu.help}
						chevron={false}
						onPress={() => {
							void Linking.openURL(
								`mailto:${email}?subject=${encodeURIComponent(tr.menu.helpSubject)}`,
							);
						}}
						testID="menu.help.item"
					/>
				)}
			</RowGroup>
			<View style={{ gap: 2, marginTop: spacing.xl }}>
				<Text
					testID="menu.disclaimer.text"
					style={[
						typography.caption,
						styles.centerText,
						{ fontSize: 12, color: colors.textMuted },
					]}
				>
					{tr.menu.disclaimer}
				</Text>
				<Text
					testID="menu.version.text"
					style={[
						typography.caption,
						styles.centerText,
						{ fontSize: 12, color: colors.textMuted },
					]}
				>
					{fill(tr.menu.version, { version })}
				</Text>
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	header: { flexDirection: "row", alignItems: "center" },
	grow: { flex: 1 },
	grid: { flexDirection: "row" },
	tile: { flex: 1, minHeight: 112, borderWidth: 1 },
	tileIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
	centerText: { textAlign: "center" },
});
