import * as Sentry from "@sentry/nextjs";

import { serverSentryOptions } from "./lib/sentry";

// Next.js calls this once per server runtime (nodejs and edge).
export function register(): void {
	const options = serverSentryOptions(process.env);
	if (options !== null) {
		Sentry.init(options);
	}
}

// Errors thrown while rendering, in server actions and in the proxy.
export const onRequestError = Sentry.captureRequestError;
