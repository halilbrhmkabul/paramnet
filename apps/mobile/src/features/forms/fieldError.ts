import { tr } from "@/i18n/tr";

// Zod issue messages from @paramnet/shared are codes (ADR-014); this is the only place they become text.
const MESSAGES: Partial<Record<string, string>> = {
	required: tr.form.required,
	too_long: tr.form.tooLong,
	invalid_phone: tr.phone.errorInvalid,
};

export function messageForCode(code: string): string {
	return MESSAGES[code] ?? tr.error.validation;
}
