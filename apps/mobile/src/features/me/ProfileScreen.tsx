import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";

import { useApi, useAuthApi } from "@/api/ApiProvider";
import { messageForError } from "@/api/errors";
import { useMyProfile } from "@/api/hooks";
import type { MyProfile } from "@/api/types";
import { Avatar } from "@/components/Avatar";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Row, RowGroup } from "@/components/RowGroup";
import { Screen } from "@/components/Screen";
import { Badge } from "@/components/StatusBadge";
import { useSession } from "@/features/auth/sessionStore";
import { reminderSummary } from "@/features/inbox/inboxModel";
import { unregisterDevice } from "@/features/push/device";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

import { PhotoFrame } from "./PhotoFrame";
import { useMyAvatar } from "./useMyAvatar";

const COPIED_MS = 2000;

function Header({ profile }: { profile: MyProfile }) {
	const { colors, typography, fonts, spacing, radius } = useAppTheme();
	const avatar = useMyAvatar(profile);
	const openEdit = () => {
		router.push("/me/edit");
	};
	return (
		<View style={[styles.center, { gap: spacing.xs }]}>
			<View>
				<PhotoFrame>
					<Avatar name={profile.display_name ?? "?"} size={104} uri={avatar} />
				</PhotoFrame>
				<Pressable
					testID="me.photo.button"
					accessibilityRole="button"
					accessibilityLabel={tr.me.changePhoto}
					onPress={openEdit}
					style={[
						styles.camera,
						{ backgroundColor: colors.primary, borderColor: colors.bg },
					]}
				>
					<Ionicons name="camera-outline" size={18} color={colors.onPrimary} />
				</Pressable>
			</View>
			<Text
				testID="me.name.text"
				accessibilityRole="header"
				style={{
					fontFamily: fonts.extrabold,
					fontSize: 22,
					lineHeight: 28,
					color: colors.text,
					marginTop: spacing.md,
				}}
			>
				{profile.display_name ?? ""}
			</Text>
			{profile.username === null ? null : (
				<Text
					testID="me.username.text"
					style={[typography.callout, { color: colors.textMuted }]}
				>
					{`@${profile.username}`}
				</Text>
			)}
			<Pressable
				testID="me.edit.button"
				accessibilityRole="button"
				accessibilityLabel={tr.me.edit}
				onPress={openEdit}
				style={({ pressed }) => [
					styles.editButton,
					{
						marginTop: spacing.sm,
						borderRadius: radius.sm - 2,
						borderColor: colors.borderStrong,
						backgroundColor: colors.surface,
						opacity: pressed ? 0.7 : 1,
					},
				]}
			>
				<Ionicons name="create-outline" size={16} color={colors.primary} />
				<Text style={[typography.label, { color: colors.primary, fontSize: 14 }]}>
					{tr.me.edit}
				</Text>
			</Pressable>
		</View>
	);
}

// Design 04 "ParamNet ID" card: dark forest in both themes, like the welcome screen (hero tokens).
function IdCard({ paramnetId }: { paramnetId: string }) {
	const { colors, typography, fonts, spacing, radius } = useAppTheme();
	const [copied, setCopied] = useState(false);
	useEffect(() => {
		if (!copied) {
			return;
		}
		const timer = setTimeout(() => {
			setCopied(false);
		}, COPIED_MS);
		return () => {
			clearTimeout(timer);
		};
	}, [copied]);
	const actions = [
		{
			key: "copyId",
			icon: "copy-outline",
			label: copied ? tr.me.copied : tr.me.copy,
			a11y: tr.me.copyLabel,
			onPress: () => {
				void Clipboard.setStringAsync(paramnetId).then(() => {
					setCopied(true);
				});
			},
		},
		{
			key: "shareId",
			icon: "share-outline",
			label: tr.me.share,
			a11y: tr.me.shareLabel,
			onPress: () => {
				void Share.share({ message: fill(tr.me.shareMessage, { id: paramnetId }) });
			},
		},
	] as const;
	return (
		<View
			accessibilityLabel={tr.me.idTitle}
			style={[
				styles.idCard,
				{ backgroundColor: colors.heroStage, borderRadius: radius.xl, padding: 20 },
			]}
		>
			<View
				style={[styles.ring, { borderColor: colors.heroGlow }]}
				importantForAccessibility="no-hide-descendants"
				accessibilityElementsHidden
			/>
			<Text style={[typography.label, { color: colors.heroSoft }]}>{tr.me.idTitle}</Text>
			<Text
				testID="me.paramnetId.text"
				selectable
				style={{
					fontFamily: fonts.mono,
					fontSize: 30,
					lineHeight: 38,
					letterSpacing: 1.8,
					color: colors.heroText,
					marginTop: 6,
				}}
			>
				{paramnetId}
			</Text>
			<Text
				style={[
					typography.caption,
					{ fontFamily: fonts.medium, color: colors.heroSoft, marginTop: spacing.sm },
				]}
			>
				{tr.me.idBody}
			</Text>
			<View style={[styles.idActions, { gap: spacing.sm, marginTop: spacing.lg }]}>
				{actions.map((action) => (
					<Pressable
						key={action.key}
						testID={`me.${action.key}.button`}
						accessibilityRole="button"
						accessibilityLabel={action.a11y}
						onPress={action.onPress}
						style={({ pressed }) => [
							styles.idButton,
							{
								backgroundColor: colors.heroChip,
								borderRadius: radius.sm,
								opacity: pressed ? 0.7 : 1,
							},
						]}
					>
						<Ionicons name={action.icon} size={16} color={colors.heroText} />
						<Text style={[typography.label, { color: colors.heroText }]}>
							{action.label}
						</Text>
					</Pressable>
				))}
			</View>
		</View>
	);
}

