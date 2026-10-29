import { Ionicons } from "@expo/vector-icons";
import { addDays, formatDateTR, formatTRY } from "@paramnet/shared";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { messageForError } from "@/api/errors";
import { useWithdrawShare } from "@/api/hooks";
import { Button } from "@/components/Button";
import { Badge } from "@/components/StatusBadge";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { useAppTheme } from "@/theme/useAppTheme";

// Design 20: the request went out; it can still be taken back until the lender answers.
export function RequestSentScreen({
	agreementId,
	name,
	paramnetId,
	amountMinor,
	due,
}: {
	agreementId: string;
	name: string;
	paramnetId: string;
	amountMinor: number;
	due: string;
}) {
	const { colors, typography, fonts, spacing, radius, sizes } = useAppTheme();
	const today = useToday();
	const withdraw = useWithdrawShare();
	const kv = (label: string, value: React.ReactNode, first = false) => (
		<View
			style={[
				styles.kv,
				first ? null : { borderTopWidth: 1, borderTopColor: colors.divider },
			]}
		>
			<Text style={[typography.callout, { color: colors.textMuted }]}>{label}</Text>
			{typeof value === "string" ? (
				<Text
					style={{
						fontFamily: fonts.bold,
						fontSize: 14,
						color: colors.text,
						textAlign: "right",
						flexShrink: 1,
					}}
				>
					{value}
				</Text>
			) : (
				value
			)}
		</View>
	);
	return (
		<SafeAreaView
			testID="requestSent.screen"
			edges={["top", "bottom"]}
			style={{
				flex: 1,
				backgroundColor: colors.bg,
				paddingHorizontal: sizes.screenPadding,
				paddingBottom: spacing.xl,
			}}
		>
			<View style={styles.top}>
				<View style={[styles.ring, { backgroundColor: colors.pendingSoft }]}>
					<View style={[styles.icon, { backgroundColor: colors.pending }]}>
						<Ionicons name="paper-plane-outline" size={28} color={colors.onPrimary} />
					</View>
				</View>
				<Text
					accessibilityRole="header"
					style={[typography.title, { fontSize: 24, color: colors.text, marginTop: 22 }]}
				>
					{tr.request.sentTitle}
				</Text>
				<Text
					style={[
						typography.callout,
						styles.center,
						{ color: colors.textMuted, marginTop: 8 },
					]}
				>
					{fill(tr.request.sentBody, { name })}
				</Text>
			</View>
			<View
				style={{
					marginTop: 28,
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderWidth: 1,
					borderRadius: radius.lg,
				}}
			>
				{kv(
					tr.request.status,
					<Badge label={tr.request.waiting} tone="pending" testID="requestSent.status" />,
					true,
				)}
				{kv(tr.request.amount, formatTRY(amountMinor))}
				{kv(tr.request.to, `${name} · ${paramnetId}`)}
				{kv(tr.request.repay, formatDateTR(due, "long"))}
				{kv(
					tr.request.valid,
					fill(tr.request.validValue, {
						date: formatDateTR(addDays(today, 7), "dayMonth"),
					}),
				)}
			</View>
			<Text
				style={[
					typography.caption,
					{ fontSize: 12, color: colors.textMuted, marginTop: 10 },
				]}
			>
				{tr.request.sentNote}
			</Text>
			<View style={{ marginTop: "auto", gap: 10 }}>
				{withdraw.error === null ? null : (
					<Text
						accessibilityLiveRegion="polite"
						style={[typography.caption, { color: colors.overdue }]}
					>
						{messageForError(withdraw.error)}
					</Text>
				)}
				<Button
					label={tr.request.home}
					onPress={() => {
						router.dismissAll();
						router.navigate("/");
					}}
					testID="requestSent.home.button"
				/>
				<Button
					label={tr.request.debts}
					variant="secondary"
					onPress={() => {
						router.dismissAll();
						router.navigate("/debts");
					}}
					testID="requestSent.debts.button"
				/>
				<Pressable
					testID="requestSent.withdraw.button"
					accessibilityRole="button"
					onPress={() => {
						withdraw.mutate(agreementId, {
							onSuccess: () => {
								router.dismissAll();
								router.navigate("/");
							},
						});
					}}
					style={styles.link}
				>
					<Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.overdue }}>
						{tr.request.withdraw}
					</Text>
				</Pressable>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	top: { alignItems: "center", paddingTop: 72 },
	ring: {
		width: 88,
		height: 88,
		borderRadius: 44,
		alignItems: "center",
		justifyContent: "center",
	},
	icon: {
		width: 60,
		height: 60,
		borderRadius: 30,
		alignItems: "center",
		justifyContent: "center",
	},
	center: { textAlign: "center", maxWidth: 300 },
	kv: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 12,
		minHeight: 48,
	},
	link: { minHeight: 44, alignItems: "center", justifyContent: "center" },
});
