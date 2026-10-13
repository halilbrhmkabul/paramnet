import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";

import { SEED_IDS } from "@/api/mock/seed";
import { tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

async function openCalendar() {
	await renderRouter(appRoutes, { initialUrl: "/calendar" });
	await waitFor(() => {
		expect(screen.getByTestId("calendar.day.2026-10-11")).toBeTruthy();
	});
}

describe("Calendar (S18, design 26)", () => {
	it("shows the current month with Monday-first weeks and marks due days", async () => {
		await openCalendar();
		expect(screen.getByTestId("calendar.month.text")).toHaveTextContent("Ekim 2026");
		// 1 Oct 2026 is a Thursday: three blank cells before it.
		expect(screen.getAllByTestId(/^calendar\.blank\./)).toHaveLength(3);
		expect(screen.getByTestId("calendar.day.2026-10-01")).toHaveProp(
			"accessibilityLabel",
			"1 Ekim, 1 ödeme, gecikmiş var",
		);
		expect(screen.getByTestId("calendar.day.2026-10-16")).toHaveProp(
			"accessibilityLabel",
			"16 Ekim, 1 ödeme",
		);
		expect(screen.getByTestId("calendar.day.2026-10-02")).toHaveProp(
			"accessibilityLabel",
			"2 Ekim",
		);
	});

	it("lists today's items by default and another day after selecting it", async () => {
		await openCalendar();
		const today = screen.getByTestId("calendar.dayList");
		expect(within(today).getByText("11 Ekim Pazar · Bugün")).toBeTruthy();
		expect(within(today).getByText("Mobilya 1/5")).toBeTruthy();
		expect(within(today).getByText("Yıldız Mobilya")).toBeTruthy();

		await fireEvent.press(screen.getByTestId("calendar.day.2026-10-01"));
		const first = screen.getByTestId("calendar.dayList");
		expect(within(first).getByText("Borç 2/3")).toBeTruthy();
		expect(
			within(first).getByText(tr.installment.status.overdue, { exact: false }),
		).toBeTruthy();

		await fireEvent.press(screen.getByTestId("calendar.day.2026-10-02"));
		expect(screen.getByText(tr.calendar.dayEmpty)).toBeTruthy();
	});

	it("moves between months", async () => {
		await openCalendar();
		await fireEvent.press(screen.getByTestId("calendar.next.button"));
		await waitFor(() => {
			expect(screen.getByTestId("calendar.month.text")).toHaveTextContent("Kasım 2026");
		});
		await waitFor(() => {
			expect(screen.getByTestId("calendar.day.2026-11-01")).toHaveProp(
				"accessibilityLabel",
				"1 Kasım, 1 ödeme",
			);
		});
		await fireEvent.press(screen.getByTestId("calendar.prev.button"));
		await fireEvent.press(screen.getByTestId("calendar.prev.button"));
		await waitFor(() => {
			expect(screen.getByTestId("calendar.month.text")).toHaveTextContent("Eylül 2026");
		});
	});

	it("opens the agreement from a listed item", async () => {
		await openCalendar();
		await fireEvent.press(screen.getByTestId(`calendar.item.${SEED_IDS.yildizFurniture}.1`));
		await waitFor(() => {
			expect(screen.getByTestId("agreement.screen")).toBeTruthy();
		});
	});

	it("7 gün / 30 gün / Geciken list what falls in that window", async () => {
		await openCalendar();
		await fireEvent.press(screen.getByTestId("calendar.mode.week"));
		await waitFor(() => {
			expect(screen.getByTestId(`calendar.item.${SEED_IDS.yildizFurniture}.1`)).toBeTruthy();
		});
		// Mert's first installment is in 5 days, Ahmet's overdue one is not in the window.
		expect(screen.getByTestId(`calendar.item.${SEED_IDS.mertSale}.1`)).toBeTruthy();
		expect(screen.queryByTestId(`calendar.item.${SEED_IDS.ahmetLoan}.2`)).toBeNull();

		await fireEvent.press(screen.getByTestId("calendar.mode.overdue"));
		await waitFor(() => {
			expect(screen.getByTestId(`calendar.item.${SEED_IDS.ahmetLoan}.2`)).toBeTruthy();
		});
		expect(screen.queryByTestId(`calendar.item.${SEED_IDS.yildizFurniture}.1`)).toBeNull();
	});
});
