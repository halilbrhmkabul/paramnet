import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { fill, tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { createTestAccountsApi, provideTestAccountsApi } from "@/testing/providers";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

async function addLoan() {
	await renderRouter(appRoutes, { initialUrl: "/menu" });
	await fireEvent.press(screen.getByTestId("menu.module.loans"));
	await waitFor(() => {
		expect(screen.getByTestId("loans.empty")).toBeTruthy();
	});
	await fireEvent.press(screen.getByTestId("loans.empty.action"));
	await waitFor(() => {
		expect(screen.getByTestId("loanForm.submit.button")).toBeTruthy();
	});
	await fireEvent.press(screen.getByTestId("loanForm.submit.button"));
	expect(screen.getByText(tr.loanForm.bankRequired)).toBeTruthy();
	await fireEvent.changeText(screen.getByTestId("loanForm.bank.input"), "İş Bankası");
	await fireEvent.changeText(screen.getByTestId("loanForm.type.input"), "İhtiyaç kredisi");
	await fireEvent.changeText(screen.getByTestId("loanForm.principal.input"), "10000");
	await fireEvent.changeText(screen.getByTestId("loanForm.rate.input"), "2");
	await fireEvent.changeText(screen.getByTestId("loanForm.term.input"), "3");
	// 10.000 TL, %2, 3 months: the exact annuity (test-vectors/loans.json).
	expect(screen.getByTestId("loanForm.computed")).toHaveTextContent("3.467,55 TL");
	expect(screen.getByTestId("loanForm.total")).toHaveTextContent("10.402,64 TL");
	expect(screen.getByTestId("loanForm.interest")).toHaveTextContent("402,64 TL");
	await fireEvent.press(screen.getByTestId("loanForm.submit.button"));
	await waitFor(() => {
		expect(screen.getByTestId("loans.item.0")).toBeTruthy();
	});
}

describe("Banka kredileri (28, 34)", () => {
	it("adds a loan with its plan and records an installment from an account", async () => {
		await addLoan();
		expect(screen.getByTestId("loans.remaining")).toHaveTextContent("10.000,00 TL");
		expect(screen.getByTestId("loans.monthly")).toHaveTextContent("3.467,55 TL");

		await fireEvent.press(screen.getByTestId("loans.item.0"));
		await waitFor(() => {
			expect(screen.getByTestId("loanDetail.rate")).toHaveTextContent("%2,00");
		});
		expect(screen.getByTestId("loanDetail.panel.remaining")).toHaveTextContent("10.000,00 TL");
		expect(screen.getByTestId("loanDetail.row.3")).toHaveTextContent("0,00 TL", {
			exact: false,
		});
		expect(screen.getByText(tr.loans.paymentsEmpty)).toBeTruthy();

		await fireEvent.press(screen.getByTestId("loanDetail.pay.button"));
		await waitFor(() => {
			expect(screen.getByTestId("loanPay.line")).toHaveTextContent("1. taksit", {
				exact: false,
			});
		});
		expect(screen.getByTestId("loanPay.after")).toHaveTextContent("52.690,15 TL");
		await fireEvent.press(screen.getByTestId("loanPay.submit.button"));
		await waitFor(() => {
			expect(screen.getByTestId("loanDetail.payment.0")).toBeTruthy();
		});
		expect(screen.getByTestId("loanDetail.panel")).toHaveTextContent(
			fill(tr.loans.paidOf, { paid: "1", count: "3" }),
			{ exact: false },
		);
		expect(screen.getByTestId("loanDetail.panel.remaining")).toHaveTextContent("6.732,45 TL");

		await fireEvent.press(screen.getByTestId("loanDetail.payment.0"));
		await waitFor(() => {
			expect(screen.getByTestId("txDetail.effect.text")).toHaveTextContent(
				tr.txDetail.effectLoan,
			);
		});
		expect(screen.queryByTestId("txDetail.edit.button")).toBeNull();
		expect(screen.getByTestId("txDetail.delete.button")).toBeTruthy();
	});

	it("opens Kredi ekle from İşlem merkezi", async () => {
		provideTestAccountsApi(createTestAccountsApi());
		await renderRouter(appRoutes, { initialUrl: "/add" });
		await fireEvent.press(screen.getByTestId("action.loan"));
		await waitFor(() => {
			expect(screen.getByTestId("loanForm.screen")).toBeTruthy();
		});
	});
});
