import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { ApiError } from "@/api/errors";
import { fill, tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { createTestAccountsApi, provideTestAccountsApi } from "@/testing/providers";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

async function openAccounts() {
	await renderRouter(appRoutes, { initialUrl: "/accounts" });
	await waitFor(() => {
		expect(screen.getByTestId("accounts.item.0")).toBeTruthy();
	});
}

describe("Hesaplar (29)", () => {
	it("shows Toplam Nakit, the accounts and the selected account's month", async () => {
		await openAccounts();
		expect(screen.getByTestId("accounts.total.amount")).toHaveTextContent("67.257,70 TL");
		expect(screen.getByText(fill(tr.accounts.totalWithCount, { count: "3" }))).toBeTruthy();
		expect(screen.getByText(tr.accounts.manualNote)).toBeTruthy();
		expect(screen.getByTestId("accounts.item.0")).toHaveTextContent("Maaş Hesabı", {
			exact: false,
		});
		expect(screen.getByTestId("accounts.item.0.balance")).toHaveTextContent("56.157,70 TL");
		expect(screen.getByTestId("accounts.item.1.balance")).toHaveTextContent("4.600,00 TL");
		await waitFor(() => {
			expect(screen.getByTestId("accounts.movement.0")).toBeTruthy();
		});
		expect(
			screen.getByText(fill(tr.accounts.movements, { name: "Maaş Hesabı", month: "Ekim" })),
		).toBeTruthy();
		expect(screen.getByTestId("accounts.movement.0.amount")).toHaveTextContent("+8.000,00 TL");

		await fireEvent.press(screen.getByTestId("accounts.item.1"));
		await waitFor(() => {
			expect(
				screen.getByText(
					fill(tr.accounts.movements, { name: "Nakit Cüzdan", month: "Ekim" }),
				),
			).toBeTruthy();
		});
		// The transfer from Maaş Hesabı is the cash wallet's only record this month.
		await waitFor(() => {
			expect(screen.getByTestId("accounts.movement.0.amount")).toHaveTextContent(
				"2.000,00 TL",
			);
		});
		expect(screen.queryByTestId("accounts.movement.1")).toBeNull();
	});

	it("invites the first account when there is none", async () => {
		provideTestAccountsApi(createTestAccountsApi({ seed: "empty" }));
		await renderRouter(appRoutes, { initialUrl: "/accounts" });
		await waitFor(() => {
			expect(screen.getByTestId("accounts.empty")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("accounts.empty.action"));
		await waitFor(() => {
			expect(screen.getByTestId("accountForm.screen")).toBeTruthy();
		});
	});

	it("offers a retry when the list fails", async () => {
		const api = createTestAccountsApi();
		let fail = true;
		const list = api.listAccounts.bind(api);
		api.listAccounts = () => (fail ? Promise.reject(new ApiError("network")) : list());
		provideTestAccountsApi(api);
		await renderRouter(appRoutes, { initialUrl: "/accounts" });
		await waitFor(() => {
			expect(screen.getByTestId("accounts.error")).toBeTruthy();
		});
		expect(screen.getByText(tr.error.offline)).toBeTruthy();
		fail = false;
		await fireEvent.press(screen.getByTestId("accounts.error.retry.button"));
		await waitFor(() => {
			expect(screen.getByTestId("accounts.item.0")).toBeTruthy();
		});
	});
});

describe("Hesap ekle (33)", () => {
	it("adds a cash wallet without a bank and counts it in Toplam Nakit", async () => {
		await openAccounts();
		await fireEvent.press(screen.getByTestId("accounts.add.button"));
		await waitFor(() => {
			expect(screen.getByTestId("accountForm.screen")).toBeTruthy();
		});
		expect(screen.getByTestId("accountForm.bank.input")).toBeTruthy();
		expect(screen.getByText(tr.accountForm.bankHint)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("accountForm.type.cash"));
		expect(screen.queryByTestId("accountForm.bank.input")).toBeNull();
		expect(screen.getByText(tr.accountForm.openingHint)).toBeTruthy();

		await fireEvent.press(screen.getByTestId("accountForm.submit.button"));
		expect(screen.getByText(tr.accountForm.nameRequired)).toBeTruthy();

		await fireEvent.changeText(screen.getByTestId("accountForm.name.input"), "Ev kasası");
		await fireEvent.changeText(screen.getByTestId("accountForm.opening.input"), "500");
		await fireEvent.press(screen.getByTestId("accountForm.submit.button"));
		await waitFor(() => {
			expect(screen.getByTestId("accounts.item.3")).toHaveTextContent("Ev kasası", {
				exact: false,
			});
		});
		expect(screen.getByTestId("accounts.total.amount")).toHaveTextContent("67.757,70 TL");
	});

	it("keeps a negative opening balance and an account left out of the total", async () => {
		await openAccounts();
		await fireEvent.press(screen.getByTestId("accounts.add.button"));
		await waitFor(() => {
			expect(screen.getByTestId("accountForm.screen")).toBeTruthy();
		});
		await fireEvent.changeText(screen.getByTestId("accountForm.name.input"), "Ek hesap");
		await fireEvent.changeText(screen.getByTestId("accountForm.opening.input"), "100");
		await fireEvent.press(screen.getByTestId("accountForm.negative.checkbox"));
		await fireEvent.press(screen.getByTestId("accountForm.include.switch"));
		await fireEvent.press(screen.getByTestId("accountForm.submit.button"));
		await waitFor(() => {
			expect(screen.getByTestId("accounts.item.3.balance")).toHaveTextContent("-100,00 TL");
		});
		expect(screen.getByTestId("accounts.item.3")).toHaveTextContent(tr.accounts.excluded, {
			exact: false,
		});
		expect(screen.getByTestId("accounts.total.amount")).toHaveTextContent("67.257,70 TL");
	});

	it("edits and archives the selected account", async () => {
		await openAccounts();
		await fireEvent.press(screen.getByTestId("accounts.item.2"));
		await fireEvent.press(screen.getByTestId("accounts.edit.button"));
		await waitFor(() => {
			expect(screen.getByTestId("accountForm.name.input")).toHaveDisplayValue(
				"Birikim Hesabı",
			);
		});
		await fireEvent.press(screen.getByTestId("accountForm.archive.button"));
		expect(
			screen.getByText(fill(tr.accountForm.archiveBody, { name: "Birikim Hesabı" })),
		).toBeTruthy();
		await fireEvent.press(screen.getByTestId("accountForm.archive.sheet.confirm.button"));
		await waitFor(() => {
			expect(screen.getByTestId("accounts.screen")).toBeTruthy();
		});
		await waitFor(() => {
			expect(screen.queryByText("Birikim Hesabı")).toBeNull();
		});
		expect(screen.getByTestId("accounts.total.amount")).toHaveTextContent("60.757,70 TL");
	});
});

describe("Bakiye düzelt", () => {
	it("records the difference to the typed balance", async () => {
		await openAccounts();
		await fireEvent.press(screen.getByTestId("accounts.item.1"));
		await fireEvent.press(screen.getByTestId("accounts.adjust.button"));
		await waitFor(() => {
			expect(screen.getByTestId("adjust.current.amount")).toHaveTextContent("4.600,00 TL");
		});
		expect(screen.getByText(tr.adjust.body)).toBeTruthy();
		await fireEvent.changeText(screen.getByTestId("adjust.target.input"), "4500");
		expect(screen.getByTestId("adjust.difference.text")).toHaveTextContent(
			fill(tr.adjust.difference, { amount: "−100,00 TL" }),
		);
		await fireEvent.press(screen.getByTestId("adjust.submit.button"));
		await waitFor(() => {
			expect(screen.getByTestId("accounts.item.1.balance")).toHaveTextContent("4.500,00 TL");
		});
	});

	it("says so when the balance is already right", async () => {
		await openAccounts();
		await fireEvent.press(screen.getByTestId("accounts.item.1"));
		await fireEvent.press(screen.getByTestId("accounts.adjust.button"));
		await waitFor(() => {
			expect(screen.getByTestId("adjust.current.amount")).toBeTruthy();
		});
		await fireEvent.changeText(screen.getByTestId("adjust.target.input"), "4600");
		await fireEvent.press(screen.getByTestId("adjust.submit.button"));
		await waitFor(() => {
			expect(screen.getByText(tr.error.noChange)).toBeTruthy();
		});
	});
});
