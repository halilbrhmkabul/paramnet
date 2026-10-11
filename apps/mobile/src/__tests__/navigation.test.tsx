import { fireEvent, renderRouter, screen } from "expo-router/testing-library";

import RootLayout from "../../app/_layout";
import AuthLayout from "../../app/(auth)/_layout";
import Welcome from "../../app/(auth)/welcome";
import TabsLayout from "../../app/(tabs)/_layout";
import Add from "../../app/(tabs)/add";
import Calendar from "../../app/(tabs)/calendar";
import Contacts from "../../app/(tabs)/contacts";
import Home from "../../app/(tabs)/index";
import Requests from "../../app/(tabs)/requests";
import Index from "../../app/index";
import NewLayout from "../../app/new/_layout";
import NewIndex from "../../app/new/index";
import { tr } from "@/i18n/tr";

jest.mock("@/api/ApiProvider", () => {
	const actual = jest.requireActual<typeof import("@/api/ApiProvider")>("@/api/ApiProvider");
	const { createTestApi } =
		jest.requireActual<typeof import("@/testing/providers")>("@/testing/providers");
	return { ...actual, createApi: () => createTestApi() };
});

const routes = {
	_layout: RootLayout,
	index: Index,
	"(auth)/_layout": AuthLayout,
	"(auth)/welcome": Welcome,
	"(tabs)/_layout": TabsLayout,
	"(tabs)/index": Home,
	"(tabs)/contacts": Contacts,
	"(tabs)/add": Add,
	"(tabs)/calendar": Calendar,
	"(tabs)/requests": Requests,
	"new/_layout": NewLayout,
	"new/index": NewIndex,
};

describe("navigation", () => {
	it("opens on the home tab and switches between the four tabs", async () => {
		await renderRouter(routes, { initialUrl: "/" });
		expect(screen.getByTestId("home.screen")).toBeTruthy();

		await fireEvent.press(screen.getByTestId("tabs.contacts"));
		expect(screen.getByTestId("contacts.screen")).toBeTruthy();

		await fireEvent.press(screen.getByTestId("tabs.calendar"));
		expect(screen.getByTestId("calendar.screen")).toBeTruthy();

		await fireEvent.press(screen.getByTestId("tabs.requests"));
		expect(screen.getByText(tr.requests.emptyTitle)).toBeTruthy();
	});

	it("the centre + button opens the new-record modal", async () => {
		await renderRouter(routes, { initialUrl: "/" });
		await fireEvent.press(screen.getByTestId("tabs.new.button"));
		expect(screen.getByTestId("new.screen")).toBeTruthy();
		expect(screen.getByText(tr.new.title)).toBeTruthy();
	});

	it("welcome continues into the tabs", async () => {
		await renderRouter(routes, { initialUrl: "/welcome" });
		await fireEvent.press(screen.getByTestId("welcome.start.button"));
		expect(screen.getByTestId("home.screen")).toBeTruthy();
	});
});
