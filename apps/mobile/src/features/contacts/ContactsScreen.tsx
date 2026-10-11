import { router } from "expo-router";
import { useState } from "react";
import { RefreshControl, Text } from "react-native";

import { ContactBalance } from "./ContactBalance";
import { messageForError } from "@/api/errors";
import { useContacts } from "@/api/hooks";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { ListItem } from "@/components/ListItem";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { TextField } from "@/components/TextField";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

// S06
export function ContactsScreen() {
	const { colors, typography } = useAppTheme();
	const contacts = useContacts();
	const [query, setQuery] = useState("");
	const needle = query.trim().toLocaleLowerCase("tr");
	const list = (contacts.data ?? []).filter((c) =>
		c.display_name.toLocaleLowerCase("tr").includes(needle),
	);

	return (
		<Screen
			testID="contacts.screen"
			refreshControl={
				<RefreshControl
					refreshing={contacts.isRefetching}
					onRefresh={() => {
						void contacts.refetch();
					}}
				/>
			}
		>
			<ScreenTitle>{tr.tabs.contacts}</ScreenTitle>
			{contacts.isPending ? (
				<LoadingState testID="contacts.loading" />
			) : contacts.isError ? (
				<ErrorState
					message={messageForError(contacts.error)}
					onRetry={() => {
						void contacts.refetch();
					}}
					testID="contacts.error"
				/>
			) : contacts.data.length === 0 ? (
				<EmptyState
					title={tr.contacts.emptyTitle}
					body={tr.contacts.emptyBody}
					actionLabel={tr.home.addFirst}
					onAction={() => {
						router.push("/new");
					}}
					testID="contacts.empty"
				/>
			) : (
				<>
					<TextField
						label={tr.contacts.search}
						value={query}
						onChangeText={setQuery}
						testID="contacts.search.input"
					/>
					{list.length === 0 ? (
						<Text style={[typography.body, { color: colors.textMuted }]}>
							{tr.contacts.noMatch}
						</Text>
					) : (
						list.map((contact) => (
							<ListItem
								key={contact.id}
								title={contact.display_name}
								subtitle={fill(tr.contacts.openAgreements, {
									count: String(contact.open_agreement_count),
								})}
								right={<ContactBalance net={contact.net_minor} />}
								onPress={() => {
									router.push({
										pathname: "/contact/[id]",
										params: { id: contact.id },
									});
								}}
								testID={`contacts.item.${contact.id}`}
							/>
						))
					)}
				</>
			)}
		</Screen>
	);
}
