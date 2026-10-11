import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { SEED_IDS } from "@/api/mock/seed";
import { fill, tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { createTestApi, provideTestApi } from "@/testing/providers";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

async function openFromRequests() {
	await renderRouter(appRoutes, { initialUrl: "/requests" });
	await waitFor(() => {
		expect(screen.getByTestId(`requests.item.${SEED_IDS.zeynepShare}`)).toBeTruthy();
	});
	expect(screen.getByTestId(`requests.item.${SEED_IDS.zeynepShare}`)).toHaveTextContent(
		fill(tr.requests.shared, { name: "Zeynep Arslan" }),
		{ exact: false },
	);
	await fireEvent.press(screen.getByTestId(`requests.item.${SEED_IDS.zeynepShare}`));
	await waitFor(() => {
		expect(screen.getByTestId("decide.role")).toBeTruthy();
	});
}

describe("Incoming share (S14)", () => {
	it("shows the plan from my side and accepting makes it an active agreement", async () => {
		await openFromRequests();
		expect(screen.getByText(fill(tr.invite.title, { name: "Zeynep Arslan" }))).toBeTruthy();
		expect(screen.getByTestId("decide.role")).toHaveTextContent(tr.agreement.youOwe);
		expect(screen.getByTestId("decide.proposed.total")).toHaveTextContent("6.000,00 TL");
		expect(screen.getAllByTestId(/^decide\.proposed\.row\./)).toHaveLength(3);
		expect(screen.queryByTestId("decide.current")).toBeNull();

		await fireEvent.press(screen.getByTestId("decide.accept.button"));
		await waitFor(() => {
			expect(screen.getByTestId("agreement.status.badge")).toHaveTextContent(
				tr.agreement.status.active,
			);
		});
		expect(screen.getByTestId("agreement.counterparty.text")).toHaveTextContent(
			"Zeynep Arslan",
		);
		expect(screen.getByTestId("agreement.outstanding.text")).toHaveTextContent("6.000,00 TL");
	});

	it("a counter offer must keep the total", async () => {
		await openFromRequests();
		await fireEvent.press(screen.getByTestId("decide.counter.button"));
		await fireEvent.changeText(screen.getByTestId("decide.editor.1.amount"), "1000");
		expect(screen.getByTestId("decide.editor.error")).toHaveTextContent(tr.form.sumMismatch);
		expect(screen.getByTestId("decide.counter.send")).toBeDisabled();
		await fireEvent.changeText(screen.getByTestId("decide.editor.1.amount"), "2000");
		await fireEvent.press(screen.getByTestId("decide.counter.send"));
		await waitFor(() => {
			expect(screen.getByTestId("agreement.screen")).toBeTruthy();
		});
	});

	it("rejecting leaves Talepler empty", async () => {
		const api = createTestApi();
		provideTestApi(api);
		await openFromRequests();
		await fireEvent.press(screen.getByTestId("decide.reject.button"));
		await waitFor(() => {
			expect(screen.getByTestId("home.screen")).toBeTruthy();
		});
		expect(await api.listRequests()).toEqual([]);
	});
});

describe("Invite link in the app (deep-links.md)", () => {
	it("the invite for my number opens the decision", async () => {
		await renderRouter(appRoutes, { initialUrl: "/invite/demo-incoming" });
		await waitFor(() => {
			expect(screen.getByTestId("decide.role")).toBeTruthy();
		});
	});

	it("an unknown or used link explains itself", async () => {
		await renderRouter(appRoutes, { initialUrl: "/invite/unknown" });
		await waitFor(() => {
			expect(screen.getByText(tr.inviteLink.invalidTitle)).toBeTruthy();
		});
	});
});
