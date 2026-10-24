import { Ionicons } from "@expo/vector-icons";
import { PIN_LENGTH, normalizePhoneTR } from "@paramnet/shared";
import { useMutation } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatPhoneDigits, phoneDigits } from "./phoneInput";
import { useSession, type OtpPurpose } from "./sessionStore";
import { useAuthApi } from "@/api/ApiProvider";
import { messageForError } from "@/api/errors";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TextField } from "@/components/TextField";
import { IconButton } from "@/components/TopBar";
import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

type Mode = "signin" | "signup";

// S02, design 02: sign in with phone + 6-digit PIN, or sign up with the SMS code (ADR-046). +90 is fixed;
// only Turkish mobile numbers can receive the code (ADR-014). Face ID waits in BACKLOG.
export function LoginScreen() {
	const { colors, typography, fonts, spacing } = useAppTheme();
	const auth = useAuthApi();
	const params = useLocalSearchParams<{ mode?: string }>();
	const setPendingPhone = useSession((state) => state.setPendingPhone);
	const signIn = useSession((state) => state.signIn);
	const [mode, setMode] = useState<Mode>(params.mode === "signup" ? "signup" : "signin");
	const [display, setDisplay] = useState("");
	const [pin, setPin] = useState("");
	const [pinVisible, setPinVisible] = useState(false);
	const [needsPhone, setNeedsPhone] = useState(false);
	const phone = normalizePhoneTR(phoneDigits(display));
	const showInvalid = phoneDigits(display).length === 10 && phone === null;

	const sendCode = useMutation({
		mutationFn: ({ value }: { value: string; purpose: OtpPurpose }) => auth.requestOtp(value),
		onSuccess: (_, { value, purpose }) => {
			setPendingPhone(value, purpose);
			router.push("/otp");
		},
	});

	const pinLogin = useMutation({
		mutationFn: ({ value, code }: { value: string; code: string }) =>
			auth.signInWithPin(value, code),
		onSuccess: (user) => {
			signIn(user);
			// A number verified earlier whose profile step was never finished.
			if (user.display_name === null) {
				router.replace("/profile");
			}
		},
		onError: () => {
			setPin("");
		},
	});

	function changeMode(next: Mode) {
		setMode(next);
		setNeedsPhone(false);
		sendCode.reset();
		pinLogin.reset();
	}

	const signingIn = mode === "signin";
	const phoneError = showInvalid
		? tr.phone.errorInvalid
		: needsPhone
			? tr.login.forgotNeedsPhone
			: sendCode.isError
				? messageForError(sendCode.error)
				: undefined;

	return (
		<Screen
			testID="login.screen"
			edges={["top", "bottom"]}
			footer={
				<View style={{ gap: 10 }}>
					<Button
						label={signingIn ? tr.login.submitSignIn : tr.login.submitSignUp}
						disabled={phone === null || (signingIn && pin.length !== PIN_LENGTH)}
						loading={signingIn ? pinLogin.isPending : sendCode.isPending}
						onPress={() => {
							if (phone === null) {
								return;
							}
							if (signingIn) {
								pinLogin.mutate({ value: phone, code: pin });
							} else {
								sendCode.mutate({ value: phone, purpose: "signup" });
							}
						}}
						testID="login.submit.button"
					/>
					<View style={[styles.trust, { marginTop: spacing.sm }]}>
						<Ionicons name="shield-checkmark-outline" size={16} color={colors.accent} />
						<Text
							style={[
								typography.badge,
								styles.trustText,
								{ color: colors.textMuted },
							]}
						>
							{tr.phone.trustNote}
						</Text>
					</View>
				</View>
			}
		>
			<View style={styles.topRow}>
				<IconButton
					icon="chevron-back"
					label={tr.common.back}
					onPress={() => {
						if (router.canGoBack()) {
							router.back();
						} else {
							router.replace("/welcome");
						}
					}}
					testID="login.back.button"
				/>
			</View>
			<View style={{ gap: spacing.sm, marginTop: spacing.md }}>
				<Text
					accessibilityRole="header"
					style={[styles.title, { fontFamily: fonts.extrabold, color: colors.text }]}
				>
					{signingIn ? tr.login.signInTitle : tr.login.signUpTitle}
				</Text>
				<Text style={[typography.callout, { color: colors.textMuted, lineHeight: 22 }]}>
					{signingIn ? tr.login.signInHelper : tr.login.signUpHelper}
				</Text>
			</View>
			<SegmentedControl<Mode>
				label={tr.login.modeLabel}
				hideLabel
				options={[
					{ value: "signin", label: tr.login.modeSignIn },
					{ value: "signup", label: tr.login.modeSignUp },
				]}
				value={mode}
				onChange={changeMode}
				testID="login.mode"
			/>
			<TextField
				label={tr.phone.label}
				value={display}
				onChangeText={(text) => {
					setDisplay(formatPhoneDigits(text));
					setNeedsPhone(false);
				}}
				keyboardType="phone-pad"
				textContentType="telephoneNumber"
				autoComplete="tel"
				placeholder={tr.phone.placeholder}
				prefix={
					<Text
						style={[
							typography.rowTitle,
							styles.prefix,
							{ color: colors.neutral, borderRightColor: colors.border },
						]}
					>
						{tr.phone.prefix}
					</Text>
				}
				error={phoneError}
				testID="login.phone.input"
			/>
			{signingIn ? (
				<View>
					<TextField
						label={tr.login.pinLabel}
						value={pin}
						onChangeText={(text) => {
							setPin(text.replace(/\D/g, "").slice(0, PIN_LENGTH));
							pinLogin.reset();
						}}
						keyboardType="number-pad"
						textContentType="password"
						autoComplete="current-password"
						secureTextEntry={!pinVisible}
						maxLength={PIN_LENGTH}
						error={pinLogin.isError ? messageForError(pinLogin.error) : undefined}
						suffix={
							<Pressable
								testID="login.pin.toggle"
								accessibilityRole="button"
								accessibilityLabel={
									pinVisible ? tr.login.hidePin : tr.login.showPin
								}
								onPress={() => {
									setPinVisible(!pinVisible);
								}}
								style={styles.eye}
							>
								<Ionicons
									name={pinVisible ? "eye-off-outline" : "eye-outline"}
									size={20}
									color={colors.neutral}
								/>
							</Pressable>
						}
						testID="login.pin.input"
					/>
					<Pressable
						testID="login.forgot.button"
						accessibilityRole="button"
						accessibilityLabel={tr.login.forgot}
						disabled={sendCode.isPending}
						onPress={() => {
							if (phone === null) {
								setNeedsPhone(true);
								return;
							}
							sendCode.mutate({ value: phone, purpose: "reset" });
						}}
						style={styles.forgot}
					>
						<Text style={[typography.rowTitle, { color: colors.accent }]}>
							{tr.login.forgot}
						</Text>
					</Pressable>
				</View>
			) : (
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{tr.phone.legal}
				</Text>
			)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	topRow: { flexDirection: "row" },
	title: { fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
	prefix: { paddingRight: 10, borderRightWidth: 1 },
	eye: {
		width: 44,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
		marginRight: -10,
	},
	forgot: { alignSelf: "flex-end", minHeight: 44, justifyContent: "center" },
	trust: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
	trustText: { flex: 1 },
});
