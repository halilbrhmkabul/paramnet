import { tr } from "@/i18n/tr";

// Server error codes (paramnet-domain skill) plus client-side ones.
export type ApiErrorCode =
	| "conflict"
	| "invalid_transition"
	| "forbidden"
	| "amount_exceeds_outstanding"
	| "not_found"
	| "validation_error"
	| "network";

export class ApiError extends Error {
	constructor(readonly code: ApiErrorCode) {
		super(code);
		this.name = "ApiError";
	}
}

const MESSAGES: Record<ApiErrorCode, string> = {
	conflict: tr.error.conflict,
	invalid_transition: tr.error.invalidTransition,
	forbidden: tr.error.forbidden,
	amount_exceeds_outstanding: tr.error.exceedsOutstanding,
	not_found: tr.error.notFound,
	validation_error: tr.error.validation,
	network: tr.error.offline,
};

export function messageForError(error: unknown): string {
	return error instanceof ApiError ? MESSAGES[error.code] : tr.error.generic;
}
