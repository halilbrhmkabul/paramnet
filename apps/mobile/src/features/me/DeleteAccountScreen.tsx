import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";

import { useAuthApi } from "@/api/ApiProvider";
import { messageForError } from "@/api/errors";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Checkbox } from "@/components/Checkbox";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { useSession } from "@/features/auth/sessionStore";
import { tr } from "@/i18n/tr";
import { useIsOnline } from "@/lib/network";
import { useAppTheme } from "@/theme/useAppTheme";

// S20 "Hesabı sil" (F3-03, ADR-039): what goes, what stays with the other side, then one explicit step.
export function DeleteAccountScreen() {
	const { colors, typography, spacing } = useAppTheme();
	const auth = useAuthApi();
	const online = useIsOnline();
	const signOut = useSession((state) => state.signOut);
	const queryClient = useQueryClient();
	const [acknowledged, setAcknowledged] = useState(false);
	const remove = useMutation({
		mutationFn: () => auth.deleteAccount(),
		onSuccess: () => {
			// Nothing of the deleted account may stay on this device.
			queryClient.clear();
			signOut();
		},
	});

	return (
		<Screen
			testID="deleteAccount.screen"
			edges={["bottom"]}
			footer={
				<Button
					label={tr.deleteAccount.confirm}
					variant="danger"
					disabled={!acknowledged || !online}
					loading={remove.isPending}
					onPress={() => {
						remove.mutate();
					}}
					testID="deleteAccount.confirm.button"
				/>
			}
		>
			<ScreenTitle>{tr.deleteAccount.title}</ScreenTitle>
			<Card>
				<Text style={[typography.headline, { color: colors.text }]}>
					{tr.deleteAccount.intro}
				</Text>
				<View style={{ gap: spacing.sm }}>
					{[
						tr.deleteAccount.removed,
						tr.deleteAccount.keptForOthers,
						tr.deleteAccount.irreversible,
					].map((line) => (
						<Text key={line} style={[typography.body, { color: colors.text }]}>
							{line}
						</Text>
					))}
				</View>
			</Card>
			<Checkbox
				label={tr.deleteAccount.ack}
				checked={acknowledged}
				onChange={setAcknowledged}
				testID="deleteAccount.ack.checkbox"
			/>
			{remove.isError ? (
				<Text
					testID="deleteAccount.error"
					accessibilityLiveRegion="polite"
					style={[typography.callout, { color: colors.overdue }]}
				>
					{messageForError(remove.error)}
				</Text>
			) : null}
			{online ? null : (
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{tr.error.offline}
				</Text>
			)}
		</Screen>
	);
}
