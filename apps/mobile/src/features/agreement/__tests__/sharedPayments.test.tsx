import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { SEED_IDS } from "@/api/mock/seed";
import { fill, tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { createTestApi, provideTestApi } from "@/testing/providers";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

// Ahmet's loan as a shared, active agreement where Ahmet reported a 1.000 TL payment.
function apiWithReportedPayment() {
	const api = createTestApi();
	const loan = api.state.agreements.find((a) => a.id === SEED_IDS.ahmetLoan);
	if (loan === undefined) {
		throw new Error("seed changed");
	}
	loan.status = "active";
	loan.payments.push({
		id: "reported-1",
		amount_minor: 100000,
		paid_on: "2026-10-10",
		method: "transfer",
		kind: "payment",
		status: "reported",
		note: "EFT",
		created_at: "2026-10-10T12:00:00.000Z",
		by_me: false,
	});
	provideTestApi(api);
	return api;
}

describe("Payments on a shared agreement (F2-07)", () => {
	it("the debtor reports a payment: it waits for the creditor and can be taken back", async () => {
		await renderRouter(appRoutes, { initialUrl: `/agreement/${SEED_IDS.zeynepShare}/decide` });
		await waitFor(() => {
			expect(screen.getByTestId("decide.accept.button")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("decide.accept.button"));
		await waitFor(() => {
			expect(screen.getByTestId("agreement.primaryAction.button")).toHaveTextContent(
				tr.payment.made,
			);
		});

		await fireEvent.press(screen.getByTestId("agreement.primaryAction.button"));
		await waitFor(() => {
			expect(screen.getByTestId("payment.reportHelper")).toHaveTextContent(
				tr.payment.reportHelper,
			);
		});
		await fireEvent.changeText(screen.getByTestId("payment.amount.input"), "2000");
		await fireEvent.press(screen.getByTestId("payment.save.button"));
		await waitFor(() => {
			expect(screen.getByTestId("payment.done.button")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("payment.done.button"));

		await waitFor(() => {
			expect(screen.getByTestId("agreement.awaiting.text")).toHaveTextContent(
				fill(tr.payment.awaiting, { amount: "2.000,00 TL" }),
			);
		});
		expect(screen.getByTestId("agreement.outstanding.text")).toHaveTextContent("6.000,00 TL");
		const withdraw = screen.getByTestId(/^agreement\.payment\..+\.withdraw$/);
		await fireEvent.press(withdraw);
		await waitFor(() => {
			expect(screen.queryByTestId("agreement.awaiting.text")).toBeNull();
		});
		expect(screen.getByText(tr.payment.statuses.withdrawn)).toBeTruthy();
	});

	it("the creditor sees it in Talepler and confirms; the balance drops", async () => {
		apiWithReportedPayment();
		await renderRouter(appRoutes, { initialUrl: "/requests" });
		await waitFor(() => {
			expect(screen.getByTestId("requests.section.payment")).toBeTruthy();
		});
		expect(screen.getByTestId("requests.item.reported-1")).toHaveTextContent(
			fill(tr.requests.paymentReported, { name: "Ahmet Yılmaz", amount: "1.000,00 TL" }),
			{ exact: false },
		);
		await fireEvent.press(screen.getByTestId("requests.item.reported-1"));
		await waitFor(() => {
			expect(screen.getByTestId("agreement.awaiting.text")).toBeTruthy();
		});
		expect(screen.getByTestId("agreement.primaryAction.button")).toHaveTextContent(
			tr.payment.received,
		);

		await fireEvent.press(screen.getByTestId("agreement.payment.reported-1.confirm"));
		await waitFor(() => {
			expect(screen.getByTestId("agreement.outstanding.text")).toHaveTextContent(
				"5.500,00 TL",
			);
		});
		expect(screen.queryByTestId("agreement.awaiting.text")).toBeNull();
	});

	it('"Bu ödemeyi almadım" leaves the balance as it was', async () => {
		const api = apiWithReportedPayment();
		await renderRouter(appRoutes, { initialUrl: `/agreement/${SEED_IDS.ahmetLoan}` });
		await waitFor(() => {
			expect(screen.getByTestId("agreement.payment.reported-1.reject")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("agreement.payment.reported-1.reject"));
		await waitFor(() => {
			expect(screen.getByText(tr.payment.statuses.rejected)).toBeTruthy();
		});
		expect(screen.getByTestId("agreement.outstanding.text")).toHaveTextContent("6.500,00 TL");
		expect((await api.listRequests()).filter((item) => item.kind === "payment")).toEqual([]);
	});
});
