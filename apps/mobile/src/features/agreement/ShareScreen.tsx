import { formatPhoneTR } from "@paramnet/shared";
import { router, useLocalSearchParams } from "expo-router";
import { Share, Text } from "react-native";

import { messageForError } from "@/api/errors";
import { useAgreement } from "@/api/hooks";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { ListItem } from "@/components/ListItem";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { useSession } from "@/features/auth/sessionStore";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

// S13 prototype (F1-11): no invite is created and the link is a placeholder; Faz 2 (F2-01/F2-06) makes it real.
export function ShareScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { colors, typography } = useAppTheme();
	const agreement = useAgreement(id);
	const myName = useSession((state) => state.user?.display_name ?? "");

	if (agreement.isPending) {
		return (
			<Screen testID="share.screen" edges={["bottom"]}>
				<LoadingState testID="share.loading" />
			</Screen>
		);
	}
	if (agreement.isError) {
		return (
			<Screen testID="share.screen" edges={["bottom"]}>
				<ErrorState
					message={messageForError(agreement.error)}
					onRetry={() => {
						void agreement.refetch();
					}}
					testID="share.error"
				/>
			</Screen>
		);
	}

	const phone = agreement.data.counterparty.phone_e164;
	const message = fill(tr.share.message, { name: myName, link: tr.share.prototypeLink });

	return (
		<Screen
			testID="share.screen"
			edges={["bottom"]}
			footer={
				<Button
					label={tr.share.send}
					disabled={phone === null}
					onPress={() => {
						void Share.share({ message });
					}}
					testID="share.send.button"
				/>
			}
		>
			<ScreenTitle>{tr.share.title}</ScreenTitle>
			<ListItem
				title={agreement.data.counterparty.display_name}
				subtitle={phone === null ? tr.share.needPhone : formatPhoneTR(phone)}
				testID="share.recipient"
			/>
			<Card>
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{tr.share.preview}
				</Text>
				<Text testID="share.message.text" style={[typography.body, { color: colors.text }]}>
					{message}
				</Text>
			</Card>
			<Text style={[typography.caption, { color: colors.textMuted }]}>
				{tr.share.prototypeNote}
			</Text>
			<Button
				label={tr.share.seeAsCounterparty}
				variant="ghost"
				onPress={() => {
					router.push({ pathname: "/agreement/[id]/invite-preview", params: { id } });
				}}
				testID="share.preview.button"
			/>
		</Screen>
	);
}
