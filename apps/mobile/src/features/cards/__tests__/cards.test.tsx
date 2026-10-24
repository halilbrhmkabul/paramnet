import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { fill, tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { createTestAccountsApi, provideTestAccountsApi } from "@/testing/providers";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

// The demo card: Yapı Kredi World ••4281, limit 60.000 TL, 12.450 TL owed when added, cut on the 9th.
const CARD = "00000010-0000-4000-8000-000000000000";

async function openCards() {
	await renderRouter(appRoutes, { initialUrl: "/" });
	await fireEvent.press(screen.getByTestId("tabs.cards"));
	await waitFor(() => {
		expect(screen.getByTestId("cards.item.0")).toBeTruthy();
	});
}

describe("Kartlarım (07)", () => {
	it("shows the totals, the statement and the days to the payment date", async () => {
		await openCards();
		expect(screen.getByTestId("cards.totalDebt")).toHaveTextContent("12.450,00 TL");
		expect(screen.getByTestId("cards.available")).toHaveTextContent("47.550,00 TL");
		expect(screen.getByTestId("cards.limit")).toHaveTextContent("60.000,00 TL");
		expect(screen.getByText(tr.cards.note)).toBeTruthy();
		expect(screen.getByTestId("cards.item.0")).toHaveTextContent("4.980,00 TL", {
			exact: false,
		});
		expect(screen.getByTestId("cards.item.0.due")).toHaveTextContent(
			fill(tr.cards.daysLeft, { count: "8" }),
		);
	});

	it("invites the first card", async () => {
		provideTestAccountsApi(createTestAccountsApi({ seed: "empty" }));
		await renderRouter(appRoutes, { initialUrl: "/cards" });
		await waitFor(() => {
			expect(screen.getByTestId("cards.empty")).toBeTruthy();
		});
	});
});

describe("Kart ekle (32)", () => {
	it("asks only for the last four digits and suggests the minimum rate", async () => {
		await openCards();
		await fireEvent.press(screen.getByTestId("cards.add.button"));
		await waitFor(() => {
			expect(screen.getByTestId("cardForm.screen")).toBeTruthy();
		});
		expect(screen.getByText(tr.cardForm.last4Hint)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("cardForm.submit.button"));
		expect(screen.getByText(tr.cardForm.bankRequired)).toBeTruthy();
		expect(screen.getByText(tr.cardForm.last4Invalid)).toBeTruthy();

		await fireEvent.changeText(screen.getByTestId("cardForm.bank.input"), "İş Bankası");
		await fireEvent.changeText(screen.getByTestId("cardForm.name.input"), "Maximum");
		await fireEvent.changeText(screen.getByTestId("cardForm.last4.input"), "73a02");
		expect(screen.getByTestId("cardForm.last4.input")).toHaveDisplayValue("7302");
		await fireEvent.changeText(screen.getByTestId("cardForm.limit.input"), "40000");
		expect(screen.getByTestId("cardForm.rate.input")).toHaveDisplayValue("20");
		await fireEvent.changeText(screen.getByTestId("cardForm.cut.input"), "22");
		await fireEvent.press(screen.getByTestId("cardForm.color.bordeaux"));
		await fireEvent.press(screen.getByTestId("cardForm.submit.button"));
		await waitFor(() => {
			expect(screen.getByTestId("cards.item.1")).toBeTruthy();
		});
		expect(screen.getByTestId("cards.limit")).toHaveTextContent("100.000,00 TL");
	});
});

describe("Kart detayı (08) and ödeme (09, 11)", () => {
	async function openCard() {
		await openCards();
		await fireEvent.press(screen.getByTestId("cards.item.0"));
		await waitFor(() => {
			expect(screen.getByTestId("cardDetail.statement.amount")).toHaveTextContent(
				"12.450,00 TL",
			);
		});
	}

	it("shows the statement, the card's terms and the empty tabs", async () => {
		await openCard();
		expect(screen.getByTestId("cardDetail.totalDebt")).toHaveTextContent("12.450,00 TL");
		expect(screen.getByTestId("cardDetail.status")).toHaveTextContent(
			tr.cardDetail.status.unpaid,
		);
		expect(screen.getByTestId("cardDetail.minimum")).toHaveTextContent("4.980,00 TL");
		expect(screen.getByTestId("cardDetail.due")).toHaveTextContent("19 Ekim, Pazartesi");
		expect(screen.getByText(fill(tr.cardDetail.cutDayValue, { day: "9’u" }))).toBeTruthy();
		expect(screen.getByText(tr.cardDetail.periodEmpty)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("cardDetail.tab.installments"));
		expect(screen.getByTestId("cardDetail.installments.empty")).toBeTruthy();
		await fireEvent.press(screen.getByTestId("cardDetail.tab.history"));
		expect(screen.getByTestId("cardDetail.history.empty")).toBeTruthy();
	});

	it("records a full payment from an account and can undo it", async () => {
		await openCard();
		await fireEvent.press(screen.getByTestId("cardDetail.pay.button"));
		await waitFor(() => {
			expect(screen.getByTestId("cardPay.option.full")).toBeTruthy();
		});
		expect(screen.getByTestId("cardPay.remaining")).toHaveTextContent("0,00 TL");
		expect(screen.getByTestId("cardPay.after")).toHaveTextContent("43.707,70 TL");
		await fireEvent.press(screen.getByTestId("cardPay.option.min"));
		expect(screen.getByTestId("cardPay.remaining")).toHaveTextContent("7.470,00 TL");
		expect(screen.getByTestId("cardPay.partialNote")).toBeTruthy();
		await fireEvent.press(screen.getByTestId("cardPay.option.full"));
		await fireEvent.press(screen.getByTestId("cardPay.submit.button"));
		await waitFor(() => {
			expect(screen.getByTestId("cardPaid.amount")).toHaveTextContent("12.450,00 TL");
		});
		expect(screen.getByTestId("cardPaid.remaining")).toHaveTextContent(
			fill(tr.cardPaid.closed, { amount: "0,00 TL" }),
		);
		expect(screen.getByTestId("cardPaid.account")).toHaveTextContent(
			"56.157,70 TL → 43.707,70 TL",
		);
		expect(screen.getByText(tr.cardPaid.note)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("cardPaid.undo.button"));
		await waitFor(() => {
			expect(screen.getByTestId("cardDetail.remaining")).toHaveTextContent("12.450,00 TL");
		});
	});
});

describe("Kartla harcama (22, 37)", () => {
	it("puts a purchase on the card in instalments; Toplam Nakit does not move", async () => {
		const api = createTestAccountsApi();
		provideTestAccountsApi(api);
		await renderRouter(appRoutes, { initialUrl: "/add" });
		await fireEvent.press(screen.getByTestId("action.expense"));
		await waitFor(() => {
			expect(screen.getByTestId("txForm.account.button")).toBeTruthy();
		});
		for (const key of ["9", "0", "0", "0"]) {
			await fireEvent.press(screen.getByTestId(`txForm.key.${key}`));
		}
		await fireEvent.press(screen.getByTestId("txForm.account.button"));
		await fireEvent.press(screen.getByTestId("accountPicker.card.0"));
		expect(screen.getByTestId("txForm.account.button")).toHaveTextContent(
			"Yapı Kredi World ••4281",
			{ exact: false },
		);
		await fireEvent.press(screen.getByTestId("txForm.installments.3"));
		await fireEvent.changeText(screen.getByTestId("txForm.description.input"), "Teknosa");
		await fireEvent.press(screen.getByTestId("txForm.save.button"));
		await waitFor(() => {
			expect(screen.queryByTestId("txForm.screen")).toBeNull();
		});

		provideTestAccountsApi(api);
		await renderRouter(appRoutes, { initialUrl: "/cards" });
		await waitFor(() => {
			expect(screen.getByTestId("cards.available")).toHaveTextContent("38.550,00 TL");
		});

		provideTestAccountsApi(api);
		await renderRouter(appRoutes, { initialUrl: `/cards/${CARD}` });
		await waitFor(() => {
			expect(screen.getByTestId("cardDetail.totalDebt")).toHaveTextContent("15.450,00 TL");
		});
		await fireEvent.press(screen.getByTestId("cardDetail.tab.installments"));
		expect(screen.getByTestId("cardDetail.installment.0")).toHaveTextContent("Teknosa", {
			exact: false,
		});
		expect(screen.getByTestId("cardDetail.installment.0")).toHaveTextContent("0/3 taksit", {
			exact: false,
		});

		provideTestAccountsApi(api);
		await renderRouter(appRoutes, { initialUrl: "/accounts" });
		await waitFor(() => {
			expect(screen.getByTestId("accounts.total.amount")).toHaveTextContent("67.257,70 TL");
		});
	});

	it("says on the record that the card owes it, not an account", async () => {
		const api = createTestAccountsApi();
		await api.createTransaction(
			{
				kind: "expense",
				account_id: null,
				to_account_id: null,
				card_id: CARD,
				to_card_id: null,
				installments: 3,
				amount_minor: 900000,
				category: "groceries",
				title: "Teknosa",
				note: null,
				occurred_on: "2026-10-11",
			},
			"card-tx",
		);
		provideTestAccountsApi(api);
		await renderRouter(appRoutes, { initialUrl: "/transactions" });
		await waitFor(() => {
			expect(screen.getByText("Teknosa")).toBeTruthy();
		});
		expect(
			screen.getByText(`${tr.categories.expense.groceries} · Yapı Kredi World ••4281`),
		).toBeTruthy();
		await fireEvent.press(screen.getByText("Teknosa"));
		await waitFor(() => {
			expect(screen.getByTestId("txDetail.effect.text")).toHaveTextContent(
				tr.txDetail.effectCard,
			);
		});
		expect(screen.getByTestId("txDetail.installments.value")).toHaveTextContent("3 taksit");
		expect(screen.getByTestId("txDetail.account.value")).toHaveTextContent(
			"Yapı Kredi World ••4281",
		);
	});
});
