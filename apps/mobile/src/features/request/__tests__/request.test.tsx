import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { SEED_IDS } from "@/api/mock/seed";
import { fill, tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { createTestApi, provideTestApi } from "@/testing/providers";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

describe("Para iste (18, 19, 20)", () => {
	it("asks a ParamNet user for money and shows the sent request", async () => {
		await renderRouter(appRoutes, { initialUrl: "/add" });
		await fireEvent.press(screen.getByTestId("action.request"));
		await waitFor(() => {
			expect(screen.getByTestId("request.screen")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("request.next.button"));
		expect(screen.getByTestId("request.error.text")).toHaveTextContent(tr.request.needId);

		await fireEvent.changeText(screen.getByTestId("request.id.input"), "pn-ek4x8r");
		await waitFor(() => {
			expect(screen.getByTestId("request.found")).toHaveTextContent("Emre Kılıç", {
				exact: false,
			});
		});
		await fireEvent.press(screen.getByTestId("request.next.button"));
		expect(screen.getByTestId("request.error.text")).toHaveTextContent(tr.request.needAmount);
		await fireEvent.changeText(screen.getByTestId("request.amount.input"), "3000");
		await fireEvent.press(screen.getByTestId("request.due.twoWeeks"));
		expect(screen.getByTestId("request.due.text")).toHaveTextContent("25 Ekim 2026");
		await fireEvent.changeText(screen.getByTestId("request.note.input"), "Konser bileti");
		await fireEvent.press(screen.getByTestId("request.next.button"));

		await waitFor(() => {
			expect(screen.getByTestId("request.preview.amount")).toHaveTextContent("3.000,00 TL");
		});
		expect(screen.getByText(tr.request.draft)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("request.send.button"));
		expect(screen.getByTestId("request.error.text")).toHaveTextContent(tr.request.needConsent);
		await fireEvent.press(screen.getByTestId("request.consent.checkbox"));
		await fireEvent.press(screen.getByTestId("request.send.button"));

		await waitFor(() => {
			expect(screen.getByTestId("requestSent.screen")).toBeTruthy();
		});
		expect(screen.getByText(fill(tr.request.sentBody, { name: "Emre Kılıç" }))).toBeTruthy();
		expect(screen.getByTestId("requestSent.status")).toHaveTextContent(tr.request.waiting);
	});

	it("reports an unknown ID without keeping a request", async () => {
		await renderRouter(appRoutes, { initialUrl: "/request" });
		await waitFor(() => {
			expect(screen.getByTestId("request.id.input")).toBeTruthy();
		});
		await fireEvent.changeText(screen.getByTestId("request.id.input"), "PN-ZZZZZZ");
		await fireEvent.changeText(screen.getByTestId("request.amount.input"), "100");
		await waitFor(() => {
			expect(screen.getByTestId("request.idError")).toHaveTextContent(tr.request.notFound);
		});
		await fireEvent.press(screen.getByTestId("request.next.button"));
		expect(screen.getByTestId("request.error.text")).toHaveTextContent(tr.request.notFound);
	});
});

describe("Para teslimi (17)", () => {
	function apiWithDelivery() {
		const api = createTestApi({
			deliveries: {
				[SEED_IDS.ahmetLoan]: {},
				[SEED_IDS.elifLoan]: { reported_at: "2026-10-11T07:00:00Z" },
			},
		});
		for (const agreement of api.state.agreements) {
			if (agreement.id === SEED_IDS.ahmetLoan || agreement.id === SEED_IDS.elifLoan) {
				agreement.status = "active";
			}
		}
		return api;
	}

	it("the lender marks the money as given", async () => {
		provideTestApi(apiWithDelivery());
		await renderRouter(appRoutes, { initialUrl: `/agreement/${SEED_IDS.ahmetLoan}` });
		await waitFor(() => {
			expect(screen.getByText(tr.delivery.banner)).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("agreement.delivery.banner"));
		await waitFor(() => {
			expect(screen.getByTestId("delivery.title")).toHaveTextContent(
				fill(tr.delivery.creditor.waiting, { name: "Ahmet Yılmaz" }),
			);
		});
		expect(screen.queryByTestId("delivery.confirm.button")).toBeNull();
		await fireEvent.press(screen.getByTestId("delivery.handOver.button"));
		await waitFor(() => {
			expect(screen.getByTestId("delivery.title")).toHaveTextContent(
				fill(tr.delivery.creditor.reported, { name: "Ahmet Yılmaz" }),
			);
		});
		expect(screen.queryByTestId("delivery.handOver.button")).toBeNull();
	});

	it("the borrower confirms receiving it", async () => {
		provideTestApi(apiWithDelivery());
		await renderRouter(appRoutes, { initialUrl: `/agreement/${SEED_IDS.elifLoan}/delivery` });
		await waitFor(() => {
			expect(screen.getByTestId("delivery.title")).toHaveTextContent(
				tr.delivery.debtor.reported,
			);
		});
		await fireEvent.press(screen.getByTestId("delivery.confirm.button"));
		await waitFor(() => {
			expect(screen.getByTestId("delivery.title")).toHaveTextContent(tr.delivery.done);
		});
	});
});
