import { formatPhoneTR, normalizePhoneTR } from "@paramnet/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Share, Text } from "react-native";

import { messageForError } from "@/api/errors";
import { useAgreement, useShareAgreement } from "@/api/hooks";
import type { AgreementDetail } from "@/api/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { TextField } from "@/components/TextField";
import { useSession } from "@/features/auth/sessionStore";
import { fill, tr } from "@/i18n/tr";
import { inviteLink } from "@/lib/inviteLink";
import { useIsOnline } from "@/lib/network";
import { useAppTheme } from "@/theme/useAppTheme";

function ShareForm({ agreement }: { agreement: AgreementDetail }) {
	const { colors, typography } = useAppTheme();
	const myName = useSession((state) => state.user?.display_name ?? "");
	const online = useIsOnline();
	const share = useShareAgreement();
	const [phone, setPhone] = useState(
		agreement.counterparty.phone_e164 === null
			? ""
			: formatPhoneTR(agreement.counterparty.phone_e164),
	);
	const normalized = normalizePhoneTR(phone);
	const previewMessage = fill(tr.share.message, { name: myName, link: "…" });
	const [linkError, setLinkError] = useState(false);

	return (
		<Screen
			testID="share.screen"
			edges={["bottom"]}
			footer={
				<Button
					label={tr.share.send}
					disabled={normalized === null || !online}
					loading={share.isPending}
					onPress={() => {
						if (normalized === null) {
							return;
						}
						share.mutate(
							{
								id: agreement.id,
								phone: normalized,
								rowVersion: agreement.row_version,
							},
							{
								onSuccess: ({ token }) => {
									const link = inviteLink(token);
									if (link === null) {
										setLinkError(true);
										return;
									}
									// The plain token exists only here (ADR-026); the system share sheet sends it.
									void Share.share({
										message: fill(tr.share.message, { name: myName, link }),
									}).finally(() => {
										router.back();
									});
								},
							},
						);
					}}
					testID="share.send.button"
				/>
			}
		>
			<ScreenTitle>{tr.share.title}</ScreenTitle>
			<TextField
				label={tr.share.phoneLabel}
				value={phone}
				onChangeText={setPhone}
				keyboardType="phone-pad"
				helper={agreement.counterparty.display_name}
				error={phone !== "" && normalized === null ? tr.phone.errorInvalid : undefined}
				testID="share.phone.input"
			/>
			{normalized === null && phone === "" ? (
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{tr.share.needPhone}
				</Text>
			) : null}
			<Card>
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{tr.share.preview}
				</Text>
				<Text testID="share.message.text" style={[typography.body, { color: colors.text }]}>
					{previewMessage}
				</Text>
			</Card>
			{share.isError ? (
				<Text
					accessibilityLiveRegion="polite"
					style={[typography.callout, { color: colors.overdue }]}
				>
					{messageForError(share.error)}
				</Text>
			) : null}
			{linkError ? (
				<Text style={[typography.callout, { color: colors.overdue }]}>
					{tr.share.noLink}
				</Text>
			) : null}
			{online ? null : (
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{tr.error.offline}
				</Text>
			)}
			<Button
				label={tr.share.seeAsCounterparty}
				variant="ghost"
				onPress={() => {
					router.push({
						pathname: "/agreement/[id]/invite-preview",
						params: { id: agreement.id },
					});
				}}
				testID="share.preview.button"
			/>
		</Screen>
	);
}

// S13: creates the invite (share_agreement) and hands the link to the system share sheet.
export function ShareScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const agreement = useAgreement(id);
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
	return <ShareForm agreement={agreement.data} />;
}
