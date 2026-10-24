import { Ionicons } from "@expo/vector-icons";
import { formatPhoneTR, normalizeUsername, usernameProblem } from "@paramnet/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import {
	useMyProfile,
	useRemoveAvatar,
	useUpdateProfile,
	useUploadAvatar,
	useUsernameCheck,
} from "@/api/hooks";
import type { MyProfile } from "@/api/types";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { useSession } from "@/features/auth/sessionStore";
import { tr } from "@/i18n/tr";
import { pickAvatar, type AvatarSource } from "@/lib/avatarImage";
import { useIsOnline } from "@/lib/network";
import { useAppTheme } from "@/theme/useAppTheme";

import { PhotoFrame } from "./PhotoFrame";
import { useMyAvatar } from "./useMyAvatar";

// check_username is limited per hour (ADR-051): ask only once typing pauses.
const USERNAME_DEBOUNCE_MS = 500;

const USERNAME_PROBLEMS = {
	username_length: tr.editProfile.usernameLength,
	username_format: tr.editProfile.usernameFormat,
	username_reserved: tr.editProfile.usernameReserved,
} as const;

function useDebounced<T>(value: T, ms: number): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebounced(value);
		}, ms);
		return () => {
			clearTimeout(timer);
		};
	}, [value, ms]);
	return debounced;
}

function PhotoButton({
	icon,
	label,
	onPress,
	danger = false,
	showLabel = true,
	disabled,
	testID,
}: {
	icon: keyof typeof Ionicons.glyphMap;
	label: string;
	onPress: () => void;
	danger?: boolean;
	showLabel?: boolean;
	disabled: boolean;
	testID: string;
}) {
	const { colors, typography, radius } = useAppTheme();
	const color = danger ? colors.overdue : colors.primary;
	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.photoButton,
				{
					borderRadius: radius.sm - 2,
					borderColor: danger ? colors.dangerBorder : colors.borderStrong,
					backgroundColor: colors.surface,
					opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
				},
			]}
		>
			<Ionicons name={icon} size={16} color={color} />
			{showLabel ? (
				<Text style={[typography.label, { color, fontSize: 14 }]}>{label}</Text>
			) : null}
		</Pressable>
	);
}

function PhotoSection({ profile }: { profile: MyProfile }) {
	const { colors, typography, spacing } = useAppTheme();
	const avatar = useMyAvatar(profile);
	const upload = useUploadAvatar();
	const remove = useRemoveAvatar();
	const [problem, setProblem] = useState<string | null>(null);
	const busy = upload.isPending || remove.isPending;

	const choose = (source: AvatarSource) => {
		setProblem(null);
		void pickAvatar(source)
			.then((picked) => {
				if (picked === null) {
					return;
				}
				if ("denied" in picked) {
					setProblem(tr.editProfile.cameraDenied);
					return;
				}
				upload.mutate(picked.uri, {
					onError: () => {
						setProblem(tr.editProfile.photoFailed);
					},
				});
			})
			.catch(() => {
				setProblem(tr.editProfile.photoFailed);
			});
	};

	return (
		<View style={[styles.center, { gap: spacing.md }]}>
			<PhotoFrame>
				<Avatar
					name={profile.display_name ?? "?"}
					size={112}
					uri={avatar}
					testID="editProfile.photo"
				/>
			</PhotoFrame>
			<View style={[styles.photoButtons, { gap: spacing.sm }]}>
				<PhotoButton
					icon="camera-outline"
					label={tr.editProfile.takePhoto}
					onPress={() => {
						choose("camera");
					}}
					disabled={busy}
					testID="editProfile.takePhoto.button"
				/>
				<PhotoButton
					icon="images-outline"
					label={tr.editProfile.fromGallery}
					onPress={() => {
						choose("library");
					}}
					disabled={busy}
					testID="editProfile.fromGallery.button"
				/>
				{profile.avatar_path === null ? null : (
					<PhotoButton
						icon="trash-outline"
						label={tr.editProfile.removePhoto}
						showLabel={false}
						danger
						onPress={() => {
							setProblem(null);
							remove.mutate(undefined, {
								onError: (error) => {
									setProblem(messageForError(error));
								},
							});
						}}
						disabled={busy}
						testID="editProfile.removePhoto.button"
					/>
				)}
			</View>
			{busy ? (
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{tr.editProfile.photoUploading}
				</Text>
			) : null}
			{problem === null ? null : (
				<Text
					testID="editProfile.photo.error"
					accessibilityLiveRegion="polite"
					style={[typography.callout, styles.centerText, { color: colors.overdue }]}
				>
					{problem}
				</Text>
			)}
		</View>
	);
}

