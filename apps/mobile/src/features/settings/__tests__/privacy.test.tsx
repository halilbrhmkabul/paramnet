import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Share } from "react-native";

import { createMockAuthApi } from "@/api/auth/mockAuth";
import { ApiError } from "@/api/errors";
import { resetSession, useSession } from "@/features/auth/sessionStore";
import { tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import {
	createTestApi,
	createTestQueryClient,
	provideTestApi,
	provideTestAuthApi,
	provideTestQueryClient,
} from "@/testing/providers";
import { signInForTest } from "@/testing/session";

async function openSettings() {
	await renderRouter(appRoutes, { initialUrl: "/" });
	await fireEvent.press(screen.getByTestId("home.profile.button"));
	await waitFor(() => {
		expect(screen.getByTestId("settings.screen")).toBeTruthy();
	});
}

describe("KVKK texts, export and account deletion (F3-03)", () => {
	beforeEach(() => {
		signInForTest();
	});

	it("shows the KVKK notice and the terms, marked as drafts with their version", async () => {
		await openSettings();
		await fireEvent.press(screen.getByTestId("settings.kvkk.item"));
		await waitFor(() => {
			expect(screen.getByTestId("legal.screen")).toBeTruthy();
		});
		expect(screen.getByText(tr.legal.kvkk.title)).toBeTruthy();
		expect(screen.getByTestId("legal.version")).toHaveTextContent("2026-10", { exact: false });
		expect(screen.getByTestId("legal.draft")).toHaveTextContent(tr.legal.draft);
	});

	it("exports everything about the account through the share sheet", async () => {
		const api = createTestApi();
		api.exportMyData = jest.fn().mockResolvedValue({ profile: { display_name: "Test" } });
		provideTestApi(api);
		const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
		await openSettings();
		await fireEvent.press(screen.getByTestId("settings.export.item"));
		await waitFor(() => {
			expect(share).toHaveBeenCalled();
		});
		const content = share.mock.calls[0]?.[0];
		expect(content).toMatchObject({ title: tr.settings.exportTitle });
		expect(content && "message" in content ? content.message : "").toContain(
			'"display_name": "Test"',
		);
	});

	it("deletes the account only after the consequences are acknowledged", async () => {
		const auth = createMockAuthApi({ latencyMs: 0 });
		const deleteAccount = jest.spyOn(auth, "deleteAccount").mockResolvedValue(undefined);
		provideTestAuthApi(auth);
		const queryClient = createTestQueryClient();
		provideTestQueryClient(queryClient);
		await openSettings();
		await fireEvent.press(screen.getByTestId("settings.deleteAccount.item"));
		await waitFor(() => {
			expect(screen.getByTestId("deleteAccount.screen")).toBeTruthy();
		});
		expect(screen.getByText(tr.deleteAccount.keptForOthers)).toBeTruthy();
		expect(screen.getByTestId("deleteAccount.confirm.button")).toBeDisabled();
		await fireEvent.press(screen.getByTestId("deleteAccount.ack.checkbox"));
		await fireEvent.press(screen.getByTestId("deleteAccount.confirm.button"));
		await waitFor(() => {
			expect(useSession.getState().user).toBeNull();
		});
		expect(deleteAccount).toHaveBeenCalledTimes(1);
		expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
		await waitFor(() => {
			expect(screen.getByTestId("welcome.screen")).toBeTruthy();
		});
	});

	it("keeps the user signed in when deletion fails", async () => {
		const auth = createMockAuthApi({ latencyMs: 0 });
		jest.spyOn(auth, "deleteAccount").mockRejectedValue(new ApiError("network"));
		provideTestAuthApi(auth);
		await openSettings();
		await fireEvent.press(screen.getByTestId("settings.deleteAccount.item"));
		await waitFor(() => {
			expect(screen.getByTestId("deleteAccount.ack.checkbox")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("deleteAccount.ack.checkbox"));
		await fireEvent.press(screen.getByTestId("deleteAccount.confirm.button"));
		await waitFor(() => {
			expect(screen.getByTestId("deleteAccount.error")).toBeTruthy();
		});
		expect(useSession.getState().user).not.toBeNull();
	});
});

describe("KVKK notice at sign-up", () => {
	it("can be read before accepting it", async () => {
		resetSession();
		useSession.setState({
			user: { id: "u1", phone_e164: "+905550000001", display_name: null },
			onboarded: false,
		});
		await renderRouter(appRoutes, { initialUrl: "/profile" });
		await fireEvent.press(screen.getByTestId("profile.readKvkk.button"));
		await waitFor(() => {
			expect(screen.getByTestId("legal.screen")).toBeTruthy();
		});
		expect(screen.getByText(tr.legal.kvkk.title)).toBeTruthy();
	});
});
