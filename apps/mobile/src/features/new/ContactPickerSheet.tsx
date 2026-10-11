import { contactInputSchema, type ContactKind } from "@paramnet/shared";
import { useState } from "react";
import { Modal, Text, View } from "react-native";

import type { ContactChoice } from "./formModel";
import { useContacts } from "@/api/hooks";
import type { ContactSummary } from "@/api/types";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { ListItem } from "@/components/ListItem";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { TextField } from "@/components/TextField";
import { messageForCode } from "@/features/forms/fieldError";
import { tr } from "@/i18n/tr";
import { pickContact } from "@/lib/contactPicker";
import { useAppTheme } from "@/theme/useAppTheme";

export type ContactPickerSheetProps = {
	visible: boolean;
	// New manual contacts default to merchant when the counterparty is a seller (e.g. "Yıldız Mobilya").
	newContactKind: ContactKind;
	lastContactId: string | null;
	onSelect: (choice: ContactChoice, label: string) => void;
	onClose: () => void;
};

function sortRecentFirst(
	contacts: ContactSummary[],
	lastContactId: string | null,
): ContactSummary[] {
	const recent = contacts.filter((c) => c.id === lastContactId);
	return [...recent, ...contacts.filter((c) => c.id !== lastContactId)];
}

export function ContactPickerSheet({
	visible,
	newContactKind,
	lastContactId,
	onSelect,
	onClose,
}: ContactPickerSheetProps) {
	const { colors, typography, spacing } = useAppTheme();
	const contacts = useContacts();
	const [query, setQuery] = useState("");
	const [manualOpen, setManualOpen] = useState(false);
	const [name, setName] = useState("");
	const [phone, setPhone] = useState("");
	const [manualErrors, setManualErrors] = useState<{ name?: string; phone?: string }>({});

	const needle = query.trim().toLocaleLowerCase("tr");
	const list = sortRecentFirst(contacts.data ?? [], lastContactId).filter((c) =>
		c.display_name.toLocaleLowerCase("tr").includes(needle),
	);

	// A picked number that is already saved reuses that contact (unique per owner + phone).
	function chooseNew(display_name: string, phone_e164: string | null, kind: ContactKind) {
		const existing =
			phone_e164 === null
				? undefined
				: contacts.data?.find((c) => c.phone_e164 === phone_e164);
		if (existing !== undefined) {
			onSelect({ contact_id: existing.id }, existing.display_name);
			return;
		}
		onSelect({ contact: { display_name, phone_e164, kind } }, display_name);
	}

	return (
		<Modal
			visible={visible}
			animationType="slide"
			presentationStyle="pageSheet"
			onRequestClose={onClose}
		>
			<Screen
				testID="contactPicker.screen"
				edges={["top", "bottom"]}
				footer={
					<Button
						label={tr.common.close}
						variant="secondary"
						onPress={onClose}
						testID="contactPicker.close.button"
					/>
				}
			>
				<ScreenTitle>{tr.contactPicker.title}</ScreenTitle>
				<Button
					label={tr.contactPicker.fromPhone}
					variant="secondary"
					onPress={() => {
						void pickContact().then((picked) => {
							if (picked !== null && picked.display_name !== "") {
								chooseNew(picked.display_name, picked.phone_e164, "person");
							}
						});
					}}
					testID="contactPicker.fromPhone.button"
				/>
				{manualOpen ? (
					<View style={{ gap: spacing.md }}>
						<TextField
							label={tr.contactPicker.manualName}
							value={name}
							onChangeText={setName}
							autoCapitalize="words"
							error={manualErrors.name}
							testID="contactPicker.manualName.input"
						/>
						<TextField
							label={tr.contactPicker.manualPhone}
							value={phone}
							onChangeText={setPhone}
							keyboardType="phone-pad"
							helper={tr.contactPicker.phoneHelper}
							error={manualErrors.phone}
							testID="contactPicker.manualPhone.input"
						/>
						<Button
							label={tr.contactPicker.manualSave}
							onPress={() => {
								const parsed = contactInputSchema.safeParse({
									display_name: name,
									phone_e164: phone,
									kind: newContactKind,
								});
								if (!parsed.success) {
									const errors: { name?: string; phone?: string } = {};
									for (const issue of parsed.error.issues) {
										const field =
											issue.path[0] === "phone_e164" ? "phone" : "name";
										errors[field] ??= messageForCode(issue.message);
									}
									setManualErrors(errors);
									return;
								}
								chooseNew(
									parsed.data.display_name,
									parsed.data.phone_e164,
									parsed.data.kind,
								);
							}}
							testID="contactPicker.manualSave.button"
						/>
					</View>
				) : (
					<Button
						label={tr.contactPicker.manual}
						variant="ghost"
						onPress={() => {
							setManualOpen(true);
						}}
						testID="contactPicker.manual.button"
					/>
				)}
				<TextField
					label={tr.contactPicker.search}
					value={query}
					onChangeText={setQuery}
					testID="contactPicker.search.input"
				/>
				{contacts.isPending ? (
					<LoadingState testID="contactPicker.loading" />
				) : contacts.isError ? (
					<ErrorState
						onRetry={() => {
							void contacts.refetch();
						}}
						testID="contactPicker.error"
					/>
				) : list.length === 0 ? (
					<Text style={[typography.body, { color: colors.textMuted }]}>
						{needle === "" ? tr.contactPicker.empty : tr.contactPicker.noMatch}
					</Text>
				) : (
					list.map((contact) => (
						<ListItem
							key={contact.id}
							title={contact.display_name}
							subtitle={contact.phone_e164 ?? undefined}
							onPress={() => {
								onSelect({ contact_id: contact.id }, contact.display_name);
							}}
							testID={`contactPicker.contact.${contact.id}`}
						/>
					))
				)}
			</Screen>
		</Modal>
	);
}
