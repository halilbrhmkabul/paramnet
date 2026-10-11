import { router } from "expo-router";
import { Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useMakePersonal, useWithdrawShare } from "@/api/hooks";
import type { AgreementDetail } from "@/api/types";
import { Button } from "@/components/Button";
import { tr } from "@/i18n/tr";
import { useIsOnline } from "@/lib/network";
import { useAppTheme } from "@/theme/useAppTheme";

// screens.md "Anlaşma detayında birincil aksiyon" for the sharing states.
export function SharedStateActions({ agreement }: { agreement: AgreementDetail }) {
	const { colors, typography, spacing } = useAppTheme();
	const online = useIsOnline();
	const withdraw = useWithdrawShare();
	const makePersonal = useMakePersonal();
	const openDecision = () => {
		router.push({ pathname: "/agreement/[id]/decide", params: { id: agreement.id } });
	};
	const info = (text: string) => (
		<Text
			testID="agreement.state.text"
			style={[typography.callout, { color: colors.textMuted }]}
		>
			{text}
		</Text>
	);

	let content: React.ReactNode = null;
	if (agreement.status === "pending") {
		content = agreement.is_creator ? (
			<>
				{info(tr.agreementActions.pendingInfo)}
				<Button
					label={tr.decide.withdraw}
					variant="secondary"
					disabled={!online}
					loading={withdraw.isPending}
					onPress={() => {
						withdraw.mutate(agreement.id);
					}}
					testID="agreement.withdraw.button"
				/>
			</>
		) : (
			<Button
				label={tr.agreementActions.respond}
				disabled={!online}
				onPress={openDecision}
				testID="agreement.primaryAction.button"
			/>
		);
	} else if (agreement.status === "countered") {
		content = agreement.is_creator ? (
			<Button
				label={tr.agreementActions.reviewCounter}
				disabled={!online}
				onPress={openDecision}
				testID="agreement.primaryAction.button"
			/>
		) : (
			info(tr.agreementActions.counteredWaiting)
		);
	} else if (agreement.status === "rejected" && agreement.is_creator) {
		content = (
			<>
				{info(tr.agreementActions.rejectedInfo)}
				<Button
					label={tr.agreementActions.makePersonal}
					disabled={!online}
					loading={makePersonal.isPending}
					onPress={() => {
						makePersonal.mutate(agreement.id);
					}}
					testID="agreement.primaryAction.button"
				/>
			</>
		);
	}
	if (content === null) {
		return null;
	}
	const error = withdraw.error ?? makePersonal.error;
	return (
		<View style={{ gap: spacing.xs }}>
			{content}
			{error === null ? null : (
				<Text style={[typography.callout, { color: colors.overdue }]}>
					{messageForError(error)}
				</Text>
			)}
		</View>
	);
}
