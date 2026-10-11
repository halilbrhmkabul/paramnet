import { normalizePhoneTR } from "@paramnet/shared";
import { Contact } from "expo-contacts";

export type PickedContact = { display_name: string; phone_e164: string | null };

// Native picker: only the chosen contact's name and number are read; the address book is never uploaded (spec 5.2).
export async function pickContact(): Promise<PickedContact | null> {
	const contact = await Contact.presentPicker();
	if (contact === null) {
		return null;
	}
	const [name, phones] = await Promise.all([contact.getFullName(), contact.getPhones()]);
	const phone =
		phones.map((p) => normalizePhoneTR(p.number ?? "")).find((p) => p !== null) ?? null;
	return { display_name: name.trim(), phone_e164: phone };
}
