import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";

import { ApiError } from "@/api/errors";
import { tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { createTestProfileApi, provideTestProfileApi } from "@/testing/providers";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

async function openInbox() {
	await renderRouter(appRoutes, { initialUrl: "/inbox" });
	await waitFor(() => {
		expect(screen.getByTestId("inbox.item.4")).toBeTruthy();
	});
}

describe("Bildirimler (06)", () => {
	it("groups notices by day and marks the unread ones", async () => {
		await openInbox();
		expect(
			within(screen.getByTestId("inbox.group.today")).getByTestId("inbox.item.4"),
		).toBeTruthy();
		expect(
			within(screen.getByTestId("inbox.group.today")).getByTestId("inbox.item.3"),
		).toBeTruthy();
		expect(
			within(screen.getByTestId("inbox.group.week")).getByTestId("inbox.item.2"),
		).toBeTruthy();
		expect(
			within(screen.getByTestId("inbox.group.older")).getByTestId("inbox.item.1"),
		).toBeTruthy();
		expect(screen.getByTestId("inbox.item.4.unread")).toBeTruthy();
		expect(screen.queryByTestId("inbox.item.1.unread")).toBeNull();
		expect(screen.getByText("Zeynep Arslan seninle bir ödeme planı paylaştı")).toBeTruthy();
		expect(screen.getByTestId("inbox.filter.all")).toHaveTextContent("2", { exact: false });
		expect(screen.getByTestId("inbox.filter.approval")).toHaveTextContent("1", {
			exact: false,
		});
	});

	it("filters by category", async () => {
		const api = createTestProfileApi();
		const list = jest.spyOn(api, "listNotifications");
		provideTestProfileApi(api);
		await openInbox();
		await fireEvent.press(screen.getByTestId("inbox.filter.reminder"));
		await waitFor(() => {
			expect(list).toHaveBeenCalledWith("reminder", null);
		});
		await waitFor(() => {
			expect(screen.getByTestId("inbox.item.3")).toBeTruthy();
		});
		expect(screen.queryByTestId("inbox.item.4")).toBeNull();
		expect(screen.getByTestId("inbox.filter.reminder")).toBeSelected();
	});

	it("opens the decision from İncele and marks it read", async () => {
		const api = createTestProfileApi();
		const mark = jest.spyOn(api, "markNotificationsRead");
		provideTestProfileApi(api);
		await openInbox();
		await fireEvent.press(screen.getByTestId("inbox.item.4.review.button"));
		await waitFor(() => {
			expect(screen.getByTestId("decide.screen")).toBeTruthy();
		});
		expect(mark).toHaveBeenCalledWith([4]);
	});

	it("Sonra only marks the notice read", async () => {
		await openInbox();
		await fireEvent.press(screen.getByTestId("inbox.item.4.later.button"));
		await waitFor(() => {
			expect(screen.queryByTestId("inbox.item.4.unread")).toBeNull();
		});
		expect(screen.getByTestId("inbox.screen")).toBeTruthy();
	});

	it("opens the agreement from a reminder", async () => {
		await openInbox();
		await fireEvent.press(screen.getByTestId("inbox.item.3"));
		await waitFor(() => {
			expect(screen.getByTestId("agreement.summary")).toBeTruthy();
		});
	});

	it("marks everything read", async () => {
		await openInbox();
		await fireEvent.press(screen.getByTestId("inbox.markAll.button"));
		await waitFor(() => {
			expect(screen.queryByTestId("inbox.item.4.unread")).toBeNull();
		});
		expect(screen.queryByTestId("inbox.item.3.unread")).toBeNull();
	});

	it("saves the reminder days", async () => {
		const api = createTestProfileApi();
		const set = jest.spyOn(api, "setReminderPrefs");
		provideTestProfileApi(api);
		await openInbox();
		await waitFor(() => {
			expect(screen.getByTestId("inbox.reminder.3")).toBeSelected();
		});
		expect(screen.getByTestId("inbox.reminder.7")).not.toBeSelected();
		await fireEvent.press(screen.getByTestId("inbox.reminder.7"));
		await waitFor(() => {
			expect(set).toHaveBeenCalledWith([7, 3, 0]);
		});
		await waitFor(() => {
			expect(screen.getByTestId("inbox.reminder.7")).toBeSelected();
		});
		await fireEvent.press(screen.getByTestId("inbox.reminder.3"));
		await waitFor(() => {
			expect(set).toHaveBeenLastCalledWith([7, 0]);
		});
	});

	it("empty: explains what will show up", async () => {
		provideTestProfileApi(createTestProfileApi({ inbox: "empty" }));
		await renderRouter(appRoutes, { initialUrl: "/inbox" });
		await waitFor(() => {
			expect(screen.getByTestId("inbox.empty")).toBeTruthy();
		});
		expect(screen.getByText(tr.inbox.emptyTitle)).toBeTruthy();
		expect(screen.getByTestId("inbox.reminder.0")).toBeTruthy();
	});

	it("error: shows a Turkish message and retries", async () => {
		const api = createTestProfileApi();
		const real = api.listNotifications.bind(api);
		api.listNotifications = jest
			.fn()
			.mockRejectedValueOnce(new ApiError("network"))
			.mockImplementation(real);
		provideTestProfileApi(api);
		await renderRouter(appRoutes, { initialUrl: "/inbox" });
		await waitFor(() => {
			expect(screen.getByText(tr.error.offline)).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("inbox.error.retry.button"));
		await waitFor(() => {
			expect(screen.getByTestId("inbox.item.4")).toBeTruthy();
		});
	});
});
