import { displayNameSchema } from "@paramnet/shared";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";

import { useSession } from "./sessionStore";
import { useAuthApi } from "@/api/ApiProvider";
import { messageForError } from "@/api/errors";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { TextField } from "@/components/TextField";
import { messageForCode } from "@/features/forms/fieldError";
import { tr } from "@/i18n/tr";

// S04 part 1: display name and KVKK consent (spec 5.1 steps 3–4).
export function ProfileScreen() {
	const auth = useAuthApi();
	const setUser = useSession((state) => state.setUser);
	const [name, setName] = useState("");
	const [touched, setTouched] = useState(false);
	const [consent, setConsent] = useState(false);
	const parsed = displayNameSchema.safeParse(name);

	const save = useMutation({
		mutationFn: (value: string) => auth.updateProfile(value),
		onSuccess: (user) => {
			setUser(user);
			router.push("/notifications");
		},
	});

	const nameError =
		touched && !parsed.success
			? messageForCode(parsed.error.issues[0]?.message ?? "")
			: undefined;

	return (
		<Screen
			testID="profile.screen"
			edges={["top", "bottom"]}
			footer={
				<Button
					label={tr.common.continue}
					disabled={!parsed.success || !consent}
					loading={save.isPending}
					onPress={() => {
						if (parsed.success) {
							save.mutate(parsed.data);
						}
					}}
					testID="profile.save.button"
				/>
			}
		>
			<ScreenTitle>{tr.profile.name}</ScreenTitle>
			<TextField
				label={tr.profile.nameLabel}
				helper={tr.profile.nameHelper}
				value={name}
				onChangeText={setName}
				onBlur={() => {
					setTouched(true);
				}}
				autoComplete="name"
				textContentType="name"
				autoCapitalize="words"
				autoFocus
				error={nameError ?? (save.isError ? messageForError(save.error) : undefined)}
				testID="profile.name.input"
			/>
			<Checkbox
				label={tr.profile.consent}
				checked={consent}
				onChange={setConsent}
				testID="profile.consent.checkbox"
			/>
		</Screen>
	);
}