// Design "ok": a small green tick and word inside the field.
function FieldTag({
	label,
	tone,
	testID,
}: {
	label: string;
	tone: "success" | "overdue";
	testID?: string;
}) {
	const { colors, typography } = useAppTheme();
	return (
		<View testID={testID} style={styles.tag}>
			<Ionicons
				name={tone === "success" ? "checkmark" : "close"}
				size={14}
				color={colors[tone]}
			/>
			<Text style={[typography.badge, { color: colors[tone] }]}>{label}</Text>
		</View>
	);
}

function UsernameStatus({ state }: { state: "checking" | "available" | "taken" | null }) {
	const { colors, typography } = useAppTheme();
	if (state === null) {
		return null;
	}
	if (state === "checking") {
		return (
			<View
				testID="editProfile.username.status"
				accessibilityLabel={tr.editProfile.usernameChecking}
				style={styles.tag}
			>
				<ActivityIndicator size="small" color={colors.textMuted} />
				<Text style={[typography.badge, { color: colors.textMuted }]}>
					{tr.editProfile.usernameChecking}
				</Text>
			</View>
		);
	}
	return (
		<FieldTag
			testID="editProfile.username.status"
			label={
				state === "available"
					? tr.editProfile.usernameAvailable
					: tr.editProfile.usernameTaken
			}
			tone={state === "available" ? "success" : "overdue"}
		/>
	);
}

function ReadOnlyBox({
	label,
	value,
	icon,
	mono = false,
	tag,
	testID,
}: {
	label: string;
	value: string;
	icon?: keyof typeof Ionicons.glyphMap;
	mono?: boolean;
	tag?: string;
	testID: string;
}) {
	const { colors, typography, fonts, radius, spacing } = useAppTheme();
	if (icon !== undefined) {
		// Design: the ParamNet ID sits in a sunken box with a lock, not in a field.
		return (
			<View
				accessible
				accessibilityLabel={`${label}, ${value}`}
				style={[
					styles.idBox,
					{
						backgroundColor: colors.surfaceSunken,
						borderRadius: radius.md,
						gap: spacing.md,
						padding: spacing.lg,
					},
				]}
			>
				<Ionicons name={icon} size={18} color={colors.textMuted} />
				<View style={styles.grow}>
					<Text style={[typography.label, { color: colors.textMuted }]}>{label}</Text>
					<Text
						testID={testID}
						style={{
							fontFamily: mono ? fonts.mono : fonts.semibold,
							fontSize: 16,
							lineHeight: 22,
							color: colors.primary,
						}}
					>
						{value}
					</Text>
				</View>
			</View>
		);
	}
	return (
		<View style={{ gap: spacing.xs }}>
			<Text style={[typography.label, { color: colors.textMuted }]}>{label}</Text>
			<View
				accessible
				accessibilityLabel={
					tag === undefined ? `${label}, ${value}` : `${label}, ${value}, ${tag}`
				}
				style={[
					styles.readOnly,
					{
						borderRadius: radius.sm,
						borderColor: colors.borderStrong,
						backgroundColor: colors.surface,
						paddingHorizontal: spacing.md,
					},
				]}
			>
				<Text
					testID={testID}
					style={[typography.body, styles.grow, { color: colors.text }]}
				>
					{value}
				</Text>
				{tag === undefined ? null : <FieldTag label={tag} tone="success" />}
			</View>
		</View>
	);
}

