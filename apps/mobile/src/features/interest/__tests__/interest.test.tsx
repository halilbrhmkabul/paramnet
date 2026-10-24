import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { createTestAccountsApi, provideTestAccountsApi } from "@/testing/providers";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

// The demo card: 12.450 TL statement, %40 minimum (4.980 TL), cut on the 9th (31 days to the next cut).
const CARD = "00000010-0000-4000-8000-000000000000";

describe("Faiz simülasyonu (10)", () => {
	it("estimates the interest left after the minimum, as in the design", async () => {
		await renderRouter(appRoutes, { initialUrl: `/cards/${CARD}` });
		await waitFor(() => {
			expect(screen.getByTestId("cardDetail.simulate.button")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("cardDetail.simulate.button"));
		await waitFor(() => {
			expect(screen.getByTestId("interest.card.amount")).toBeTruthy();
		});
		expect(screen.getByTestId("interest.disclaimer")).toHaveTextContent(
			tr.interest.disclaimerTitle,
			{
				exact: false,
			},
		);
		// 7.470 TL × %3,75 × 31/30 = 289,46 TL; KKDF and BSMV 43,42 TL each.
		expect(screen.getByTestId("interest.card.remaining")).toHaveTextContent("7.470,00 TL");
		expect(screen.getByTestId("interest.card.interest")).toHaveTextContent("289,46 TL");
		expect(screen.getByTestId("interest.card.kkdf")).toHaveTextContent("43,42 TL");
		expect(screen.getByTestId("interest.card.amount")).toHaveTextContent("376,30 TL");

		await fireEvent.press(screen.getByTestId("interest.option.full"));
		expect(screen.getByTestId("interest.card.amount")).toHaveTextContent("0,00 TL");
		expect(screen.getByTestId("interest.formula")).toHaveTextContent(tr.interest.formulaPaid);

		await fireEvent.press(screen.getByTestId("interest.option.min"));
		await fireEvent.changeText(screen.getByTestId("interest.rate.input"), "x");
		expect(screen.getByTestId("interest.invalid")).toBeTruthy();
	});

	it("shows what closing a loan early takes", async () => {
		const api = createTestAccountsApi();
		await api.createLoan(
			{
				bank_name: "İş Bankası",
				loan_type: "İhtiyaç kredisi",
				principal_minor: 1000000,
				monthly_rate_bps: 200,
				term_months: 3,
				first_due_on: "2026-11-15",
				installment_minor: 350000,
				payment_account_id: null,
			},
			"loan",
		);
		provideTestAccountsApi(api);
		await renderRouter(appRoutes, { initialUrl: "/interest" });
		await waitFor(() => {
			expect(screen.getByTestId("interest.pick.loan.0")).toBeTruthy();
		});
		expect(screen.getByTestId("interest.pick.card.0")).toBeTruthy();
		await fireEvent.press(screen.getByTestId("interest.pick.loan.0"));
		await waitFor(() => {
			expect(screen.getByTestId("interest.loan.amount")).toHaveTextContent("10.100,00 TL");
		});
		expect(screen.getByTestId("interest.loan.fee")).toHaveTextContent("100,00 TL");
		expect(screen.getByTestId("interest.loan.saved")).toHaveTextContent("300,68 TL");
	});
});
