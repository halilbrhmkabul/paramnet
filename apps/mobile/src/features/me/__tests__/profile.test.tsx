import * as Clipboard from "expo-clipboard";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Share } from "react-native";

import { ApiError } from "@/api/errors";
import { useSession } from "@/features/auth/sessionStore";
import { fill, tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import {
	createTestProfileApi,
	createTestQueryClient,
	provideTestProfileApi,
	provideTestQueryClient,
} from "@/testing/providers";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

async function openProfile() {
	await renderRouter(appRoutes, { initialUrl: "/" });
	await fireEvent.press(screen.getByTestId("home.profile.button"));
	await waitFor(() => {
		expect(screen.getByTestId("me.name.text")).toBeTruthy();
	});
}

describe("Profil (04)", () => {
	it("shows the name, @username and the ParamNet ID, without the modules that are not built", async () => {
		await openProfile();
		expect(screen.getByTestId("me.name.text")).toHaveTextContent("Test");
		expect(screen.getByTestId("me.username.text")).toHaveTextContent("@test");
		expect(screen.getByTestId("me.paramnetId.text")).toHaveTextContent("PN-48K7QZ");
		expect(screen.getByText(tr.me.idBody)).toBeTruthy();
		// ADR-051: hidden until their own tasks.
		for (const hidden of [
			"QR kod",
			"Hesaplarım",
			"Yüz tanıma ile kilit",
			"Açılışta tutarları gizle",
		]) {
			expect(screen.queryByText(hidden)).toBeNull();
		}
		expect(screen.getByTestId("me.discoverability.item")).toHaveTextContent(
			tr.discoverability.everyone,
			{ exact: false },
		);
		expect(screen.getByTestId("me.reminderPrefs.item")).toHaveTextContent(
			`${tr.inbox.reminderDays[3]}, ${tr.inbox.reminderDays[0]}`,
			{ exact: false },
		);
	});

	it("copies and shares the ID", async () => {
		const share = jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction });
		await openProfile();
		await fireEvent.press(screen.getByTestId("me.copyId.button"));
		expect(Clipboard.setStringAsync).toHaveBeenCalledWith("PN-48K7QZ");
		await waitFor(() => {
			expect(screen.getByTestId("me.copyId.button")).toHaveTextContent(tr.me.copied, {
				exact: false,
			});
		});
		await fireEvent.press(screen.getByTestId("me.shareId.button"));
		expect(share).toHaveBeenCalledWith({
			message: fill(tr.me.shareMessage, { id: "PN-48K7QZ" }),
		});
	});

	it("opens Profili düzenle", async () => {
		await openProfile();
		await fireEvent.press(screen.getByTestId("me.edit.button"));
		await waitFor(() => {
			expect(screen.getByTestId("editProfile.screen")).toBeTruthy();
		});
	});

	it("opens the reminder preferences in Bildirimler", async () => {
		await openProfile();
		await fireEvent.press(screen.getByTestId("me.reminderPrefs.item"));
		await waitFor(() => {
			expect(screen.getByTestId("inbox.screen")).toBeTruthy();
		});
		expect(screen.getByTestId("inbox.reminder.3")).toBeTruthy();
	});

	it("error: shows a Turkish message and retries", async () => {
		const api = createTestProfileApi();
		const real = api.getMyProfile.bind(api);
		api.getMyProfile = jest
			.fn()
			.mockRejectedValueOnce(new ApiError("network"))
			.mockImplementation(real);
		provideTestProfileApi(api);
		await renderRouter(appRoutes, { initialUrl: "/me" });
		await waitFor(() => {
			expect(screen.getByText(tr.error.offline)).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("me.error.retry.button"));
		await waitFor(() => {
			expect(screen.getByTestId("me.name.text")).toHaveTextContent("Test");
		});
	});

	it("signs out back to welcome and forgets the cached data", async () => {
		const queryClient = createTestQueryClient();
		provideTestQueryClient(queryClient);
		await openProfile();
		await fireEvent.press(screen.getByTestId("me.signOut.button"));
		await waitFor(() => {
			expect(useSession.getState().user).toBeNull();
		});
		expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
		await waitFor(() => {
			expect(screen.getByTestId("welcome.screen")).toBeTruthy();
		});
	});
});

describe("ID ile bulunabilirlik", () => {
	async function openDiscoverability() {
		await renderRouter(appRoutes, { initialUrl: "/me/discoverability" });
		await waitFor(() => {
			expect(screen.getByTestId("discoverability.id.text")).toBeTruthy();
		});
	}

	it("switches between Herkes and Kimse", async () => {
		const api = createTestProfileApi();
		const set = jest.spyOn(api, "setIdDiscoverable");
		provideTestProfileApi(api);
		await openDiscoverability();
		expect(screen.getByTestId("discoverability.mode.everyone")).toBeSelected();
		await fireEvent.press(screen.getByTestId("discoverability.mode.nobody"));
		await waitFor(() => {
			expect(set).toHaveBeenCalledWith(false);
		});
		await waitFor(() => {
			expect(screen.getByTestId("discoverability.mode.nobody")).toBeSelected();
		});
	});

	it("takes a new ID only after confirming, then waits 30 days", async () => {
		await openDiscoverability();
		expect(screen.getByTestId("discoverability.id.text")).toHaveTextContent("PN-48K7QZ");
		await fireEvent.press(screen.getByTestId("discoverability.newId.button"));
		expect(
			screen.getByText(fill(tr.discoverability.confirmBody, { id: "PN-48K7QZ" })),
		).toBeTruthy();
		await fireEvent.press(screen.getByTestId("discoverability.confirm.button"));
		await waitFor(() => {
			expect(screen.getByTestId("discoverability.id.text")).not.toHaveTextContent(
				"PN-48K7QZ",
			);
		});
		expect(screen.getByTestId("discoverability.done.text")).toBeTruthy();
		expect(screen.getByTestId("discoverability.newId.button")).toBeDisabled();
		// 30 days from TEST_NOW (11 Ekim 2026).
		expect(screen.getByTestId("discoverability.newIdAfter.text")).toHaveTextContent(
			fill(tr.discoverability.newIdAfter, { date: "10 Kasım 2026" }),
		);
	});

	it("keeps the button closed while the 30 days run", async () => {
		provideTestProfileApi(
			createTestProfileApi({ profile: { can_regenerate_at: "2026-10-20T09:00:00.000Z" } }),
		);
		await openDiscoverability();
		expect(screen.getByTestId("discoverability.newId.button")).toBeDisabled();
	});
});
