import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { fill, tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { createTestAccountsApi, provideTestAccountsApi } from "@/testing/providers";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

describe("Tekrarlayan işlemler (38)", () => {
	it("lists the rules and confirms a planned date into a record", async () => {
		const api = createTestAccountsApi();
		provideTestAccountsApi(api);
		await renderRouter(appRoutes, { initialUrl: "/add" });
		await fireEvent.press(screen.getByTestId("action.recurring"));
		await waitFor(() => {
			expect(screen.getByTestId("recurring.item.0")).toBeTruthy();
		});
		expect(screen.getByText(fill(tr.recurring.active, { count: "2" }))).toBeTruthy();
		expect(screen.getByTestId("recurring.item.0")).toHaveTextContent(
			"Her ayın 1’i · Maaş Hesabı",
			{
				exact: false,
			},
		);
		expect(screen.getByTestId("recurring.item.1")).toHaveTextContent("−15.000,00 TL", {
			exact: false,
		});
		// Kira (ayın 3'ü) is due and asks each time; Maaş was already recorded on the 1st.
		expect(screen.getByTestId("recurring.pending.0")).toHaveTextContent("Kira", {
			exact: false,
		});
		expect(screen.queryByTestId("recurring.pending.1")).toBeNull();
		await fireEvent.press(screen.getByTestId("recurring.pending.0.confirm"));
		await waitFor(() => {
			expect(screen.queryByTestId("recurring.pending")).toBeNull();
		});
		provideTestAccountsApi(api);
		await renderRouter(appRoutes, { initialUrl: "/transactions" });
		await waitFor(() => {
			expect(screen.getByText("3 Ekim, Cumartesi")).toBeTruthy();
		});
		expect(screen.getByText("Kira")).toBeTruthy();
	});

	it("skips a planned date without a record", async () => {
		const api = createTestAccountsApi();
		provideTestAccountsApi(api);
		await renderRouter(appRoutes, { initialUrl: "/recurring" });
		await waitFor(() => {
			expect(screen.getByTestId("recurring.pending.0")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("recurring.pending.0.skip"));
		await waitFor(() => {
			expect(screen.queryByTestId("recurring.pending")).toBeNull();
		});
		provideTestAccountsApi(api);
		await renderRouter(appRoutes, { initialUrl: "/transactions" });
		await waitFor(() => {
			expect(screen.getByTestId("txHistory.income.amount")).toBeTruthy();
		});
		expect(screen.queryByText("Kira")).toBeNull();
	});

	it("adds a rule and shows its next three dates", async () => {
		await renderRouter(appRoutes, { initialUrl: "/recurring" });
		await waitFor(() => {
			expect(screen.getByTestId("recurring.add.button")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("recurring.add.button"));
		await waitFor(() => {
			expect(screen.getByTestId("recurringForm.name.input")).toBeTruthy();
		});
		expect(screen.getByText(tr.recurring.confirmEachHint)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("recurringForm.save.button"));
		expect(screen.getByTestId("recurringForm.error.text")).toHaveTextContent(
			tr.recurring.nameRequired,
		);
		await fireEvent.changeText(screen.getByTestId("recurringForm.name.input"), "Spor salonu");
		await fireEvent.changeText(screen.getByTestId("recurringForm.amount.input"), "1200");
		await fireEvent.press(screen.getByTestId("recurringForm.category.health"));
		await fireEvent.press(screen.getByTestId("recurringForm.frequency.weekly"));
		// 11 Ekim 2026 Pazar: the next three Sundays.
		expect(screen.getByTestId("recurringForm.next")).toHaveTextContent("18 Ekim", {
			exact: false,
		});
		expect(screen.getByTestId("recurringForm.next")).toHaveTextContent("1 Kasım", {
			exact: false,
		});
		await fireEvent.press(screen.getByTestId("recurringForm.save.button"));
		await waitFor(() => {
			expect(screen.getByTestId("recurring.item.2")).toHaveTextContent("Spor salonu", {
				exact: false,
			});
		});
		expect(screen.getByTestId("recurring.item.2")).toHaveTextContent("Her hafta Pazar", {
			exact: false,
		});
	});

	it("pauses and deletes a rule", async () => {
		await renderRouter(appRoutes, { initialUrl: "/recurring" });
		await waitFor(() => {
			expect(screen.getByTestId("recurring.item.1")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("recurring.item.1"));
		await waitFor(() => {
			expect(screen.getByTestId("recurringForm.name.input")).toHaveDisplayValue("Kira");
		});
		await fireEvent.press(screen.getByTestId("recurringForm.pause.button"));
		await waitFor(() => {
			expect(screen.getByTestId("recurring.item.1")).toHaveTextContent(tr.recurring.paused, {
				exact: false,
			});
		});
		expect(screen.queryByTestId("recurring.pending")).toBeNull();
		await fireEvent.press(screen.getByTestId("recurring.item.1"));
		await waitFor(() => {
			expect(screen.getByTestId("recurringForm.delete.button")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("recurringForm.delete.button"));
		await fireEvent.press(screen.getByTestId("recurringForm.delete.sheet.confirm.button"));
		await waitFor(() => {
			expect(screen.queryByTestId("recurring.item.1")).toBeNull();
		});
	});
});

describe("Bütçe (39)", () => {
	it("shows the month, the categories and warns near the limit", async () => {
		await renderRouter(appRoutes, { initialUrl: "/budget" });
		await waitFor(() => {
			expect(screen.getByTestId("budget.summary")).toBeTruthy();
		});
		expect(screen.getByText(fill(tr.budget.title, { month: "Ekim" }))).toBeTruthy();
		expect(screen.getByTestId("budget.spent.amount")).toHaveTextContent("842,30 TL");
		expect(screen.getByText(fill(tr.budget.daysLeft, { count: "21" }))).toBeTruthy();
		expect(screen.getByTestId("budget.item.bills")).toHaveTextContent("3.000,00 TL", {
			exact: false,
		});
		expect(screen.queryByTestId("budget.item.bills.badge")).toBeNull();
		await fireEvent.press(screen.getByTestId("budget.tab.warn"));
		expect(screen.getByTestId("budget.warnEmpty")).toBeTruthy();
	});

	it("adds, edits and removes a category limit", async () => {
		await renderRouter(appRoutes, { initialUrl: "/budget" });
		await waitFor(() => {
			expect(screen.getByTestId("budget.item.bills")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("budget.item.bills"));
		await fireEvent.changeText(screen.getByTestId("budget.sheet.limit.input"), "900");
		await fireEvent.press(screen.getByTestId("budget.sheet.save.button"));
		await waitFor(() => {
			expect(screen.getByTestId("budget.item.bills.badge")).toHaveTextContent(
				fill(tr.budget.near, { percent: "94" }),
			);
		});
		await fireEvent.press(screen.getByTestId("budget.tab.warn"));
		expect(screen.getByTestId("budget.item.bills")).toBeTruthy();
		expect(screen.queryByTestId("budget.item.food")).toBeNull();

		await fireEvent.press(screen.getByTestId("budget.tab.all"));
		await fireEvent.press(screen.getByTestId("budget.add.button"));
		await fireEvent.press(screen.getByTestId("budget.sheet.category.rent"));
		await fireEvent.changeText(screen.getByTestId("budget.sheet.limit.input"), "15000");
		await fireEvent.press(screen.getByTestId("budget.sheet.save.button"));
		await waitFor(() => {
			expect(screen.getByTestId("budget.item.rent")).toBeTruthy();
		});

		await fireEvent.press(screen.getByTestId("budget.item.rent"));
		await fireEvent.press(screen.getByTestId("budget.sheet.remove.button"));
		await waitFor(() => {
			expect(screen.queryByTestId("budget.item.rent")).toBeNull();
		});
	});

	it("invites the first limit", async () => {
		provideTestAccountsApi(createTestAccountsApi({ seed: "empty" }));
		await renderRouter(appRoutes, { initialUrl: "/budget" });
		await waitFor(() => {
			expect(screen.getByTestId("budget.empty")).toBeTruthy();
		});
	});
});

describe("Aylık rapor (27)", () => {
	it("opens on the last finished month and moves between months", async () => {
		await renderRouter(appRoutes, { initialUrl: "/menu" });
		await fireEvent.press(screen.getByTestId("menu.module.reports"));
		await waitFor(() => {
			expect(screen.getByTestId("report.month.text")).toHaveTextContent("Eylül 2026");
		});
		expect(screen.getByText(tr.report.lastComplete)).toBeTruthy();
		await waitFor(() => {
			expect(screen.getByTestId("report.breakdown.empty")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("report.next.button"));
		await waitFor(() => {
			expect(screen.getByTestId("report.income.amount")).toHaveTextContent("46.500,00 TL");
		});
		expect(screen.getByText(tr.report.thisMonth)).toBeTruthy();
		expect(screen.getByTestId("report.expense.amount")).toHaveTextContent("842,30 TL");
		expect(screen.getByTestId("report.net.amount")).toHaveTextContent("+45.657,70 TL");
		expect(screen.getByTestId("report.category.bills")).toHaveTextContent("%100", {
			exact: false,
		});
		await waitFor(() => {
			expect(screen.getByTestId("report.balance.payable")).toBeTruthy();
		});
		// The current month is the last one.
		await fireEvent.press(screen.getByTestId("report.next.button"));
		expect(screen.getByTestId("report.month.text")).toHaveTextContent("Ekim 2026");
	});
});
