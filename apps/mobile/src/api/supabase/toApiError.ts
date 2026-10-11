import { ApiError, type ApiErrorCode } from "../errors";

// RPCs raise SQLSTATE P0001 with the domain code as the message (ADR-021); GoTrue uses its own codes.
const RPC_CODES: readonly ApiErrorCode[] = [
	"conflict",
	"invalid_transition",
	"forbidden",
	"amount_exceeds_outstanding",
	"not_found",
	"validation_error",
];

const AUTH_CODES: Partial<Record<string, ApiErrorCode>> = {
	// GoTrue answers a wrong and an expired code the same way.
	otp_expired: "otp_invalid",
	over_sms_send_rate_limit: "rate_limited",
	over_request_rate_limit: "rate_limited",
	validation_failed: "invalid_phone",
};

function field(error: unknown, name: string): string | undefined {
	if (typeof error !== "object" || error === null || !(name in error)) {
		return undefined;
	}
	const value: unknown = (error as Record<string, unknown>)[name];
	return typeof value === "string" ? value : undefined;
}

export function toApiError(error: unknown): ApiError | Error {
	const code = field(error, "code");
	const message = field(error, "message");
	if (code === "P0001" && message !== undefined) {
		const known = RPC_CODES.find((c) => c === message);
		if (known !== undefined) {
			return new ApiError(known);
		}
	}
	if (code === "28000") {
		return new ApiError("forbidden");
	}
	const auth = code === undefined ? undefined : AUTH_CODES[code];
	if (auth !== undefined) {
		return new ApiError(auth);
	}
	// fetch failures surface as TypeError("Network request failed") in React Native; postgrest-js
	// wraps them into an error object whose message keeps that text.
	if (
		error instanceof TypeError ||
		field(error, "name") === "AuthRetryableFetchError" ||
		/Network request failed|Failed to fetch|fetch failed/.test(message ?? "")
	) {
		return new ApiError("network");
	}
	return error instanceof Error ? error : new Error(message ?? "unknown error");
}
