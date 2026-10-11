import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

import { resetSession } from "@/features/auth/sessionStore";
import { tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { signInForTest } from "@/testing/session";

describe("navigation (signed in)", () => {
	beforeEach(() => {
		signInForTest();
	});

	it("opens on the home tab and switches between the four tabs", async () => {
		await renderRouter(appRoutes, { initialUrl: "/" });
		expect(screen.getByTestId("home.screen")).toBeTruthy();

		await fireEvent.press(screen.getByTestId("tabs.contacts"));
		expect(screen.getByTestId("contacts.screen")).toBeTruthy();

		await fireEvent.press(screen.getByTestId("tabs.calendar"));
		expect(screen.getByTestId("calendar.screen")).toBeTruthy();

		await fireEvent.press(screen.getByTestId("tabs.requests"));
		expect(screen.getByText(tr.requests.emptyTitle)).toBeTruthy();
	});

	it("the centre + button opens the new-record modal", async () => {
		await renderRouter(appRoutes, { initialUrl: "/" });
		await fireEvent.press(screen.getByTestId("tabs.new.button"));
		expect(screen.getByTestId("new.screen")).toBeTruthy();
	});
});

describe("navigation (signed out)", () => {
	beforeEach(() => {
		resetSession();
	});

	it("starts on welcome and cannot open the tabs", async () => {
		await renderRouter(appRoutes, { initialUrl: "/contacts" });
		expect(screen.getByTestId("welcome.screen")).toBeTruthy();
	});

	it.each(["/agreement/00000000-0000-4000-8000-0000000000b1", "/settings", "/new"])(
		"cannot open %s without a session",
		async (url) => {
			await renderRouter(appRoutes, { initialUrl: url });
			expect(screen.getByTestId("welcome.screen")).toBeTruthy();
		},
	);
});