function ProfileBody({ profile }: { profile: MyProfile }) {
	const { colors, typography, spacing } = useAppTheme();
	const auth = useAuthApi();
	const api = useApi();
	const signOut = useSession((state) => state.signOut);
	const queryClient = useQueryClient();
	// KVKK m.11: the data goes out through the system share sheet (save to Files, mail it, ...).
	const exportData = useMutation({
		mutationFn: async () => {
			const data = await api.exportMyData();
			await Share.share({
				title: tr.me.exportTitle,
				message: JSON.stringify(data, null, 2),
			});
		},
	});

	return (
		<>
			<Header profile={profile} />
			<IdCard paramnetId={profile.paramnet_id} />
			<RowGroup label={tr.me.accountSection}>
				<Row
					icon="notifications-outline"
					title={tr.me.reminderPrefs}
					value={reminderSummary(profile.reminder_before_days)}
					onPress={() => {
						router.push({ pathname: "/inbox", params: { focus: "reminders" } });
					}}
					testID="me.reminderPrefs.item"
				/>
			</RowGroup>
			<RowGroup label={tr.me.privacySection}>
				<Row
					icon="shield-checkmark-outline"
					title={tr.me.discoverability}
					value={
						profile.id_discoverable
							? tr.discoverability.everyone
							: tr.discoverability.nobody
					}
					onPress={() => {
						router.push("/me/discoverability");
					}}
					testID="me.discoverability.item"
				/>
				<Row
					icon="download-outline"
					title={tr.me.export}
					onPress={() => {
						exportData.mutate();
					}}
					right={
						exportData.isPending ? (
							<Badge label={tr.common.loading} tone="neutral" />
						) : undefined
					}
					testID="me.export.item"
				/>
				<Row
					icon="document-text-outline"
					title={tr.me.legal}
					onPress={() => {
						router.push("/me/legal");
					}}
					testID="me.legal.item"
				/>
				<Row
					icon="trash-outline"
					title={tr.me.deleteAccount}
					tone="overdue"
					onPress={() => {
						router.push("/me/delete");
					}}
					testID="me.deleteAccount.item"
				/>
			</RowGroup>
			{exportData.isError ? (
				<Text
					accessibilityLiveRegion="polite"
					style={[typography.callout, { color: colors.overdue }]}
				>
					{tr.me.exportFailed}
				</Text>
			) : null}
			<Pressable
				testID="me.signOut.button"
				accessibilityRole="button"
				accessibilityLabel={tr.me.signOut}
				onPress={() => {
					// The local session ends even if the server call fails; there is nothing to keep.
					// Flipping the session guard takes the user back to welcome.
					void unregisterDevice(auth)
						.then(() => auth.signOut())
						.finally(() => {
							// The next person on this device must not see the previous account's data.
							queryClient.clear();
							signOut();
						});
				}}
				style={({ pressed }) => [
					styles.signOut,
					{ marginTop: -spacing.xs, opacity: pressed ? 0.7 : 1 },
				]}
			>
				<Text style={[typography.rowTitle, { color: colors.overdue }]}>
					{tr.me.signOut}
				</Text>
			</Pressable>
		</>
	);
}

// Design 04 (ADR-051): profile, ParamNet ID and the privacy rows; replaces the old settings screen.
export function ProfileScreen() {
	const profile = useMyProfile();
	const setUser = useSession((state) => state.setUser);
	const user = useSession((state) => state.user);
	const displayName = profile.data?.display_name ?? null;

	// Home's greeting reads the name from the session; keep it in step with the profile.
	useEffect(() => {
		if (user !== null && displayName !== null && user.display_name !== displayName) {
			setUser({ ...user, display_name: displayName });
		}
	}, [user, displayName, setUser]);

	return (
		<Screen testID="me.screen" edges={["bottom"]}>
			{profile.isPending ? (
				<LoadingState testID="me.loading" />
			) : profile.isError ? (
				<ErrorState
					message={messageForError(profile.error)}
					onRetry={() => {
						void profile.refetch();
					}}
					testID="me.error"
				/>
			) : (
				<ProfileBody profile={profile.data} />
			)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	center: { alignItems: "center" },
	camera: {
		position: "absolute",
		right: -4,
		bottom: -2,
		width: 44,
		height: 44,
		borderRadius: 22,
		borderWidth: 3,
		alignItems: "center",
		justifyContent: "center",
	},
	editButton: {
		minHeight: 44,
		paddingHorizontal: 16,
		borderWidth: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	idCard: { overflow: "hidden" },
	ring: {
		position: "absolute",
		right: -40,
		top: -40,
		width: 160,
		height: 160,
		borderRadius: 80,
		borderWidth: 1,
	},
	idActions: { flexDirection: "row" },
	idButton: {
		flex: 1,
		height: 48,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
	},
	signOut: { minHeight: 52, alignItems: "center", justifyContent: "center" },
});
