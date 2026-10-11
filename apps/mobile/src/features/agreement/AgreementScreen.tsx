import { useLocalSearchParams } from "expo-router";

import { messageForError } from "@/api/errors";
import { useAgreement } from "@/api/hooks";
import { AmountText } from "@/components/AmountText";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { AgreementStatusBadge } from "@/components/StatusBadge";

// S11 skeleton reached after saving a new record; F1-09 fills in the full detail.
export function AgreementScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const agreement = useAgreement(id);

	return (
		<Screen testID="agreement.screen">
			{agreement.isPending ? (
				<LoadingState testID="agreement.loading" />
			) : agreement.isError ? (
				<ErrorState
					message={messageForError(agreement.error)}
					onRetry={() => {
						void agreement.refetch();
					}}
					testID="agreement.error"
				/>
			) : (
				<>
					<ScreenTitle testID="agreement.title.text">{agreement.data.title}</ScreenTitle>
					<AgreementStatusBadge
						status={agreement.data.status}
						testID="agreement.status.badge"
					/>
					<AmountText
						minor={agreement.data.outstanding_minor}
						variant="amountXL"
						testID="agreement.outstanding.text"
					/>
				</>
			)}
		</Screen>
	);
}
