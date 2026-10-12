import { scrubTelemetryEvent } from "@paramnet/shared";
import type { init } from "@sentry/nextjs";

type SentryOptions = NonNullable<Parameters<typeof init>[0]>;

// Server-side error reporting only (F3-01, ADR-037): the page collects a phone number and an OTP, so no
// third-party script runs in the browser and the CSP keeps connect-src 'self'. Off without SENTRY_DSN.
export function serverSentryOptions(env: Record<string, string | undefined>): SentryOptions | null {
	const dsn = env.SENTRY_DSN;
	if (dsn === undefined || dsn === "") {
		return null;
	}
	return {
		dsn,
		environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV ?? "development",
		// Sentry 11 collects users, cookies, headers, bodies, query strings and local variables by default.
		dataCollection: {
			userInfo: false,
			cookies: false,
			httpHeaders: false,
			httpBodies: [],
			urlQueryParams: false,
			databaseQueryData: false,
			stackFrameVariables: false,
		},
		tracesSampleRate: 0,
		beforeSend: (event) => scrubTelemetryEvent(event),
		beforeBreadcrumb: (breadcrumb) => scrubTelemetryEvent(breadcrumb),
	};
}
