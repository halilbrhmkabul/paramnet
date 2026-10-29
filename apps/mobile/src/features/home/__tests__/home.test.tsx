import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";

import { ApiError } from "@/api/errors";
import { SEED_IDS } from "@/api/mock/seed";
import { fill, tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { createTestApi, provideTestApi } from "@/testing/providers";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

describe("Home (S05)", () => {
	it("shows totals, overdue and the next five due dates from the data", async () => {
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(screen.getByTestId("home.receivable.amount")).toHaveTextContent("15.500,00 TL");
		});
		expect(screen.getByTestId("home.payable.amount")).toHaveTextContent("22.500,00 TL");
		expect(screen.getByTestId("home.dueThisMonth.amount")).toHaveTextContent("4.000,00 TL");
		expect(screen.getByTestId("home.collectThisMonth.amount")).toHaveTextContent("5.500,00 TL");

		const overdue = screen.getByTestId("home.overdue.list");
		expect(within(overdue).getByText("Ahmet Yılmaz · Borç")).toBeTruthy();
		expect(within(overdue).getByText("2.500,00 TL")).toBeTruthy();
		expect(
			within(overdue).getByText(
				`${tr.installment.status.overdue} · ${tr.installment.partial}`,
			),
		).toBeTruthy();

		const upcoming = screen.getByTestId("home.upcoming.list");
		expect(within(upcoming).getAllByTestId(/^home\.upcoming\.item\./)).toHaveLength(5);
		expect(within(upcoming).getByText(tr.installment.status.due_today)).toBeTruthy();
		// The demo has one plan shared with me (S19).
		expect(screen.getByTestId("home.pending.band")).toHaveTextContent("1 iş seni bekliyor", {
			exact: false,
		});
	});

	it("opens the agreement from a due item", async () => {
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(screen.getByTestId(`home.overdue.item.${SEED_IDS.ahmetLoan}.2`)).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId(`home.overdue.item.${SEED_IDS.ahmetLoan}.2`));
		await waitFor(() => {
			expect(screen.getByTestId("agreement.screen")).toBeTruthy();
		});
	});

	it("empty: explains the next step and offers three quick templates", async () => {
		provideTestApi(createTestApi({ seed: "empty" }));
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(screen.getByText(tr.home.emptyTitle)).toBeTruthy();
		});
		expect(screen.getByText(tr.home.emptyBody)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("home.template.boughtInstallment"));
		await waitFor(() => {
			expect(screen.getByTestId("newForm.screen")).toBeTruthy();
		});
		// Design 23: the bought/sold side shows in the contact label under the "Elden taksit" title.
		expect(screen.getByText(tr.new.installmentTitle)).toBeTruthy();
		expect(screen.getByText(tr.new.sellerOrPerson)).toBeTruthy();
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

	it("the bell shows unread notices and opens Bildirimler (design 03)", async () => {
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

	it("quick starts stay on Home once there are records", async () => {
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(screen.getByTestId("home.receivable.amount")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("home.template.lent"));
		await waitFor(() => {
			expect(screen.getByTestId("newForm.screen")).toBeTruthy();
		});
	});
});
