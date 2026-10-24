import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { fill, tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { createTestAccountsApi, provideTestAccountsApi } from "@/testing/providers";
import { signInForTest } from "@/testing/session";

import { UNDO_MS } from "../TransactionDetailScreen";

beforeEach(() => {
	signInForTest();
});

// Demo seed ids are given in creation order: three accounts, then four records.
const FREELANCE = "00000007-0000-4000-8000-000000000000";
const BILL = "00000006-0000-4000-8000-000000000000";

async function press(...keys: string[]) {
	for (const key of keys) {
		await fireEvent.press(screen.getByTestId(`txForm.key.${key}`));
	}
}

describe("İşlem merkezi (21)", () => {
	it("is the + tab and lists only what exists", async () => {
		await renderRouter(appRoutes, { initialUrl: "/" });
		await fireEvent.press(screen.getByTestId("tabs.new.button"));
		expect(screen.getByTestId("action.screen")).toBeTruthy();
		expect(screen.getByText(tr.action.subtitle)).toBeTruthy();
		for (const id of [
			"action.income",
			"action.expense",
			"action.transfer",
			"action.borrow",
			"action.lend",
			"action.installment",
			"action.recurring",
			"action.loan",
		]) {
			expect(screen.getByTestId(id)).toBeTruthy();
		}
		for (const hidden of ["Para iste", "Hesap böl", "Ödeme kaydet"]) {
			expect(screen.queryByText(hidden)).toBeNull();
		}
	});

	it("starts a loan record and the instalment type picker", async () => {
		await renderRouter(appRoutes, { initialUrl: "/add" });
		await fireEvent.press(screen.getByTestId("action.lend"));
		await waitFor(() => {
			expect(screen.getByTestId("newForm.screen")).toBeTruthy();
		});
	});
});

describe("Gider / Gelir / Transfer (22)", () => {
	it("records an expense typed on the keypad and shows it in the history", async () => {
		const api = createTestAccountsApi();
		provideTestAccountsApi(api);
		await renderRouter(appRoutes, { initialUrl: "/add" });
		await fireEvent.press(screen.getByTestId("action.expense"));
		await waitFor(() => {
			expect(screen.getByTestId("txForm.amount.text")).toBeTruthy();
		});
		expect(screen.getByText(tr.txForm.amountLabel.expense)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("txForm.save.button"));
		expect(screen.getByTestId("txForm.error.text")).toHaveTextContent(tr.txForm.amountRequired);

		await press("3", "5", "0", "comma", "5");
		expect(screen.getByTestId("txForm.amount.text")).toHaveTextContent("−350,50 TL");
		await press("del", "del");
		expect(screen.getByTestId("txForm.amount.text")).toHaveTextContent("−350,00 TL");
		await fireEvent.press(screen.getByTestId("txForm.category.groceries"));
		await fireEvent.changeText(screen.getByTestId("txForm.description.input"), "Migros");
		await fireEvent.press(screen.getByTestId("txForm.account.button"));
		await fireEvent.press(screen.getByTestId("accountPicker.item.1"));
		expect(screen.getByTestId("txForm.account.button")).toHaveTextContent("Nakit Cüzdan", {
			exact: false,
		});
		await fireEvent.press(screen.getByTestId("txForm.save.button"));
		await waitFor(() => {
			expect(screen.getByTestId("action.screen")).toBeTruthy();
		});

		provideTestAccountsApi(api);
		await renderRouter(appRoutes, { initialUrl: "/transactions" });
		await waitFor(() => {
			expect(screen.getByText("Migros")).toBeTruthy();
		});
		expect(screen.getByText(`${tr.categories.expense.groceries} · Nakit Cüzdan`)).toBeTruthy();
	});

	it("switches to income and its categories", async () => {
		await renderRouter(appRoutes, { initialUrl: "/transaction/new?kind=income" });
		await waitFor(() => {
			expect(screen.getByText(tr.txForm.amountLabel.income)).toBeTruthy();
		});
		expect(screen.getByTestId("txForm.category.salary")).toBeTruthy();
		expect(screen.queryByTestId("txForm.category.groceries")).toBeNull();
		await fireEvent.press(screen.getByTestId("txForm.kind.expense"));
		expect(screen.getByTestId("txForm.category.groceries")).toBeTruthy();
	});

	it("moves money between two own accounts, never into the same one", async () => {
		await renderRouter(appRoutes, { initialUrl: "/add" });
		await fireEvent.press(screen.getByTestId("action.transfer"));
		await waitFor(() => {
			expect(screen.getByTestId("txForm.to.button")).toBeTruthy();
		});
		expect(screen.queryByTestId("txForm.category.food")).toBeNull();
		expect(screen.getByText(tr.txForm.amountLabel.transfer)).toBeTruthy();
		await press("1", "0", "0");
		await fireEvent.press(screen.getByTestId("txForm.to.button"));
		await fireEvent.press(screen.getByTestId("accountPicker.item.0"));
		await fireEvent.press(screen.getByTestId("txForm.save.button"));
		expect(screen.getByTestId("txForm.error.text")).toHaveTextContent(tr.txForm.sameAccount);
		await fireEvent.press(screen.getByTestId("txForm.to.button"));
		await fireEvent.press(screen.getByTestId("accountPicker.item.2"));
		await fireEvent.press(screen.getByTestId("txForm.save.button"));
		await waitFor(() => {
			expect(screen.queryByTestId("txForm.screen")).toBeNull();
		});
	});

	it("needs an account first", async () => {
		provideTestAccountsApi(createTestAccountsApi({ seed: "empty" }));
		await renderRouter(appRoutes, { initialUrl: "/transaction/new?kind=expense" });
		await waitFor(() => {
			expect(screen.getByTestId("txForm.noAccount")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("txForm.noAccount.action"));
		await waitFor(() => {
			expect(screen.getByTestId("accountForm.screen")).toBeTruthy();
		});
	});
});

describe("İşlem geçmişi (36)", () => {
	it("groups the month by day, filters and searches", async () => {
		await renderRouter(appRoutes, { initialUrl: "/transactions" });
		await waitFor(() => {
			expect(screen.getByTestId(`txHistory.item.${FREELANCE}`)).toBeTruthy();
		});
		expect(screen.getByTestId("txHistory.month.text")).toHaveTextContent("Ekim 2026");
		expect(screen.getByTestId("txHistory.income.amount")).toHaveTextContent("+46.500,00 TL");
		expect(screen.getByTestId("txHistory.expense.amount")).toHaveTextContent("−842,30 TL");
		expect(screen.getByText("10 Ekim, Cumartesi")).toBeTruthy();
		expect(screen.getByTestId(`txHistory.item.${FREELANCE}.amount`)).toHaveTextContent(
			"+8.000,00 TL",
		);

		await fireEvent.press(screen.getByTestId("txHistory.filter.expense"));
		expect(screen.queryByTestId(`txHistory.item.${FREELANCE}`)).toBeNull();
		expect(screen.getByTestId(`txHistory.item.${BILL}`)).toBeTruthy();

		await fireEvent.press(screen.getByTestId("txHistory.filter.all"));
		await fireEvent.changeText(screen.getByTestId("txHistory.search.input"), "elektrik");
		expect(screen.getByTestId(`txHistory.item.${BILL}`)).toBeTruthy();
		expect(screen.queryByTestId(`txHistory.item.${FREELANCE}`)).toBeNull();

		await fireEvent.press(screen.getByTestId("txHistory.prev.button"));
		await waitFor(() => {
			expect(screen.getByTestId("txHistory.empty")).toHaveTextContent(
				fill(tr.txHistory.empty, { month: "Eylül" }),
			);
		});
	});
});

describe("İşlem detayı (37)", () => {
	async function openBill() {
		await renderRouter(appRoutes, { initialUrl: "/transactions" });
		await waitFor(() => {
			expect(screen.getByTestId(`txHistory.item.${BILL}`)).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId(`txHistory.item.${BILL}`));
		await waitFor(() => {
			expect(screen.getByTestId("txDetail.title.text")).toHaveTextContent(
				"Elektrik faturası",
			);
		});
	}

	it("shows what was recorded and what it did", async () => {
		await openBill();
		expect(screen.getByTestId("txDetail.amount.text")).toHaveTextContent("−842,30 TL");
		expect(screen.getByTestId("txDetail.category.value")).toHaveTextContent(
			tr.categories.expense.bills,
		);
		expect(screen.getByTestId("txDetail.account.value")).toHaveTextContent("Maaş Hesabı");
		expect(screen.getByTestId("txDetail.date.value")).toHaveTextContent("8 Ekim 2026");
		expect(screen.getByTestId("txDetail.ref.value")).toHaveTextContent("TRX-00000006");
		expect(screen.getByTestId("txDetail.effect.text")).toHaveTextContent(
			fill(tr.txDetail.effect.expense, { account: "Maaş Hesabı" }),
		);
		expect(screen.getByTestId("txDetail.created.text")).toBeTruthy();
		expect(screen.queryByTestId("txDetail.lastEdit.text")).toBeNull();
	});

	it("edits the category and writes it to the history", async () => {
		await openBill();
		await fireEvent.press(screen.getByTestId("txDetail.edit.button"));
		await waitFor(() => {
			expect(screen.getByTestId("txForm.amount.text")).toHaveTextContent("−842,30 TL");
		});
		await fireEvent.press(screen.getByTestId("txForm.category.rent"));
		await fireEvent.press(screen.getByTestId("txForm.save.button"));
		await waitFor(() => {
			expect(screen.getByTestId("txDetail.lastEdit.text")).toHaveTextContent(
				"kategori “Fatura” → “Kira”",
				{ exact: false },
			);
		});
		expect(screen.getByTestId("txDetail.category.value")).toHaveTextContent(
			tr.categories.expense.rent,
		);
	});

	it("deletes after a confirmation and can be undone", async () => {
		await openBill();
		await fireEvent.press(screen.getByTestId("txDetail.delete.button"));
		expect(
			screen.getByText(
				fill(tr.txDetail.deleteBody, {
					title: "Elektrik faturası",
					amount: "−842,30 TL",
					account: "Maaş Hesabı",
				}),
			),
		).toBeTruthy();
		await fireEvent.press(screen.getByTestId("txDetail.delete.sheet.confirm.button"));
		await waitFor(() => {
			expect(screen.getByTestId("txDetail.deleted.banner")).toBeTruthy();
		});
		await waitFor(() => {
			expect(screen.getByTestId("txDetail.deleted.badge")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("txDetail.undo.button"));
		await waitFor(() => {
			expect(screen.queryByTestId("txDetail.deleted.banner")).toBeNull();
		});
		await waitFor(() => {
			expect(screen.queryByTestId("txDetail.deleted.badge")).toBeNull();
		});
		expect(screen.getByTestId("txDetail.delete.button")).toBeTruthy();
	});

	it("goes back once the undo window has passed", async () => {
		jest.useFakeTimers();
		try {
			await openBill();
			await fireEvent.press(screen.getByTestId("txDetail.delete.button"));
			await fireEvent.press(screen.getByTestId("txDetail.delete.sheet.confirm.button"));
			await waitFor(() => {
				expect(screen.getByTestId("txDetail.deleted.banner")).toBeTruthy();
			});
			await act(async () => {
				await jest.advanceTimersByTimeAsync(UNDO_MS);
			});
			await waitFor(() => {
				expect(screen.getByTestId("txHistory.screen")).toBeTruthy();
			});
			await waitFor(() => {
				expect(screen.queryByTestId(`txHistory.item.${BILL}`)).toBeNull();
			});
		} finally {
			jest.useRealTimers();
		}
	});
});

describe("Ana Sayfa · Toplam Nakit (03)", () => {
	it("shows the total, the month and hides the amounts on request", async () => {
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(screen.getByTestId("home.cash.amount")).toHaveTextContent("67.257,70 TL");
		});
		expect(screen.getByTestId("home.cash.income")).toHaveTextContent("46.500,00 TL");
		expect(screen.getByTestId("home.cash.expense")).toHaveTextContent("842,30 TL");
		await fireEvent.press(screen.getByTestId("home.cash.toggle"));
		expect(screen.getByTestId("home.cash.amount")).toHaveTextContent(tr.accounts.hidden);
		await fireEvent.press(screen.getByTestId("home.cash.link"));
		await waitFor(() => {
			expect(screen.getByTestId("accounts.screen")).toBeTruthy();
		});
	});

	it("invites the first account", async () => {
		provideTestAccountsApi(createTestAccountsApi({ seed: "empty" }));
		await renderRouter(appRoutes, { initialUrl: "/" });
		await waitFor(() => {
			expect(screen.getByTestId("home.cash.empty")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("home.cash.empty"));
		await waitFor(() => {
			expect(screen.getByTestId("accountForm.screen")).toBeTruthy();
		});
	});
});