function EditForm({ profile }: { profile: MyProfile }) {
	const { spacing } = useAppTheme();
	const online = useIsOnline();
	const update = useUpdateProfile();
	const setUser = useSession((state) => state.setUser);
	const [firstName, setFirstName] = useState(profile.first_name ?? "");
	const [lastName, setLastName] = useState(profile.last_name ?? "");
	const [username, setUsername] = useState(profile.username ?? "");

	const firstNameMissing = firstName.trim() === "";
	const usernameEmpty = username.trim() === "";
	const problem = usernameEmpty ? null : usernameProblem(username);
	const normalized = usernameEmpty ? null : normalizeUsername(username);
	const changed = normalized !== null && normalized !== profile.username;
	const debounced = useDebounced(changed ? normalized : null, USERNAME_DEBOUNCE_MS);
	const check = useUsernameCheck(debounced);
	const status: "checking" | "available" | "taken" | null = !changed
		? null
		: debounced !== normalized || check.isFetching
			? "checking"
			: check.data === "taken"
				? "taken"
				: check.data === "available"
					? "available"
					: // A failed check (e.g. its hourly limit) leaves the decision to update_profile.
						null;

	const blocked =
		firstNameMissing || problem !== null || status === "taken" || status === "checking";

	return (
		<Screen
			testID="editProfile.screen"
			edges={["bottom"]}
			footer={
				<Button
					label={tr.common.save}
					disabled={blocked || !online}
					loading={update.isPending}
					onPress={() => {
						update.mutate(
							{
								first_name: firstName.trim(),
								last_name: lastName.trim(),
								username: normalized ?? "",
							},
							{
								onSuccess: (saved) => {
									const user = useSession.getState().user;
									if (user !== null) {
										setUser({ ...user, display_name: saved.display_name });
									}
									// Opened from a link there is nothing below it; Profil is where it belongs.
									if (router.canGoBack()) {
										router.back();
									} else {
										router.replace("/me");
									}
								},
							},
						);
					}}
					testID="editProfile.save.button"
				/>
			}
		>
			<PhotoSection profile={profile} />
			<View style={[styles.twoColumns, { gap: 10 }]}>
				<View style={styles.grow}>
					<TextField
						label={tr.editProfile.firstName}
						value={firstName}
						onChangeText={setFirstName}
						autoComplete="given-name"
						textContentType="givenName"
						maxLength={40}
						error={firstNameMissing ? tr.editProfile.firstNameRequired : undefined}
						testID="editProfile.firstName.input"
					/>
				</View>
				<View style={styles.grow}>
					<TextField
						label={tr.editProfile.lastName}
						value={lastName}
						onChangeText={setLastName}
						autoComplete="family-name"
						textContentType="familyName"
						maxLength={40}
						testID="editProfile.lastName.input"
					/>
				</View>
			</View>
			<TextField
				label={tr.editProfile.username}
				value={username}
				onChangeText={setUsername}
				autoCapitalize="none"
				autoComplete="username"
				maxLength={21}
				prefix={<AtSign />}
				suffix={<UsernameStatus state={problem === null ? status : null} />}
				error={problem === null ? undefined : USERNAME_PROBLEMS[problem]}
				testID="editProfile.username.input"
			/>
			<ReadOnlyBox
				label={tr.editProfile.phone}
				value={formatPhoneTR(profile.phone_e164)}
				tag={tr.editProfile.phoneVerified}
				testID="editProfile.phone.text"
			/>
			<ReadOnlyBox
				label={tr.editProfile.paramnetId}
				value={profile.paramnet_id}
				icon="lock-closed-outline"
				mono
				testID="editProfile.paramnetId.text"
			/>
			{update.isError ? <SaveError error={update.error} /> : null}
			{online ? null : <OfflineNote />}
			<View style={{ height: spacing.sm }} />
		</Screen>
	);
}

function AtSign() {
	const { colors, fonts } = useAppTheme();
	return <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textMuted }}>@</Text>;
}

function SaveError({ error }: { error: unknown }) {
	const { colors, typography } = useAppTheme();
	return (
		<Text
			testID="editProfile.error"
			accessibilityLiveRegion="polite"
			style={[typography.callout, { color: colors.overdue }]}
		>
			{messageForError(error)}
		</Text>
	);
}

function OfflineNote() {
	const { colors, typography } = useAppTheme();
	return (
		<Text style={[typography.caption, { color: colors.textMuted }]}>{tr.error.offline}</Text>
	);
}

// Design 35: photo, first and last name, @username; phone and ID are shown, not edited (ADR-051).
export function EditProfileScreen() {
	const profile = useMyProfile();
	if (profile.isPending) {
		return (
			<Screen testID="editProfile.screen" edges={["bottom"]}>
				<LoadingState testID="editProfile.loading" />
			</Screen>
		);
	}
	if (profile.isError) {
		return (
			<Screen testID="editProfile.screen" edges={["bottom"]}>
				<ErrorState
					message={messageForError(profile.error)}
					onRetry={() => {
						void profile.refetch();
					}}
					testID="editProfile.error"
				/>
			</Screen>
		);
	}
	return <EditForm profile={profile.data} />;
}

const styles = StyleSheet.create({
	center: { alignItems: "center" },
	centerText: { textAlign: "center" },
	grow: { flex: 1 },
	photoButtons: { flexDirection: "row" },
	photoButton: {
		minHeight: 44,
		minWidth: 44,
		paddingHorizontal: 14,
		borderWidth: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
	},
	twoColumns: { flexDirection: "row" },
	tag: { flexDirection: "row", alignItems: "center", gap: 4 },
	readOnly: { minHeight: 54, borderWidth: 1, flexDirection: "row", alignItems: "center" },
	idBox: { flexDirection: "row", alignItems: "center" },
});
