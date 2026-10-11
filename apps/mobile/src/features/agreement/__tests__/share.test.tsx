import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import { Share } from "react-native";

import { SEED_IDS } from "@/api/mock/seed";
import { fill, tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

async function openShare(agreementId: string) {
	await renderRouter(appRoutes, { initialUrl: `/agreement/${agreementId}` });
	await waitFor(() => {
		expect(screen.getByTestId("agreement.share.button")).toBeTruthy();
	});
	await fireEvent.press(screen.getByTestId("agreement.share.button"));
	await waitFor(() => {
		expect(screen.getByTestId("share.screen")).toBeTruthy();
	});
}

describe("Share draft (S13, prototype)", () => {
	it("previews the message with the counterparty's number and opens the system share sheet", async () => {
		const share = jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction });
		await openShare(SEED_IDS.ahmetLoan);
		expect(screen.getByText("+90 555 111 22 33")).toBeTruthy();
		const message = fill(tr.share.message, { name: "Test", link: tr.share.prototypeLink });
		expect(screen.getByTestId("share.message.text")).toHaveTextContent(message);
		expect(screen.getByText(tr.share.prototypeNote)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("share.send.button"));
		expect(share).toHaveBeenCalledWith({ message });
	});

	it("asks for a number when the contact has none", async () => {
		await openShare(SEED_IDS.yildizFurniture);
		expect(screen.getByText(tr.share.needPhone)).toBeTruthy();
		expect(screen.getByTestId("share.send.button")).toBeDisabled();
	});

	it("shows what the other side sees before and after verifying (W01, W03 draft)", async () => {
		await openShare(SEED_IDS.ahmetLoan);
		await fireEvent.press(screen.getByTestId("share.preview.button"));
		await waitFor(() => {
			expect(screen.getByTestId("invitePreview.screen")).toBeTruthy();
		});
		expect(screen.getByText(fill(tr.invite.title, { name: "Test" }))).toBeTruthy();
		// Before OTP: no amounts (spec 5.4).
		expect(screen.queryByText("12.000,00 TL")).toBeNull();

		await fireEvent.press(screen.getByTestId("invitePreview.verify.button"));
		const detail = screen.getByTestId("invitePreview.detail");
		expect(within(detail).getByText("12.000,00 TL")).toBeTruthy();
		// The other side sees the roles mirrored.
		expect(within(detail).getByText(tr.agreement.youOwe)).toBeTruthy();
		expect(screen.getByTestId("invitePreview.accept.button")).toHaveTextContent(
			tr.invite.accept,
		);
		expect(screen.getByTestId("invitePreview.counter.button")).toHaveTextContent(
			tr.invite.counter,
		);
		expect(screen.getByTestId("invitePreview.reject.button")).toHaveTextContent(
			tr.invite.reject,
		);
	});
});
