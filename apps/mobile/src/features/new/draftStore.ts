import { create } from "zustand";

import type { NewFormValues, NewType } from "./formModel";
import { newIdempotencyKey } from "@/lib/ids";

type DraftState = {
	type: NewType | null;
	values: NewFormValues | null;
	// One key per draft, reused on every retry of the same save (BR-09).
	idempotencyKey: string;
	lastContactId: string | null;
	start: (type: NewType) => void;
	setValues: (values: NewFormValues) => void;
	finish: (contactId: string | null) => void;
};

export const useNewDraft = create<DraftState>()((set) => ({
	type: null,
	values: null,
	idempotencyKey: "",
	lastContactId: null,
	start: (type) => {
		set({ type, values: null, idempotencyKey: newIdempotencyKey() });
	},
	setValues: (values) => {
		set({ values });
	},
	finish: (contactId) => {
		set((state) => ({
			type: null,
			values: null,
			idempotencyKey: "",
			lastContactId: contactId ?? state.lastContactId,
		}));
	},
}));

export function resetNewDraft(): void {
	useNewDraft.setState({ type: null, values: null, idempotencyKey: "", lastContactId: null });
}
