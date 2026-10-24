import { fill, tr } from "@/i18n/tr";

// Server error codes (paramnet-domain skill) plus client-side ones.
export type ApiErrorCode =
	| "conflict"
	| "invalid_transition"
	| "forbidden"
	| "amount_exceeds_outstanding"
	| "not_found"
	| "validation_error"
	| "network"
	| "invalid_phone"
	| "otp_invalid"
	| "otp_expired"
	| "rate_limited"
	// ADR-046 / ADR-049: PIN sign-in.
	| "invalid_credentials"
	| "account_locked"
	| "pin_weak"
	// ADR-051: update_profile on a name someone else already has.
	| "username_taken";

// What pin-login adds to a refusal: tries left before the lock, or seconds until it lifts.
// RPCs also name the field a refusal is about (SQL `detail`, e.g. "paramnet_id" for the 30-day ID limit).
export type ApiErrorDetails = { attempts_left?: number; retry_after_s?: number; field?: string };

export class ApiError extends Error {
	constructor(
		readonly code: ApiErrorCode,
		readonly details?: ApiErrorDetails,
	) {
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
	invalid_phone: tr.phone.errorInvalid,
	otp_invalid: tr.otp.errorInvalid,
	otp_expired: tr.otp.errorExpired,
	rate_limited: tr.error.rateLimited,
	invalid_credentials: tr.error.invalidCredentials,
	account_locked: fill(tr.error.accountLocked, { minutes: "15" }),
	pin_weak: tr.pin.weak,
	username_taken: tr.error.usernameTaken,
};

// Where the error came from when the code alone is not enough: an ID search or share hitting its limit
// reads differently from a generic "too many tries".
export type ErrorContext = "paramnetId";

export function messageForError(error: unknown, context?: ErrorContext): string {
	if (!(error instanceof ApiError)) {
		return tr.error.generic;
	}
	const { attempts_left, retry_after_s, field } = error.details ?? {};
	if (error.code === "rate_limited" && field === "paramnet_id") {
		return tr.error.idRegenerateWait;
	}
	if (error.code === "rate_limited" && context === "paramnetId") {
		return tr.error.idLimited;
	}
	if (error.code === "invalid_credentials" && attempts_left !== undefined && attempts_left > 0) {
		return fill(tr.error.attemptsLeft, { count: String(attempts_left) });
	}
	if (error.code === "account_locked" && retry_after_s !== undefined) {
		return fill(tr.error.accountLocked, {
			minutes: String(Math.max(1, Math.ceil(retry_after_s / 60))),
		});
	}
	return MESSAGES[error.code];
}
