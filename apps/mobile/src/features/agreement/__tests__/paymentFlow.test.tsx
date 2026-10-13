import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { SEED_IDS } from "@/api/mock/seed";
import { fill, tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

async function openPayment() {
	await renderRouter(appRoutes, { initialUrl: `/agreement/${SEED_IDS.ahmetLoan}` });
	await waitFor(() => {
		expect(screen.getByTestId("agreement.primaryAction.button")).toBeTruthy();
	});
	await fireEvent.press(screen.getByTestId("agreement.primaryAction.button"));
	await waitFor(() => {
		expect(screen.getByTestId("payment.screen")).toBeTruthy();
	});
}

describe("Payment form and result (design 11, 14)", () => {
	it("fills the amount from shortcuts and shows what will be left", async () => {
		await openPayment();
		await fireEvent.press(screen.getByTestId("payment.chip.all"));
		expect(screen.getByTestId("payment.amount.input")).toHaveDisplayValue("6.500");
		expect(screen.getByTestId("payment.after")).toHaveTextContent("₺0,00");
		await fireEvent.press(screen.getByTestId("payment.chip.next"));
		expect(screen.getByTestId("payment.after")).not.toHaveTextContent("₺0,00");
	});

	it("confirms the saved payment with the new balance, then goes back", async () => {
		await openPayment();
		await fireEvent.changeText(screen.getByTestId("payment.amount.input"), "1000");
		await fireEvent.press(screen.getByTestId("payment.save.button"));
		await waitFor(() => {
			expect(screen.getByTestId("payment.result")).toBeTruthy();
		});
		expect(screen.getByText(tr.payment.savedTitle)).toBeTruthy();
		expect(screen.getByTestId("payment.result.remaining")).toHaveTextContent("₺5.500,00");
		await fireEvent.press(screen.getByTestId("payment.done.button"));
		await waitFor(() => {
			expect(screen.getByTestId("agreement.outstanding.text")).toHaveTextContent("₺5.500,00");
		});
	});
});

describe("text", () => {
	it("explains a reported payment waits for the other side", () => {
		expect(fill(tr.payment.reportedBody, { name: "Ayşe" })).toContain("Ayşe");
	});
});
