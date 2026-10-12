import { scrubTelemetryEvent } from "@paramnet/shared";
import * as Sentry from "@sentry/react-native";

// Crash and error reporting (F3-01, ADR-037). Off unless EXPO_PUBLIC_SENTRY_DSN is set; nothing that
// identifies a person leaves the phone: no default PII, screenshots, view hierarchy or replay, and
// every event and breadcrumb passes through the shared scrubber.
export function initSentry(env: Record<string, string | undefined> = process.env): boolean {
	const dsn = env.EXPO_PUBLIC_SENTRY_DSN;
	if (dsn === undefined || dsn === "") {
		return false;
	}
	Sentry.init({
		dsn,
		environment: env.EXPO_PUBLIC_SENTRY_ENV ?? (__DEV__ ? "development" : "production"),
		sendDefaultPii: false,
		tracesSampleRate: 0,
		attachScreenshot: false,
		attachViewHierarchy: false,
		beforeSend: (event) => scrubTelemetryEvent(event),
		beforeBreadcrumb: (breadcrumb) => scrubTelemetryEvent(breadcrumb),
	});
	return true;
}
