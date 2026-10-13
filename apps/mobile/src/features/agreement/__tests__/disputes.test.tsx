import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { SEED_IDS } from "@/api/mock/seed";
import type { AgreementDetail, RequestItem } from "@/api/types";
import { fill, tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { createTestApi, provideTestApi } from "@/testing/providers";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

async function activeSharedAgreement() {
	await renderRouter(appRoutes, { initialUrl: `/agreement/${SEED_IDS.zeynepShare}/decide` });
	await waitFor(() => {
		expect(screen.getByTestId("decide.accept.button")).toBeTruthy();
	});
	await fireEvent.press(screen.getByTestId("decide.accept.button"));
	await waitFor(() => {
		expect(screen.getByTestId("agreement.dispute.button")).toBeTruthy();
	});
}

// The seed's personal loan, shown as a shared agreement where the other side is waiting on me.
async function sharedDetail(overrides: Partial<AgreementDetail>) {
	const api = createTestApi();
	const base = await api.getAgreement(SEED_IDS.ahmetLoan);
	api.getAgreement = jest.fn().mockResolvedValue({ ...base, status: "active", ...overrides });
	provideTestApi(api);
	return api;
}

describe("Disputes, cancellation and forgiveness (S16, F2-09)", () => {
	it("the debtor disputes with a reason; the agreement freezes until they withdraw it", async () => {
		await activeSharedAgreement();
		await fireEvent.press(screen.getByTestId("agreement.dispute.button"));
		await waitFor(() => {
			expect(screen.getByTestId("dispute.screen")).toBeTruthy();
		});
		expect(screen.getByTestId("dispute.target.all")).toBeChecked();
		expect(screen.getByTestId("dispute.send.button")).toBeDisabled();
		await fireEvent.changeText(
			screen.getByTestId("dispute.reason.input"),
			"Tutar 5.000 TL olmalıydı",
		);
		await fireEvent.press(screen.getByTestId("dispute.send.button"));

		await waitFor(() => {
			expect(screen.getByTestId("agreement.status.badge")).toHaveTextContent(
				tr.agreement.status.disputed,
			);
		});
		expect(screen.getByTestId("agreement.dispute.card")).toHaveTextContent(
			"Tutar 5.000 TL olmalıydı",
			{ exact: false },
		);
		// BR-14: no payments while disputed; a new dispute waits for this one.
		expect(screen.queryByTestId("agreement.primaryAction.button")).toBeNull();
		expect(screen.queryByTestId("agreement.dispute.button")).toBeNull();

		await fireEvent.press(screen.getByTestId("agreement.resolveDispute.button"));
		await waitFor(() => {
			expect(screen.getByTestId("agreement.status.badge")).toHaveTextContent(
				tr.agreement.status.active,
			);
		});
		expect(screen.queryByTestId("agreement.dispute.card")).toBeNull();
	});

	it("a dispute can point at one payment", async () => {
		const api = await sharedDetail({});
		const openDispute = jest.fn().mockResolvedValue({ status: "disputed" });
		api.openDispute = openDispute;
		await renderRouter(appRoutes, { initialUrl: `/agreement/${SEED_IDS.ahmetLoan}` });
		await waitFor(() => {
			expect(screen.getByTestId("agreement.dispute.button")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("agreement.dispute.button"));
		await waitFor(() => {
			expect(screen.getByTestId("dispute.target.p-ahmet-1")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("dispute.target.p-ahmet-1"));
		expect(screen.getByTestId("dispute.target.p-ahmet-1")).toBeChecked();
		expect(screen.getByTestId("dispute.target.all")).not.toBeChecked();
		await fireEvent.changeText(
			screen.getByTestId("dispute.reason.input"),
			"Bu ödeme bana ulaşmadı",
		);
		await fireEvent.press(screen.getByTestId("dispute.send.button"));
		await waitFor(() => {
			expect(openDispute).toHaveBeenCalledWith(
				SEED_IDS.ahmetLoan,
				"Bu ödeme bana ulaşmadı",
				"p-ahmet-1",
				expect.any(Number),
			);
		});
	});

	it("the other side's dispute is shown with their name; only they can withdraw it", async () => {
		await sharedDetail({
			status: "disputed",
			dispute: {
				by_me: false,
				reason: "Ödemem eksik görünüyor",
				payment_id: null,
				opened_at: "2026-10-12T10:00:00Z",
			},
		});
		await renderRouter(appRoutes, { initialUrl: `/agreement/${SEED_IDS.ahmetLoan}` });
		await waitFor(() => {
			expect(screen.getByTestId("agreement.dispute.card")).toBeTruthy();
		});
		expect(screen.getByTestId("agreement.dispute.card")).toHaveTextContent(
			fill(tr.dispute.openedByOther, { name: "Ahmet Yılmaz" }),
			{ exact: false },
		);
		expect(screen.queryByTestId("agreement.resolveDispute.button")).toBeNull();
		// The way out: propose a change or cancel together.
		expect(screen.getByTestId("agreement.amend.button")).toBeTruthy();
		expect(screen.getByTestId("agreement.requestCancel.button")).toBeTruthy();
	});

	it("asks to cancel together and waits for the other side", async () => {
		await activeSharedAgreement();
		await fireEvent.press(screen.getByTestId("agreement.requestCancel.button"));
		await waitFor(() => {
			expect(screen.getByTestId("agreement.cancel.text")).toHaveTextContent(
				tr.cancel.waiting,
			);
		});
		expect(screen.queryByTestId("agreement.requestCancel.button")).toBeNull();
		expect(screen.getByTestId("agreement.status.badge")).toHaveTextContent(
			tr.agreement.status.active,
		);
	});

	it("answers the other side's cancellation request", async () => {
		const api = await sharedDetail({
			cancel_request: { by_me: false, requested_at: "2026-10-12T10:00:00Z" },
		});
		const decideCancel = jest.fn().mockResolvedValue({ status: "cancelled", replayed: false });
		api.decideCancel = decideCancel;
		await renderRouter(appRoutes, { initialUrl: `/agreement/${SEED_IDS.ahmetLoan}` });
		await waitFor(() => {
			expect(screen.getByTestId("agreement.cancel.text")).toHaveTextContent(
				fill(tr.cancel.requestedByOther, { name: "Ahmet Yılmaz" }),
			);
		});
		expect(screen.getByTestId("agreement.rejectCancel.button")).toHaveTextContent(
			tr.cancel.reject,
		);
		await fireEvent.press(screen.getByTestId("agreement.acceptCancel.button"));
		await waitFor(() => {
			expect(decideCancel).toHaveBeenCalledWith(SEED_IDS.ahmetLoan, "accept");
		});
	});

	it("the creditor forgives part of the debt; the debtor is only informed", async () => {
		await renderRouter(appRoutes, { initialUrl: `/agreement/${SEED_IDS.ahmetLoan}` });
		await waitFor(() => {
			expect(screen.getByTestId("agreement.forgive.button")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("agreement.forgive.button"));
		// Prefilled with what is left after the seed's payments.
		expect(screen.getByTestId("forgive.amount.input")).toHaveDisplayValue("6.500");
		await fireEvent.changeText(screen.getByTestId("forgive.amount.input"), "1000");
		await fireEvent.press(screen.getByTestId("forgive.save.button"));
		await waitFor(() => {
			expect(screen.getByTestId("agreement.outstanding.text")).toHaveTextContent("₺5.500,00");
		});
		expect(screen.queryByTestId("forgive.amount.input")).toBeNull();
	});

	it("forgiving everything that is left closes the agreement", async () => {
		await renderRouter(appRoutes, { initialUrl: `/agreement/${SEED_IDS.ahmetLoan}` });
		await waitFor(() => {
			expect(screen.getByTestId("agreement.forgive.button")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("agreement.forgive.button"));
		await fireEvent.press(screen.getByTestId("forgive.save.button"));
		await waitFor(() => {
			expect(screen.getByTestId("agreement.settled")).toBeTruthy();
		});
		expect(screen.queryByTestId("agreement.forgive.button")).toBeNull();
	});

	it("the debtor has no forgive action", async () => {
		await activeSharedAgreement();
		expect(screen.queryByTestId("agreement.forgive.button")).toBeNull();
	});

	it("disputes and cancellation requests are listed in Talepler", async () => {
		const api = createTestApi();
		const items: RequestItem[] = [
			{
				agreement_id: "a-dispute",
				kind: "dispute",
				title: "Borç",
				from_name: "Ahmet",
				my_role: "creditor",
				principal_minor: 100000,
				reason: "Eksik",
			},
			{
				agreement_id: "a-cancel",
				kind: "cancel",
				title: "Kira",
				from_name: "Zeynep",
				my_role: "debtor",
				principal_minor: 200000,
			},
		];
		api.listRequests = jest.fn().mockResolvedValue(items);
		provideTestApi(api);
		await renderRouter(appRoutes, { initialUrl: "/requests" });
		await waitFor(() => {
			expect(screen.getByTestId("requests.section.actions")).toBeTruthy();
		});
		expect(screen.getByTestId("requests.item.dispute.a-dispute")).toHaveTextContent(
			fill(tr.requests.dispute, { name: "Ahmet" }),
			{ exact: false },
		);
		expect(screen.getByTestId("requests.item.cancel.a-cancel")).toHaveTextContent(
			fill(tr.requests.cancel, { name: "Zeynep" }),
			{ exact: false },
		);
	});
});
