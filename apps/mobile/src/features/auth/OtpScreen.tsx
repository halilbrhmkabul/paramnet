import { useMutation } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "react-native";

import { useSession } from "./sessionStore";
import { useAuthApi } from "@/api/ApiProvider";
import { messageForError } from "@/api/errors";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { TextField } from "@/components/TextField";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

const CODE_LENGTH = 6;
const RESEND_AFTER_S = 60;

// S03: sign-up and PIN reset; auto-submits at six digits; iOS fills the SMS code via textContentType="oneTimeCode".
export function OtpScreen() {
	const { colors, typography } = useAppTheme();
	const auth = useAuthApi();
	const phone = useSession((state) => state.pendingPhone);
	const purpose = useSession((state) => state.otpPurpose);
	const signIn = useSession((state) => state.signIn);
	const [code, setCode] = useState("");
	const [secondsLeft, setSecondsLeft] = useState(RESEND_AFTER_S);
	const [resent, setResent] = useState(false);

	useEffect(() => {
		if (secondsLeft <= 0) {
			return;
		}
		const timer = setTimeout(() => {
			setSecondsLeft((s) => s - 1);
		}, 1000);
		return () => {
			clearTimeout(timer);
		};
	}, [secondsLeft]);

	const verify = useMutation({
		mutationFn: (value: string) => auth.verifyOtp(phone ?? "", value),
		onSuccess: (user) => {
			// "Şifremi unuttum" and accounts without a PIN choose one next (ADR-046), then the profile.
			const resetPin = purpose === "reset";
			signIn(user, { resetPin });
			if (resetPin || !user.has_pin) {
				router.replace("/pin");
			} else if (user.display_name === null) {
				router.replace("/profile");
			}
		},
	});

	const resend = useMutation({
		mutationFn: () => auth.requestOtp(phone ?? ""),
		onSuccess: ({ resend_after_s }) => {
			setSecondsLeft(resend_after_s);
			setResent(true);
			setCode("");
			verify.reset();
		},
	});

	if (phone === null) {
		return <Redirect href="/login" />;
	}

	const error = verify.isError ? verify.error : resend.isError ? resend.error : null;

	return (
		<Screen testID="otp.screen" edges={["top", "bottom"]}>
			<ScreenTitle>{tr.otp.title}</ScreenTitle>
			<Text style={[typography.body, { color: colors.textMuted }]}>
				{fill(tr.otp.helper, { phone })}
			</Text>
			<TextField
				label={tr.otp.label}
				value={code}
				onChangeText={(text) => {
					const digits = text.replace(/\D/g, "").slice(0, CODE_LENGTH);
					setCode(digits);
					setResent(false);
					if (digits.length === CODE_LENGTH) {
						verify.mutate(digits);
					}
				}}
				keyboardType="number-pad"
				textContentType="oneTimeCode"
				autoComplete="sms-otp"
				autoFocus
				maxLength={CODE_LENGTH}
				error={error === null ? undefined : messageForError(error)}
				helper={resent ? tr.otp.resent : undefined}
				testID="otp.code.input"
			/>
			<Button
				label={
					secondsLeft > 0
						? fill(tr.otp.resendIn, { seconds: String(secondsLeft) })
						: tr.otp.resend
				}
				variant="secondary"
				disabled={secondsLeft > 0 || verify.isPending}
				loading={resend.isPending}
				onPress={() => {
					resend.mutate();
				}}
				testID="otp.resend.button"
			/>
			<Button
				label={tr.otp.changeNumber}
				variant="ghost"
				onPress={() => {
					router.back();
				}}
				testID="otp.changeNumber.button"
			/>
		</Screen>
	);
}
