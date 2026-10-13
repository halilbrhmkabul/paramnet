import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";

import { SEED_IDS } from "@/api/mock/seed";
import { tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { createTestApi, provideTestApi } from "@/testing/providers";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

async function openDebts() {
	await renderRouter(appRoutes, { initialUrl: "/" });
	await fireEvent.press(screen.getByTestId("tabs.debts"));
	await waitFor(() => {
		expect(screen.getByTestId("debts.screen")).toBeTruthy();
	});
}

describe("Borçlarım / Alacaklarım (design 12, F4-01c)", () => {
	it("starts on what I owe: total with its note, then personal debts and installments", async () => {
		await openDebts();
		await waitFor(() => {
			expect(screen.getByTestId("debts.total.amount")).toHaveTextContent("₺22.500,00");
		});
		expect(screen.getByTestId("debts.tab.payable")).toBeSelected();
		expect(screen.getByText(tr.debts.notePayable)).toBeTruthy();
		expect(screen.getByText(tr.debts.sectionPayable)).toBeTruthy();

		const furniture = screen.getByTestId(`debts.item.${SEED_IDS.yildizFurniture}`);
		expect(within(furniture).getByText("Mobilya")).toBeTruthy();
		expect(within(furniture).getByText("Yıldız Mobilya · Elden taksit")).toBeTruthy();
		expect(within(furniture).getByText("/ ₺28.000,00")).toBeTruthy();
		expect(within(furniture).getByText("1. taksit 11 Ekim")).toBeTruthy();
		expect(within(furniture).getByText("0/5 ödendi")).toBeTruthy();
		expect(
			within(furniture).getByTestId(`debts.item.${SEED_IDS.yildizFurniture}.progress`),
		).toBeTruthy();

		// A personal loan is titled by the person, like the design.
		const elif = screen.getByTestId(`debts.item.${SEED_IDS.elifLoan}`);
		expect(within(elif).getByText("Elif Kaya")).toBeTruthy();
		expect(within(elif).getByText("Kişisel borç · Vadesiz")).toBeTruthy();
		expect(screen.queryByTestId(`debts.item.${SEED_IDS.ahmetLoan}`)).toBeNull();
	});

	it("switches to what I am owed: days overdue, people, closed agreements apart", async () => {
		await openDebts();
		await fireEvent.press(screen.getByTestId("debts.tab.receivable"));
		await waitFor(() => {
			expect(screen.getByTestId("debts.total.amount")).toHaveTextContent("₺15.500,00");
		});
		expect(screen.getByText(tr.debts.sectionReceivable)).toBeTruthy();
		const ahmet = screen.getByTestId(`debts.item.${SEED_IDS.ahmetLoan}`);
		expect(within(ahmet).getByText("Ahmet Yılmaz")).toBeTruthy();
		expect(within(ahmet).getByText("10 gün gecikti")).toBeTruthy();
		expect(screen.getByTestId(`debts.item.${SEED_IDS.mertSale}`)).toBeTruthy();
		expect(screen.getByTestId("debts.closed")).toHaveTextContent(tr.debts.closed, {
			exact: false,
		});
		expect(screen.getByTestId(`debts.closed.${SEED_IDS.mertLoan}`)).toBeTruthy();
	});

	it("opens an agreement", async () => {
		await openDebts();
		await waitFor(() => {
			expect(screen.getByTestId(`debts.item.${SEED_IDS.elifLoan}`)).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId(`debts.item.${SEED_IDS.elifLoan}`));
		await waitFor(() => {
			expect(screen.getByTestId("agreement.screen")).toBeTruthy();
		});
	});

	it("the + button starts a new record", async () => {
		await openDebts();
		await fireEvent.press(screen.getByTestId("debts.new.button"));
		await waitFor(() => {
			expect(screen.getByTestId("new.screen")).toBeTruthy();
		});
	});

	it("asking for money is shown but not available yet", async () => {
		await openDebts();
		const request = await screen.findByTestId("debts.action.request");
		expect(request).toBeDisabled();
		expect(request).toHaveTextContent(tr.common.soon, { exact: false });
	});

	it("reaches people from the receivable side", async () => {
		await openDebts();
		await fireEvent.press(screen.getByTestId("debts.tab.receivable"));
		await fireEvent.press(await screen.findByTestId("debts.action.contacts"));
		await waitFor(() => {
			expect(screen.getByTestId("contacts.screen")).toBeTruthy();
		});
	});

	it("empty: says what to do and starts the right template", async () => {
		provideTestApi(createTestApi({ seed: "empty" }));
		await openDebts();
		await waitFor(() => {
			expect(screen.getByTestId("debts.empty")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("debts.action.borrowed"));
		await waitFor(() => {
			expect(screen.getByTestId("newForm.screen")).toBeTruthy();
		});
	});
});
