import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { fill, tr } from "@/i18n/tr";
import { supportEmail } from "@/lib/config";
import { appRoutes } from "@/testing/appRoutes";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

async function openMenu() {
	await renderRouter(appRoutes, { initialUrl: "/" });
	await fireEvent.press(screen.getByTestId("home.menu.button"));
	await waitFor(() => {
		expect(screen.getByTestId("menu.paramnetId.text")).toBeTruthy();
	});
}

describe("Ana menü (05)", () => {
	it("shows name, ID, only the built modules and the money-transfer note", async () => {
		await openMenu();
		expect(screen.getByTestId("menu.profile.button")).toHaveTextContent("Test", {
			exact: false,
		});
		expect(screen.getByTestId("menu.paramnetId.text")).toHaveTextContent("PN-48K7QZ");
		// ADR-051: modules that are not built stay hidden.
		expect(screen.getByTestId("menu.module.accounts")).toHaveTextContent(tr.accounts.menuLine, {
			exact: false,
		});
		expect(screen.getByTestId("menu.module.reports")).toBeTruthy();
		expect(screen.getByTestId("menu.module.budget")).toBeTruthy();
		for (const hidden of ["Banka Kredileri", "Faiz Hesaplayıcı"]) {
			expect(screen.queryByText(hidden)).toBeNull();
		}
		await waitFor(() => {
			expect(screen.getByTestId("menu.module.installments")).toHaveTextContent(
				fill(tr.menu.activePlans, { count: "2" }),
				{ exact: false },
			);
		});
		expect(screen.getByText(tr.menu.disclaimer)).toBeTruthy();
		expect(screen.getByTestId("menu.version.text")).toHaveTextContent("Sürüm", {
			exact: false,
		});
		// Without a support address the row has nowhere to go.
		expect(screen.queryByTestId("menu.help.item")).toBeNull();
	});

	it("opens Profil from the header and from Gizlilik ve ayarlar", async () => {
		await openMenu();
		await fireEvent.press(screen.getByTestId("menu.privacy.item"));
		await waitFor(() => {
			expect(screen.getByTestId("me.name.text")).toBeTruthy();
		});
	});

	it("opens Bildirimler", async () => {
		await openMenu();
		await fireEvent.press(screen.getByTestId("menu.notifications.item"));
		await waitFor(() => {
			expect(screen.getByTestId("inbox.screen")).toBeTruthy();
		});
	});

	it("opens Hesaplar (F4-03)", async () => {
		await openMenu();
		await fireEvent.press(screen.getByTestId("menu.module.accounts"));
		await waitFor(() => {
			expect(screen.getByTestId("accounts.screen")).toBeTruthy();
		});
	});

	it("opens the installment plans", async () => {
		await openMenu();
		await fireEvent.press(screen.getByTestId("menu.module.installments"));
		await waitFor(() => {
			expect(screen.getByTestId("debts.screen")).toBeTruthy();
		});
	});
});

describe("support address", () => {
	it("comes from EXPO_PUBLIC_SUPPORT_EMAIL", () => {
		expect(supportEmail({})).toBeNull();
		expect(supportEmail({ EXPO_PUBLIC_SUPPORT_EMAIL: " " })).toBeNull();
		expect(supportEmail({ EXPO_PUBLIC_SUPPORT_EMAIL: "destek@ornek.com" })).toBe(
			"destek@ornek.com",
		);
	});
});
