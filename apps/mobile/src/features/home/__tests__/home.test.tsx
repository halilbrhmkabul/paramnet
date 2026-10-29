import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";

import { ApiError } from "@/api/errors";
import { SEED_IDS } from "@/api/mock/seed";
import { fill, tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import {
	createTestAccountsApi,
	createTestApi,
	provideTestAccountsApi,
	provideTestApi,
} from "@/testing/providers";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

async function openHome() {
	await renderRouter(appRoutes, { initialUrl: "/" });
	await waitFor(() => {
		expect(screen.getByTestId("home.upcoming.list")).toBeTruthy();
	});
}

describe("Home (design 03)", () => {
	it("greets with the name and ParamNet ID", async () => {
		await openHome();
		// The test clock is 2026-10-11 12:00 in Istanbul.
		expect(screen.getByTestId("home.profile.button")).toHaveTextContent(/İyi günler,/);
		await waitFor(() => {
			expect(screen.getByTestId("home.paramnetId")).toHaveTextContent(/^PN-/);
		});
	});

	it("shows debts and receivables with their record counts", async () => {
		await openHome();
		await waitFor(() => {
			expect(screen.getByTestId("home.receivable.amount")).toHaveTextContent("15.500,00 TL");
		});
		expect(screen.getByTestId("home.payable.amount")).toHaveTextContent("22.500,00 TL");
		await waitFor(() => {
			expect(screen.getByTestId("home.payable.count")).toHaveTextContent(/\d+ kayıt/);
		});
		expect(screen.getByText(tr.home.payableHint)).toBeTruthy();
		expect(screen.getByText(tr.home.receivableHint)).toBeTruthy();
	});

	it("offers the design's four quick actions", async () => {
		await openHome();
		await fireEvent.press(screen.getByTestId("home.quick.expense"));
		await waitFor(() => {
			expect(screen.getByTestId("txForm.screen")).toBeTruthy();
		});
	});

	it("lends from the quick action", async () => {
		await openHome();
		await fireEvent.press(screen.getByTestId("home.quick.lend"));
		await waitFor(() => {
			expect(screen.getByTestId("newForm.screen")).toBeTruthy();
		});
	});

	it("lists what waits for my answer", async () => {
		await openHome();
		await waitFor(() => {
			expect(screen.getByTestId("home.pending.card")).toHaveTextContent(
				fill(tr.home.pendingTitle, { count: "1" }),
				{ exact: false },
			);
		});
		await fireEvent.press(screen.getByTestId(`home.pending.item.${SEED_IDS.zeynepShare}`));
		await waitFor(() => {
			expect(screen.getByTestId("decide.screen")).toBeTruthy();
		});
	});

	it("shows the cards with statement, minimum and payment day", async () => {
		await openHome();
		await waitFor(() => {
			expect(screen.getByTestId("home.cards")).toBeTruthy();
		});
		const cards = within(screen.getByTestId("home.cards"));
		expect(cards.getByText("12.450,00 TL")).toBeTruthy();
		expect(cards.getByText("4.980,00 TL")).toBeTruthy();
		expect(cards.getByText("19 Eki")).toBeTruthy();
	});

	it("lists the next payments of every module, late ones first", async () => {
		await openHome();
		const upcoming = within(screen.getByTestId("home.upcoming.list"));
		await waitFor(() => {
			expect(upcoming.getAllByTestId(/^home\.upcoming\.item\./)).toHaveLength(3);
		});
		expect(upcoming.getAllByText(tr.calendar.status.overdue).length).toBeGreaterThan(0);
		await fireEvent.press(screen.getByTestId("home.upcoming.calendar"));
		await waitFor(() => {
			expect(screen.getByTestId("calendar.screen")).toBeTruthy();
		});
	});

	it("shows the latest cash records", async () => {
		await openHome();
		await waitFor(() => {
			expect(screen.getByTestId("home.recent.list")).toBeTruthy();
		});
		const recent = within(screen.getByTestId("home.recent.list"));
		expect(recent.getByText("Freelance proje geliri")).toBeTruthy();
		expect(recent.getByText("+8.000,00 TL")).toBeTruthy();
	});

	it("a new user sees empty sections, not errors", async () => {
		provideTestApi(createTestApi({ seed: "empty" }));
		provideTestAccountsApi(createTestAccountsApi({ seed: "empty" }));
		await openHome();
		expect(screen.getByText(tr.home.upcomingEmpty)).toBeTruthy();
		expect(screen.getByText(tr.home.recentEmpty)).toBeTruthy();
		expect(screen.queryByTestId("home.cards")).toBeNull();
		expect(screen.queryByTestId("home.pending.card")).toBeNull();
		expect(screen.getByTestId("home.payable.count")).toHaveTextContent("0 kayıt");
	});

	it("error: shows a Turkish message and retries", async () => {
		const api = createTestApi();
		const real = api.getDashboard.bind(api);
		api.getDashboard = jest
			.fn()
			.mockRejectedValueOnce(new ApiError("network"))
			.mockImplementation(real);
		provideTestApi(api);
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(screen.getByText(tr.error.offline)).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("home.error.retry.button"));
		await waitFor(() => {
			expect(screen.getByTestId("home.receivable.amount")).toHaveTextContent("15.500,00 TL");
		});
	});

	it("the bell shows unread notices and opens Bildirimler", async () => {
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(screen.getByTestId("home.notifications.badge")).toHaveTextContent("2");
		});
		expect(screen.getByTestId("home.notifications.button")).toHaveProp(
			"accessibilityLabel",
			fill(tr.inbox.bell, { count: "2" }),
		);
		expect(screen.getByTestId("home.brand")).toBeTruthy();
		await fireEvent.press(screen.getByTestId("home.notifications.button"));
		await waitFor(() => {
			expect(screen.getByTestId("inbox.screen")).toBeTruthy();
		});
	});

	it("the menu button opens Ana menü", async () => {
		await renderRouter(appRoutes, { initialUrl: "/" });
		await fireEvent.press(screen.getByTestId("home.menu.button"));
		await waitFor(() => {
			expect(screen.getByTestId("menu.screen")).toBeTruthy();
		});
	});
});
