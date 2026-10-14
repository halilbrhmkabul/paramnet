import { PIN_LENGTH, pinProblem } from "@paramnet/shared";
import { useMutation } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useSession } from "./sessionStore";
import { useAuthApi } from "@/api/ApiProvider";
import { messageForError } from "@/api/errors";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

// ADR-046: the PIN is chosen twice after the SMS code — at sign-up, after "Şifremi unuttum" and once
// for accounts from before PINs. The server checks the same weak-PIN rule (pin-set).
export function PinScreen() {
	const { colors, typography, fonts, spacing } = useAppTheme();
	const auth = useAuthApi();
	const user = useSession((state) => state.user);
	const purpose = useSession((state) => state.otpPurpose);
	const pinSaved = useSession((state) => state.pinSaved);
	const [first, setFirst] = useState<string | null>(null);
	const [value, setValue] = useState("");
	const [problem, setProblem] = useState<string | null>(null);

	const save = useMutation({
		mutationFn: (pin: string) => auth.setPin(pin),
		onSuccess: () => {
			const needsProfile = user?.display_name == null;
			pinSaved();
			// With a name the account is complete; the index route opens the tabs.
			if (needsProfile) {
				router.replace("/profile");
			}
		},
		onError: (error) => {
			setFirst(null);
			setProblem(messageForError(error));
		},
	});

	if (user === null) {
		return <Redirect href="/welcome" />;
	}

	const legacy = purpose === "signup" && user.display_name !== null && !user.has_pin;
	const title =
		first !== null
			? tr.pin.confirmTitle
			: purpose === "reset"
				? tr.pin.resetTitle
				: tr.pin.createTitle;
	const helper =
		first !== null ? tr.pin.confirmHelper : legacy ? tr.pin.legacyHelper : tr.pin.helper;

	function onChange(text: string) {
		const digits = text.replace(/\D/g, "").slice(0, PIN_LENGTH);
		setValue(digits);
		if (digits.length < PIN_LENGTH) {
			return;
		}
		setValue("");
		if (first === null) {
			if (pinProblem(digits) !== null) {
				setProblem(tr.pin.weak);
				return;
			}
			setProblem(null);
			setFirst(digits);
			return;
		}
		if (digits !== first) {
			setFirst(null);
			setProblem(tr.pin.mismatch);
			return;
		}
		setProblem(null);
		save.mutate(digits);
	}

	return (
		<Screen testID="pin.screen" edges={["top", "bottom"]}>
			<View style={{ gap: spacing.sm, marginTop: 56 }}>
				<Text
					accessibilityRole="header"
					style={[styles.title, { fontFamily: fonts.extrabold, color: colors.text }]}
				>
					{title}
				</Text>
				<Text style={[typography.callout, { color: colors.textMuted, lineHeight: 22 }]}>
					{helper}
				</Text>
			</View>
			<TextField
				label={tr.pin.label}
				value={value}
				onChangeText={onChange}
				keyboardType="number-pad"
				textContentType="newPassword"
				autoComplete="new-password"
				secureTextEntry
				autoFocus
				maxLength={PIN_LENGTH}
				error={problem ?? undefined}
				helper={save.isPending ? tr.common.loading : undefined}
				testID="pin.input"
			/>
		</Screen>
	);
}

const styles = StyleSheet.create({
	title: { fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
});
