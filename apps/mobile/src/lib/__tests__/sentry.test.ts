import * as Sentry from "@sentry/react-native";

import { initSentry } from "../sentry";

jest.mock("@sentry/react-native", () => ({ init: jest.fn() }));

const init = jest.mocked(Sentry.init);

beforeEach(() => {
	init.mockClear();
});

describe("initSentry (F3-01)", () => {
	it("stays off without a DSN", () => {
		expect(initSentry({})).toBe(false);
		expect(init).not.toHaveBeenCalled();
	});

	it("starts without personal data, replay or tracing", () => {
		expect(
			initSentry({
				EXPO_PUBLIC_SENTRY_DSN: "https://k@o1.ingest.de.sentry.io/1",
				EXPO_PUBLIC_SENTRY_ENV: "staging",
			}),
		).toBe(true);
		const options = init.mock.calls[0]?.[0];
		expect(options).toMatchObject({
			dsn: "https://k@o1.ingest.de.sentry.io/1",
			environment: "staging",
			sendDefaultPii: false,
			tracesSampleRate: 0,
			attachScreenshot: false,
			attachViewHierarchy: false,
		});
	});

	it("scrubs events and breadcrumbs before they leave the phone", () => {
		initSentry({ EXPO_PUBLIC_SENTRY_DSN: "https://k@o1.ingest.de.sentry.io/1" });
		const options = init.mock.calls[0]?.[0];
		const event = options?.beforeSend?.(
			{
				type: undefined,
				message: "Bora +905551234567",
				user: { id: "u1", username: "Bora" },
			},
			{},
		);
		expect(event).toEqual({ type: undefined, message: "Bora [phone]", user: { id: "u1" } });
		const crumb = options?.beforeBreadcrumb?.({ message: "Kalan 1.000,00 TL" }, {});
		expect(crumb).toEqual({ message: "Kalan [amount]" });
	});
});
