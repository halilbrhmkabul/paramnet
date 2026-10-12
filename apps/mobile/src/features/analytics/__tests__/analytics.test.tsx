import { act, renderRouter, screen, waitFor } from "expo-router/testing-library";

import type { AnalyticsEvent } from "@/api/types";

import * as notifications from "@/lib/notifications";
import { appRoutes } from "@/testing/appRoutes";
import { createTestApi, provideTestApi } from "@/testing/providers";
import { signInForTest } from "@/testing/session";

const mocked = jest.mocked(notifications);

function spyTrack() {
	const api = createTestApi();
	const trackEvent = jest.fn((_event: AnalyticsEvent) => Promise.resolve());
	api.trackEvent = trackEvent;
	provideTestApi(api);
	return trackEvent;
}

beforeEach(() => {
	jest.clearAllMocks();
	signInForTest();
});

describe("analytics events from the app (F3-02, spec 13.3)", () => {
	it("counts an app start once", async () => {
		const trackEvent = spyTrack();
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(trackEvent).toHaveBeenCalledWith({ name: "app_opened" });
		});
		expect(trackEvent.mock.calls.filter(([event]) => event.name === "app_opened")).toHaveLength(
			1,
		);
	});

	it("counts an opened notification by template only", async () => {
		const trackEvent = spyTrack();
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(mocked.onNotificationOpened).toHaveBeenCalled();
		});
		const listener = mocked.onNotificationOpened.mock.calls[0]?.[0];
		await act(async () => {
			listener?.("a1", "dueToday");
			await Promise.resolve();
		});
		expect(trackEvent).toHaveBeenCalledWith({ name: "reminder_opened", template: "dueToday" });
	});

	it("counts an invite link opened in the app", async () => {
		const trackEvent = spyTrack();
		await renderRouter(appRoutes, { initialUrl: "/invite/demo-incoming" });
		await waitFor(() => {
			expect(trackEvent).toHaveBeenCalledWith({ name: "invite_opened" });
		});
	});

	it("a failing analytics call never breaks the app", async () => {
		const api = createTestApi();
		const trackEvent = jest.fn(() => Promise.reject(new Error("offline")));
		api.trackEvent = trackEvent;
		provideTestApi(api);
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(trackEvent).toHaveBeenCalled();
		});
		expect(screen.getByTestId("home.screen")).toBeTruthy();
	});
});
