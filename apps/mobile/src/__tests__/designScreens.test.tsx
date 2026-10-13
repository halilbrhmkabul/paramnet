import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";

import { SEED_IDS } from "@/api/mock/seed";
import { resetSession } from "@/features/auth/sessionStore";
import { tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { signInForTest } from "@/testing/session";

// F3-11 part 3: the design's trust notes and request rows (designs 01, 02, 06, 16).
describe("signed out", () => {
	beforeEach(() => {
		resetSession();
	});

	it("welcome shows the brand and says the app never moves money", async () => {
		await renderRouter(appRoutes, { initialUrl: "/" });
		expect(screen.getByTestId("welcome.brand")).toBeTruthy();
		expect(screen.getByText(tr.welcome.disclaimer)).toBeTruthy();
		expect(screen.getByTestId("welcome.dots")).toBeTruthy();
	});

	it("the phone step promises never to ask for bank passwords", async () => {
		await renderRouter(appRoutes, { initialUrl: "/phone" });
		expect(screen.getByText(tr.phone.trustNote)).toBeTruthy();
	});
});

describe("signed in", () => {
	beforeEach(() => {
		signInForTest();
	});

	it("a request row names the action it needs", async () => {
		await renderRouter(appRoutes, { initialUrl: "/requests" });
		await waitFor(() => {
			expect(screen.getByTestId(`requests.item.${SEED_IDS.zeynepShare}`)).toBeTruthy();
		});
		expect(
			within(screen.getByTestId(`requests.item.${SEED_IDS.zeynepShare}`)).getByText(
				tr.requests.actionAnswer,
			),
		).toBeTruthy();
	});

	it("Bildirimler (design 06): filters between what needs me and payment reminders", async () => {
		await renderRouter(appRoutes, { initialUrl: "/requests" });
		await waitFor(() => {
			expect(screen.getByTestId("requests.section.reminders")).toBeTruthy();
		});
		// Ahmet's overdue installment and today's furniture installment fall in the 3-day window.
		expect(screen.getAllByTestId(/^requests\.reminder\./).length).toBeGreaterThan(0);
		await fireEvent.press(screen.getByTestId("requests.filter.actions"));
		expect(screen.queryByTestId("requests.section.reminders")).toBeNull();
		expect(screen.getByTestId(`requests.item.${SEED_IDS.zeynepShare}`)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("requests.filter.reminders"));
		expect(screen.queryByTestId("requests.section.actions")).toBeNull();
	});

	it("deciding on a shared plan says that approving moves no money", async () => {
		await renderRouter(appRoutes, { initialUrl: `/agreement/${SEED_IDS.zeynepShare}/decide` });
		await waitFor(() => {
			expect(screen.getByTestId("decide.amount")).toHaveTextContent("₺6.000,00");
		});
		expect(screen.getByText(tr.decide.noMoneyMoves)).toBeTruthy();
	});
});
