import NetInfo from "@react-native-community/netinfo";
import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";

import { SEED_IDS } from "@/api/mock/seed";
import { tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

async function openAhmet() {
	await renderRouter(appRoutes, { initialUrl: `/agreement/${SEED_IDS.ahmetLoan}` });
	await waitFor(() => {
		expect(screen.getByTestId("agreement.outstanding.text")).toHaveTextContent("₺6.500,00");
	});
}

describe("Agreement detail layout (design 13, 25, F4-01c)", () => {
	it("my debt: pay in full opens the payment with the rest filled in; partial opens empty", async () => {
		await renderRouter(appRoutes, { initialUrl: `/agreement/${SEED_IDS.elifLoan}` });
		await waitFor(() => {
			expect(screen.getByTestId("agreement.role.text")).toHaveTextContent(
				tr.agreement.remainingDebt,
			);
		});
		expect(screen.getByText(tr.agreement.titleDebt)).toBeTruthy();
		expect(screen.getByTestId("agreement.primaryAction.button")).toHaveTextContent(
			tr.agreement.payFull,
		);
		await fireEvent.press(screen.getByTestId("agreement.primaryAction.button"));
		await waitFor(() => {
			expect(screen.getByTestId("payment.amount.input")).toHaveDisplayValue("2.500");
		});
	});

	it("my debt: partial payment opens an empty amount", async () => {
		await renderRouter(appRoutes, { initialUrl: `/agreement/${SEED_IDS.elifLoan}` });
		await fireEvent.press(await screen.findByTestId("agreement.partialPayment.button"));
		await waitFor(() => {
			expect(screen.getByTestId("payment.amount.input")).toHaveDisplayValue("");
		});
	});

	it("installment purchase: the next installment card records exactly that installment", async () => {
		await renderRouter(appRoutes, { initialUrl: `/agreement/${SEED_IDS.yildizFurniture}` });
		const next = await screen.findByTestId("agreement.next");
		expect(within(next).getByText("Sıradaki · 1. taksit")).toBeTruthy();
		expect(screen.getByText(tr.agreement.planSection)).toBeTruthy();
		expect(
			screen.getByText(tr.agreement.paidWithDown.replace(" {amount}", ""), { exact: false }),
		).toBeTruthy();
		await fireEvent.press(within(next).getByTestId("agreement.primaryAction.button"));
		await waitFor(() => {
			expect(screen.getByTestId("payment.amount.input")).toHaveDisplayValue("4.000");
		});
	});

	it("keeps the tab bar under the detail and leaves to a tab", async () => {
		await renderRouter(appRoutes, { initialUrl: `/agreement/${SEED_IDS.ahmetLoan}` });
		await fireEvent.press(await screen.findByTestId("detailTabs.home"));
		await waitFor(() => {
			expect(screen.getByTestId("home.screen")).toBeTruthy();
		});
	});
});

describe("Agreement detail (S11)", () => {
	it("shows the top card, installments with derived states and payments", async () => {
		await openAhmet();
		expect(screen.getByTestId("agreement.counterparty.text")).toHaveTextContent("Ahmet Yılmaz");
		expect(screen.getByTestId("agreement.role.text")).toHaveTextContent(
			tr.agreement.remainingReceivable,
		);
		expect(screen.getByTestId("agreement.total.text")).toHaveTextContent("₺12.000,00");
		expect(screen.getByTestId("agreement.status.badge")).toHaveTextContent(
			tr.agreement.status.personal,
		);
		expect(screen.getByText(tr.agreement.personalBadge)).toBeTruthy();
		expect(screen.getByTestId("agreement.progress")).toHaveProp("accessibilityValue", {
			min: 0,
			max: 100,
			now: 45,
		});

		const second = screen.getByTestId("agreement.installment.2.row");
		expect(
			within(second).getByText(
				`${tr.installment.status.overdue} · ${tr.installment.partial}`,
			),
		).toBeTruthy();
		expect(
			within(screen.getByTestId("agreement.installment.1.row")).getByText(
				tr.installment.status.paid,
			),
		).toBeTruthy();
		expect(screen.getAllByTestId(/^agreement\.payment\./)).toHaveLength(2);
		expect(screen.getByTestId("agreement.primaryAction.button")).toHaveTextContent(
			tr.agreement.addPayment,
		);
	});

	it("records a payment with an allocation preview and updates balances at once", async () => {
		await openAhmet();
		await fireEvent.press(screen.getByTestId("agreement.primaryAction.button"));
		await waitFor(() => {
			expect(screen.getByTestId("payment.screen")).toBeTruthy();
		});

		await fireEvent.changeText(screen.getByTestId("payment.amount.input"), "3000");
		const preview = screen.getByTestId("payment.allocation.list");
		expect(within(preview).getByTestId("payment.allocation.2")).toHaveTextContent("₺2.500,00", {
			exact: false,
		});
		expect(within(preview).getByTestId("payment.allocation.3")).toHaveTextContent("₺500,00", {
			exact: false,
		});

		await fireEvent.press(screen.getByTestId("payment.method.transfer"));
		await fireEvent.press(screen.getByTestId("payment.save.button"));
		await waitFor(() => {
			expect(screen.getByTestId("payment.done.button")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("payment.done.button"));
		await waitFor(() => {
			expect(screen.getByTestId("agreement.outstanding.text")).toHaveTextContent("₺3.500,00");
		});
		expect(
			within(screen.getByTestId("agreement.installment.2.row")).getByText(
				tr.installment.status.paid,
			),
		).toBeTruthy();
		expect(screen.getAllByTestId(/^agreement\.payment\./)).toHaveLength(3);
	});

	it("blocks an amount above the balance with the Turkish message", async () => {
		await openAhmet();
		await fireEvent.press(screen.getByTestId("agreement.primaryAction.button"));
		await waitFor(() => {
			expect(screen.getByTestId("payment.screen")).toBeTruthy();
		});
		await fireEvent.changeText(screen.getByTestId("payment.amount.input"), "7000");
		expect(screen.getByText(tr.error.exceedsOutstanding)).toBeTruthy();
		expect(screen.getByTestId("payment.save.button")).toBeDisabled();
	});

	it("paying the rest closes the plan", async () => {
		await openAhmet();
		await fireEvent.press(screen.getByTestId("agreement.primaryAction.button"));
		await waitFor(() => {
			expect(screen.getByTestId("payment.screen")).toBeTruthy();
		});
		await fireEvent.changeText(screen.getByTestId("payment.amount.input"), "6500");
		await fireEvent.press(screen.getByTestId("payment.save.button"));
		await waitFor(() => {
			expect(screen.getByTestId("payment.done.button")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("payment.done.button"));
		await waitFor(() => {
			expect(screen.getByText(tr.settled.title)).toBeTruthy();
		});
		expect(screen.getByTestId("agreement.status.badge")).toHaveTextContent(
			tr.agreement.status.settled,
		);
		expect(screen.queryByTestId("agreement.primaryAction.button")).toBeNull();
	});

	it("history lists every event in order", async () => {
		await openAhmet();
		await fireEvent.press(screen.getByTestId("agreement.history.button"));
		await waitFor(() => {
			expect(screen.getByTestId("history.screen")).toBeTruthy();
		});
		const events = screen.getAllByTestId(/^history\.event\./);
		expect(events).toHaveLength(3);
		expect(events[0]).toHaveTextContent(tr.history.created, { exact: false });
		expect(events[1]).toHaveTextContent("₺4.000,00", { exact: false });
	});

	it("disables writing while offline and says why", async () => {
		jest.mocked(NetInfo.useNetInfo).mockReturnValue({
			...jest.mocked(NetInfo.useNetInfo)(),
			isConnected: false,
		});
		await openAhmet();
		expect(screen.getByTestId("agreement.primaryAction.button")).toBeDisabled();
		expect(screen.getByText(tr.error.offline)).toBeTruthy();
	});
});
