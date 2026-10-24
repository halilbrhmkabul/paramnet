import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import { Share } from "react-native";

import { ApiError } from "@/api/errors";
import { SEED_IDS } from "@/api/mock/seed";
import { fill, tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import {
	createTestApi,
	createTestProfileApi,
	provideTestApi,
	provideTestProfileApi,
} from "@/testing/providers";
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

describe("Share (S13)", () => {
	it("creates the invite, opens the share sheet and the agreement waits for an answer", async () => {
		const share = jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction });
		await openShare(SEED_IDS.ahmetLoan);
		expect(screen.getByTestId("share.phone.input")).toHaveDisplayValue("+90 555 111 22 33");
		await fireEvent.press(screen.getByTestId("share.send.button"));
		await waitFor(() => {
			expect(share).toHaveBeenCalledWith({
				message: fill(tr.share.message, { name: "Test", link: tr.share.prototypeLink }),
			});
		});
		await waitFor(() => {
			expect(screen.getByTestId("agreement.status.badge")).toHaveTextContent(
				tr.agreement.status.pending,
			);
		});
		expect(screen.getByTestId("agreement.state.text")).toHaveTextContent(
			tr.agreementActions.pendingInfo,
		);
		expect(screen.queryByTestId("agreement.primaryAction.button")).toBeNull();

		await fireEvent.press(screen.getByTestId("agreement.withdraw.button"));
		await waitFor(() => {
			expect(screen.getByTestId("agreement.status.badge")).toHaveTextContent(
				tr.agreement.status.personal,
			);
		});
	});

	it("needs a valid Turkish mobile number", async () => {
		await openShare(SEED_IDS.yildizFurniture);
		expect(screen.getByText(tr.share.needPhone)).toBeTruthy();
		expect(screen.getByTestId("share.send.button")).toBeDisabled();
		await fireEvent.changeText(screen.getByTestId("share.phone.input"), "212 123 45 67");
		expect(screen.getByText(tr.phone.errorInvalid)).toBeTruthy();
		await fireEvent.changeText(screen.getByTestId("share.phone.input"), "0555 444 55 66");
		expect(screen.getByTestId("share.send.button")).toBeEnabled();
	});

	it("shows what the other side sees before and after verifying (W01, W03 draft)", async () => {
		await openShare(SEED_IDS.ahmetLoan);
		await fireEvent.press(screen.getByTestId("share.preview.button"));
		await waitFor(() => {
			expect(screen.getByTestId("invitePreview.screen")).toBeTruthy();
		});
		expect(screen.queryByText("12.000,00 TL")).toBeNull();
		await fireEvent.press(screen.getByTestId("invitePreview.verify.button"));
		expect(
			within(screen.getByTestId("invitePreview.detail")).getByText("12.000,00 TL"),
		).toBeTruthy();
	});
});

describe("Share by ParamNet ID (ADR-050)", () => {
	async function openIdMode(agreementId: string) {
		await openShare(agreementId);
		await fireEvent.press(screen.getByTestId("share.mode.id"));
		expect(screen.getByTestId("share.id.input")).toBeTruthy();
	}

	it("finds the person by ID, shows only the name and shares in the app", async () => {
		const share = jest.spyOn(Share, "share");
		share.mockClear();
		const api = createTestApi();
		const byId = jest.spyOn(api, "shareAgreementById");
		provideTestApi(api);
		const profileApi = createTestProfileApi();
		const find = jest.spyOn(profileApi, "findByParamnetId");
		provideTestProfileApi(profileApi);
		await openIdMode(SEED_IDS.yildizFurniture);
		expect(screen.getByTestId("share.send.button")).toBeDisabled();
		// Incomplete: no lookup is spent on it.
		await fireEvent.changeText(screen.getByTestId("share.id.input"), "pn 7kq");
		expect(find).not.toHaveBeenCalled();
		await fireEvent.changeText(screen.getByTestId("share.id.input"), "pn 7kq-2m9");
		await waitFor(() => {
			expect(screen.getByTestId("share.id.result")).toHaveTextContent("Ahmet Yılmaz", {
				exact: false,
			});
		});
		expect(find).toHaveBeenCalledWith("PN-7KQ2M9");
		await fireEvent.press(screen.getByTestId("share.send.button"));
		await waitFor(() => {
			expect(screen.getByTestId("share.idShared.text")).toHaveTextContent(
				fill(tr.share.idShared, { name: "Ahmet Yılmaz" }),
			);
		});
		expect(byId).toHaveBeenCalledWith(
			SEED_IDS.yildizFurniture,
			"PN-7KQ2M9",
			expect.any(Number),
		);
		expect(share).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByTestId("share.done.button"));
		await waitFor(() => {
			expect(screen.getByTestId("agreement.status.badge")).toHaveTextContent(
				tr.agreement.status.pending,
			);
		});
	});

	it("says when nobody has the ID or it is your own", async () => {
		await openIdMode(SEED_IDS.ahmetLoan);
		await fireEvent.changeText(screen.getByTestId("share.id.input"), "PN-ZZZZZZ");
		await waitFor(() => {
			expect(screen.getByText(tr.share.idNotFound)).toBeTruthy();
		});
		expect(screen.getByTestId("share.send.button")).toBeDisabled();
		await fireEvent.changeText(screen.getByTestId("share.id.input"), "PN-48K7QZ");
		await waitFor(() => {
			expect(screen.getByText(tr.share.idSelf)).toBeTruthy();
		});
		await fireEvent.changeText(screen.getByTestId("share.id.input"), "PN-0000");
		expect(screen.getByText(tr.share.idInvalid)).toBeTruthy();
	});

	it("explains the hourly search limit", async () => {
		const profileApi = createTestProfileApi();
		jest.spyOn(profileApi, "findByParamnetId").mockRejectedValue(new ApiError("rate_limited"));
		provideTestProfileApi(profileApi);
		await openIdMode(SEED_IDS.ahmetLoan);
		await fireEvent.changeText(screen.getByTestId("share.id.input"), "PN-7KQ2M9");
		await waitFor(() => {
			expect(screen.getByText(tr.error.idLimited)).toBeTruthy();
		});
	});
});
