import { renderRouter, screen, waitFor, within } from "expo-router/testing-library";

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
	});

	it("the login step promises never to ask for bank passwords", async () => {
		await renderRouter(appRoutes, { initialUrl: "/login" });
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

	it("deciding on a shared plan says that approving moves no money", async () => {
		await renderRouter(appRoutes, { initialUrl: `/agreement/${SEED_IDS.zeynepShare}/decide` });
		await waitFor(() => {
			expect(screen.getByTestId("decide.amount")).toHaveTextContent("6.000,00 TL");
		});
		expect(screen.getByText(tr.decide.noMoneyMoves)).toBeTruthy();
	});
});
