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

describe("Borçlarım / Alacaklarım (design 12, F3-11)", () => {
	it("starts on what I owe: total, open agreements with progress, nothing I am owed", async () => {
		await openDebts();
		await waitFor(() => {
			expect(screen.getByTestId("debts.total.amount")).toHaveTextContent("22.500,00 TL");
		});
		expect(screen.getByTestId("debts.tab.payable")).toBeSelected();
		const furniture = screen.getByTestId(`debts.item.${SEED_IDS.yildizFurniture}`);
		expect(within(furniture).getByText("Mobilya")).toBeTruthy();
		expect(
			within(furniture).getByTestId(`debts.item.${SEED_IDS.yildizFurniture}.progress`),
		).toBeTruthy();
		expect(screen.getByTestId(`debts.item.${SEED_IDS.elifLoan}`)).toBeTruthy();
		expect(screen.queryByTestId(`debts.item.${SEED_IDS.ahmetLoan}`)).toBeNull();
	});

	it("switches to what I am owed, with closed agreements apart", async () => {
		await openDebts();
		await fireEvent.press(screen.getByTestId("debts.tab.receivable"));
		await waitFor(() => {
			expect(screen.getByTestId("debts.total.amount")).toHaveTextContent("15.500,00 TL");
		});
		expect(screen.getByTestId(`debts.item.${SEED_IDS.ahmetLoan}`)).toBeTruthy();
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

	it("reaches people from here", async () => {
		await openDebts();
		await fireEvent.press(screen.getByTestId("debts.contacts.button"));
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
