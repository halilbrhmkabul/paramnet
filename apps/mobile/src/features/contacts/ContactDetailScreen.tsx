import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { ContactBalance } from "./ContactBalance";
import { messageForError } from "@/api/errors";
import { useContact } from "@/api/hooks";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { SectionHeader } from "@/components/SectionHeader";
import { AgreementRow } from "@/features/agreements/AgreementRow";
import { useNewDraft } from "@/features/new/draftStore";
import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

// S07
export function ContactDetailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { spacing } = useAppTheme();
	const contact = useContact(id);
	const preferContact = useNewDraft((state) => state.preferContact);

	return (
		<Screen
			testID="contact.screen"
			edges={["bottom"]}
			footer={
				contact.isSuccess ? (
					<Button
						label={tr.contacts.newRecord}
						onPress={() => {
							preferContact(id);
							router.push("/new");
						}}
						testID="contact.newRecord.button"
					/>
				) : undefined
			}
		>
			{contact.isPending ? (
				<LoadingState testID="contact.loading" />
			) : contact.isError ? (
				<ErrorState
					message={messageForError(contact.error)}
					onRetry={() => {
						void contact.refetch();
					}}
					testID="contact.error"
				/>
			) : (
				<>
					<Card>
						<ScreenTitle testID="contact.name.text">
							{contact.data.display_name}
						</ScreenTitle>
						<ContactBalance
							net={contact.data.net_minor}
							variant="amountXL"
							testID="contact.net.amount"
						/>
					</Card>
					<View style={{ gap: spacing.xs }}>
						<SectionHeader>{tr.contacts.agreements}</SectionHeader>
						{contact.data.agreements.map((agreement) => (
							<AgreementRow
								key={agreement.id}
								agreement={agreement}
								testID={`contact.agreement.${agreement.id}`}
							/>
						))}
					</View>
				</>
			)}
		</Screen>
	);
}
