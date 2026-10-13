import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";

import { ApiError } from "@/api/errors";
import { SEED_IDS } from "@/api/mock/seed";
import { tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { createTestApi, provideTestApi } from "@/testing/providers";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

describe("Home (S05, design 03, F4-01c)", () => {
	it("shows my debts and receivables with record counts, then due dates with timing", async () => {
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(screen.getByTestId("home.receivable.amount")).toHaveTextContent("₺15.500,00");
		});
		expect(screen.getByTestId("home.payable.amount")).toHaveTextContent("₺22.500,00");
		expect(screen.getByTestId("home.payable.count")).toHaveTextContent("2 kayıt");
		expect(screen.getByTestId("home.receivable.count")).toHaveTextContent("2 kayıt");
		expect(screen.getByText(tr.home.payableNote)).toBeTruthy();

		// Overdue first, in the same list as the design: no separate section.
		const upcoming = screen.getByTestId("home.upcoming.list");
		const overdue = within(upcoming).getByTestId(`home.overdue.item.${SEED_IDS.ahmetLoan}.2`);
		expect(within(overdue).getByText("Ahmet Yılmaz · Borç")).toBeTruthy();
		expect(within(overdue).getByText("₺2.500,00")).toBeTruthy();
		expect(within(overdue).getByText("Gecikti · 10 gün")).toBeTruthy();
		expect(within(upcoming).getAllByTestId(/^home\.upcoming\.item\./)).toHaveLength(5);
		expect(within(upcoming).getByText(tr.installment.status.due_today)).toBeTruthy();
	});

	it("lists what waits for my answer and opens Bildirimler", async () => {
		await renderRouter(appRoutes, { initialUrl: "/" });
		// The demo has one plan shared with me (S19).
		await waitFor(() => {
			expect(screen.getByTestId("home.pending.band")).toHaveTextContent(
				"1 işlem onayını bekliyor",
				{ exact: false },
			);
		});
		const row = await screen.findByTestId(`home.pending.item.${SEED_IDS.zeynepShare}`);
		expect(within(row).getByText(tr.requests.actionAnswer)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("home.pending.band"));
		await waitFor(() => {
			expect(screen.getByTestId("requests.screen")).toBeTruthy();
		});
	});

	it("quick actions: lend starts the template, the rest are shown as coming soon", async () => {
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(screen.getByTestId("home.action.expense")).toBeDisabled();
		});
		expect(screen.getByTestId("home.action.request")).toBeDisabled();
		await fireEvent.press(screen.getByTestId("home.action.lend"));
		await waitFor(() => {
			expect(screen.getByTestId("newForm.screen")).toBeTruthy();
		});
	});

	it("the menu button opens settings", async () => {
		await renderRouter(appRoutes, { initialUrl: "/" });
		await fireEvent.press(await screen.findByTestId("home.menu.button"));
		await waitFor(() => {
			expect(screen.getByTestId("settings.screen")).toBeTruthy();
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

	it("empty: explains the next step and keeps the quick actions", async () => {
		provideTestApi(createTestApi({ seed: "empty" }));
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(screen.getByText(tr.home.emptyTitle)).toBeTruthy();
		});
		expect(screen.getByText(tr.home.emptyBody)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("home.action.lend"));
		await waitFor(() => {
			expect(screen.getByTestId("newForm.screen")).toBeTruthy();
		});
		expect(screen.getByText(tr.new.lent)).toBeTruthy();
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
			expect(screen.getByTestId("home.receivable.amount")).toHaveTextContent("₺15.500,00");
		});
	});

	it("the bell shows what waits for me and opens Talepler (design 03)", async () => {
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(screen.getByTestId("home.notifications.badge")).toHaveTextContent("1");
		});
		expect(screen.getByTestId("home.brand")).toBeTruthy();
		await fireEvent.press(screen.getByTestId("home.notifications.button"));
		await waitFor(() => {
			expect(screen.getByTestId("requests.screen")).toBeTruthy();
		});
	});
});
