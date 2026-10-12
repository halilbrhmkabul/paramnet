// Deno-only error reporting for the edge functions (F3-01, ADR-037). Off without SENTRY_DSN. Events
// pass through the same scrubber as the app and the web page (telemetry.ts); request bodies, headers,
// cookies and users are never collected.
import * as Sentry from "npm:@sentry/deno@11.7.0";

import { scrubTelemetryEvent } from "./telemetry.ts";

let enabled: boolean | null = null;

function start(): boolean {
	if (enabled === null) {
		const dsn = Deno.env.get("SENTRY_DSN") ?? "";
		enabled = dsn !== "";
		if (enabled) {
			Sentry.init({
				dsn,
				environment: Deno.env.get("SENTRY_ENVIRONMENT") ?? "production",
				// The edge runtime is not a full Deno; the default integrations expect APIs it lacks.
				defaultIntegrations: false,
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
			});
		}
	}
	return enabled;
}

// Unexpected failures only: expected business errors (P0001 codes) are answers, not bugs.
export async function reportError(error: unknown, functionName: string): Promise<void> {
	if (!start()) {
		return;
	}
	Sentry.withScope((scope) => {
		scope.setTag("function", functionName);
		Sentry.captureException(error);
	});
	// The isolate may stop right after the response; send before returning.
	await Sentry.flush(2000);
}

export function withSentry(
	functionName: string,
	handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
	start();
	return async (request) => {
		try {
			return await handler(request);
		} catch (error) {
			await reportError(error, functionName);
			return new Response(JSON.stringify({ error: "server_error" }), {
				status: 500,
				headers: {
					"content-type": "application/json; charset=utf-8",
					"cache-control": "no-store",
				},
			});
		}
	};
}
