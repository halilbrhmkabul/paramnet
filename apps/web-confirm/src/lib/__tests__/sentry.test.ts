import { describe, expect, it } from "vitest";

import { serverSentryOptions } from "../sentry";

describe("serverSentryOptions (F3-01)", () => {
	it("is off without a DSN", () => {
		expect(serverSentryOptions({})).toBeNull();
		expect(serverSentryOptions({ SENTRY_DSN: "" })).toBeNull();
	});

	it("reports server errors only, without personal data or tracing", () => {
		const options = serverSentryOptions({
			SENTRY_DSN: "https://k@o1.ingest.de.sentry.io/1",
			SENTRY_ENVIRONMENT: "staging",
		});
		expect(options).toMatchObject({
			dsn: "https://k@o1.ingest.de.sentry.io/1",
			environment: "staging",
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
		});
	});

	it("drops the form a person typed (phone, code) and masks what is left", () => {
		const options = serverSentryOptions({ SENTRY_DSN: "https://k@o1.ingest.de.sentry.io/1" });
		const event = options?.beforeSend?.(
			{
				type: undefined,
				message: "invite_decide failed for +905551234567",
				request: {
					url: "https://onay.example/i/Q2hhbmdlTWVQbGVhc2VUaGlzSXNBVG9rZW5WYWx1ZTEyMw",
					method: "POST",
					data: "phone=5551234567&code=123456",
					cookies: { pn_csrf: "x" },
				},
			},
			{},
		);
		expect(event).toEqual({
			type: undefined,
			message: "invite_decide failed for [phone]",
			request: { url: "https://onay.example/i/[token]", method: "POST" },
		});
	});
});
