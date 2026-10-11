import { normalizePhoneTR } from "@paramnet/shared";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";

import { formatPhoneDigits, phoneDigits } from "./phoneInput";
import { useSession } from "./sessionStore";
import { useAuthApi } from "@/api/ApiProvider";
import { messageForError } from "@/api/errors";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { TextField } from "@/components/TextField";
import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

// S02: +90 is fixed; only Turkish mobile numbers can receive the code (ADR-014).
export function PhoneScreen() {
	const { colors, typography } = useAppTheme();
	const auth = useAuthApi();
	const setPendingPhone = useSession((state) => state.setPendingPhone);
	const [display, setDisplay] = useState("");
	const phone = normalizePhoneTR(phoneDigits(display));
	const showInvalid = phoneDigits(display).length === 10 && phone === null;

	const request = useMutation({
		mutationFn: (value: string) => auth.requestOtp(value),
		onSuccess: (_, value) => {
			setPendingPhone(value);
			router.push("/otp");
		},
	});

	return (
		<Screen
			testID="phone.screen"
			edges={["top", "bottom"]}
			footer={
				<Button
					label={tr.common.continue}
					disabled={phone === null}
					loading={request.isPending}
					onPress={() => {
						if (phone !== null) {
							request.mutate(phone);
						}
					}}
					testID="phone.continue.button"
				/>
			}
		>
			<ScreenTitle>{tr.phone.title}</ScreenTitle>
			<Text style={[typography.body, { color: colors.textMuted }]}>{tr.phone.helper}</Text>
			<TextField
				label={tr.phone.label}
				value={display}
				onChangeText={(text) => {
					setDisplay(formatPhoneDigits(text));
				}}
				keyboardType="phone-pad"
				textContentType="telephoneNumber"
				autoComplete="tel"
				autoFocus
				placeholder={tr.phone.placeholder}
				prefix={
					<Text style={[typography.body, { color: colors.textMuted }]}>
						{tr.phone.prefix}
					</Text>
				}
				error={
					showInvalid
						? tr.phone.errorInvalid
						: request.isError
							? messageForError(request.error)
							: undefined
				}
				testID="phone.number.input"
			/>
			<Text style={[typography.caption, { color: colors.textMuted }]}>{tr.phone.legal}</Text>
		</Screen>
	);
}
