import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { SEED_IDS } from "@/api/mock/seed";
import type { PendingDecision } from "@/api/types";
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
		expect(screen.getByTestId("agreement.amend.button")).toBeTruthy();
	});
}

describe("Amendments (S15, F2-08)", () => {
	it("proposes a re-planned schedule; the old terms stay until the other side answers", async () => {
		await activeSharedAgreement();
		await fireEvent.press(screen.getByTestId("agreement.amend.button"));
		await waitFor(() => {
			expect(screen.getByTestId("amend.row.3")).toBeTruthy();
		});
		expect(screen.getByTestId("amend.total.text")).toHaveTextContent("₺6.000,00");

		await fireEvent.press(screen.getByTestId("amend.addRow.button"));
		expect(screen.getByTestId("amend.error")).toHaveTextContent(tr.form.nonPositiveInstallment);
		expect(screen.getByTestId("amend.send.button")).toBeDisabled();

		// 3 rows of 2.000 → 2.000 / 2.000 / 1.000 / 1.000 (same total, one more month).
		await fireEvent.changeText(screen.getByTestId("amend.row.3.amount"), "1000");
		await fireEvent.changeText(screen.getByTestId("amend.row.4.amount"), "1000");
		expect(screen.getByTestId("amend.total.text")).toHaveTextContent("₺6.000,00");
		expect(screen.queryByTestId("amend.totalChanged")).toBeNull();
		await fireEvent.changeText(
			screen.getByTestId("amend.reason.input"),
			"Şubat'ta maaş geç yatacak",
		);
		await fireEvent.press(screen.getByTestId("amend.send.button"));

		await waitFor(() => {
			expect(screen.getByTestId("agreement.status.badge")).toHaveTextContent(
				tr.agreement.status.amendment_pending,
			);
		});
		expect(screen.getByTestId("agreement.state.text")).toHaveTextContent(
			tr.agreementActions.amendmentWaiting,
		);
		// Old terms remain: payments are still possible.
		expect(screen.getByTestId("agreement.primaryAction.button")).toHaveTextContent(
			tr.agreement.payFull,
		);

		await fireEvent.press(screen.getByTestId("agreement.withdrawAmendment.button"));
		await waitFor(() => {
			expect(screen.getByTestId("agreement.status.badge")).toHaveTextContent(
				tr.agreement.status.active,
			);
		});
	});

	it("a changed total is pointed out", async () => {
		await activeSharedAgreement();
		await fireEvent.press(screen.getByTestId("agreement.amend.button"));
		await waitFor(() => {
			expect(screen.getByTestId("amend.row.1")).toBeTruthy();
		});
		await fireEvent.changeText(screen.getByTestId("amend.row.1.amount"), "1500");
		expect(screen.getByTestId("amend.total.text")).toHaveTextContent("₺5.500,00");
		expect(screen.getByTestId("amend.totalChanged")).toHaveTextContent(
			fill(tr.amend.totalChanged, { amount: "₺6.000,00" }),
		);
	});

	it("the other side reviews with the reason and answers yes or no (no counter)", async () => {
		const api = createTestApi();
		const pending: PendingDecision = {
			agreement_id: SEED_IDS.ahmetLoan,
			title: "Borç",
			actor: "amendment",
			other_name: "Ahmet Yılmaz",
			my_role: "creditor",
			version: 2,
			terms_hash: "h2",
			reason: "Şubat'ta maaş geç yatacak",
			current: {
				principal_minor: 1200000,
				down_payment_minor: 0,
				notes: null,
				plan: [{ seq: 1, due_date: "2026-11-01", amount_minor: 1200000 }],
			},
			proposed: {
				principal_minor: 1200000,
				down_payment_minor: 0,
				notes: null,
				plan: [{ seq: 1, due_date: "2027-02-01", amount_minor: 1200000 }],
			},
			can_reject: true,
			payments: [],
		};
		api.getPendingDecision = jest.fn().mockResolvedValue(pending);
		const decide = jest.fn().mockResolvedValue({ status: "active", version: 2 });
		api.decide = decide;
		provideTestApi(api);

		await renderRouter(appRoutes, { initialUrl: `/agreement/${SEED_IDS.ahmetLoan}/decide` });
		await waitFor(() => {
			expect(
				screen.getByText(fill(tr.decide.amendmentTitle, { name: "Ahmet Yılmaz" })),
			).toBeTruthy();
		});
		expect(screen.getByTestId("decide.reason")).toHaveTextContent("Şubat'ta maaş geç yatacak", {
			exact: false,
		});
		expect(screen.getByTestId("decide.current")).toBeTruthy();
		expect(screen.queryByTestId("decide.counter.button")).toBeNull();
		expect(screen.getByTestId("decide.reject.button")).toHaveTextContent(
			tr.decide.rejectAmendment,
		);
		await fireEvent.press(screen.getByTestId("decide.accept.button"));
		await waitFor(() => {
			expect(decide).toHaveBeenCalledWith(
				SEED_IDS.ahmetLoan,
				"amendment",
				2,
				"h2",
				"accept",
				null,
			);
		});
	});
});
