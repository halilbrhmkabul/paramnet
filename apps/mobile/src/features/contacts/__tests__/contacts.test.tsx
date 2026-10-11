import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";

import { SEED_IDS } from "@/api/mock/seed";
import { useNewDraft } from "@/features/new/draftStore";
import { tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { createTestApi, provideTestApi } from "@/testing/providers";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

describe("Contacts (S06)", () => {
	it("lists each person with a signed net balance and filters by name", async () => {
		await renderRouter(appRoutes, { initialUrl: "/contacts" });
		await waitFor(() => {
			expect(screen.getByTestId(`contacts.item.${SEED_IDS.ahmet}`)).toBeTruthy();
		});
		const ahmet = screen.getByTestId(`contacts.item.${SEED_IDS.ahmet}`);
		expect(within(ahmet).getByText(tr.agreement.owesYou)).toBeTruthy();
		expect(within(ahmet).getByText("6.500,00 TL")).toBeTruthy();
		const yildiz = screen.getByTestId(`contacts.item.${SEED_IDS.yildiz}`);
		expect(within(yildiz).getByText(tr.agreement.youOwe)).toBeTruthy();
		expect(within(yildiz).getByText("20.000,00 TL")).toBeTruthy();

		await fireEvent.changeText(screen.getByTestId("contacts.search.input"), "eli");
		expect(screen.queryByTestId(`contacts.item.${SEED_IDS.ahmet}`)).toBeNull();
		expect(screen.getByTestId(`contacts.item.${SEED_IDS.elif}`)).toBeTruthy();
	});

	it("empty: explains how people appear", async () => {
		provideTestApi(createTestApi({ seed: "empty" }));
		await renderRouter(appRoutes, { initialUrl: "/contacts" });
		await waitFor(() => {
			expect(screen.getByText(tr.contacts.emptyTitle)).toBeTruthy();
		});
	});
});

describe("Contact detail (S07)", () => {
	it("shows the net balance and every agreement with that person", async () => {
		await renderRouter(appRoutes, { initialUrl: "/contacts" });
		await waitFor(() => {
			expect(screen.getByTestId(`contacts.item.${SEED_IDS.mert}`)).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId(`contacts.item.${SEED_IDS.mert}`));
		await waitFor(() => {
			expect(screen.getByTestId("contact.net.amount")).toHaveTextContent("9.000,00 TL");
		});
		expect(screen.getByTestId("contact.name.text")).toHaveTextContent("Mert Demir");
		expect(screen.getByTestId(`contact.agreement.${SEED_IDS.mertSale}`)).toBeTruthy();
		expect(
			within(screen.getByTestId(`contact.agreement.${SEED_IDS.mertLoan}`)).getByText(
				tr.agreement.status.settled,
			),
		).toBeTruthy();
	});

	it("new record puts this person first in the picker", async () => {
		await renderRouter(appRoutes, { initialUrl: `/contact/${SEED_IDS.elif}` });
		await waitFor(() => {
			expect(screen.getByTestId("contact.newRecord.button")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("contact.newRecord.button"));
		expect(useNewDraft.getState().lastContactId).toBe(SEED_IDS.elif);
		await waitFor(() => {
			expect(screen.getByTestId("new.screen")).toBeTruthy();
		});
	});
});
