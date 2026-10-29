import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";

import { SEED_IDS } from "@/api/mock/seed";
import { tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import {
	createTestAccountsApi,
	createTestApi,
	provideTestAccountsApi,
	provideTestApi,
} from "@/testing/providers";
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

const dayList = () => within(screen.getByTestId("calendar.dayList"));

describe("Calendar (design 26)", () => {
	it("shows the month with Monday-first weeks and marks every module's days", async () => {
		await openCalendar();
		expect(screen.getByTestId("calendar.range.month")).toHaveProp(
			"accessibilityLabel",
			"Ekim 2026",
		);
		// 1 Oct 2026 is a Thursday: three blank cells before it.
		expect(screen.getAllByTestId(/^calendar\.blank\./)).toHaveLength(3);
		// A late agreement installment and the recorded salary.
		expect(screen.getByTestId("calendar.day.2026-10-01")).toHaveProp(
			"accessibilityLabel",
			"1 Ekim, 2 işlem, gecikmiş var",
		);
		// The card's statement cut and its payment day.
		expect(screen.getByTestId("calendar.day.2026-10-09")).toHaveProp(
			"accessibilityLabel",
			"9 Ekim, 1 işlem",
		);
		expect(screen.getByTestId("calendar.day.2026-10-02")).toHaveProp(
			"accessibilityLabel",
			"2 Ekim",
		);
		expect(screen.getAllByText(tr.calendar.legend.expected).length).toBeGreaterThan(0);
	});

	it("lists the selected day's items from agreements, cards, repeating records and cash", async () => {
		await openCalendar();
		expect(dayList().getByText("11 Ekim Pazar · Bugün")).toBeTruthy();
		expect(dayList().getByText("Yıldız Mobilya · Ödeme")).toBeTruthy();

		await fireEvent.press(screen.getByTestId("calendar.day.2026-10-19"));
		expect(dayList().getByText("Yapı Kredi World son ödeme")).toBeTruthy();
		expect(dayList().getByText("Asgari 4.980,00 TL")).toBeTruthy();
		expect(dayList().getByText("12.450,00 TL")).toBeTruthy();

		await fireEvent.press(screen.getByTestId("calendar.day.2026-10-03"));
		expect(dayList().getByText("Kira")).toBeTruthy();
		expect(dayList().getByText(tr.calendar.status.waiting)).toBeTruthy();

		await fireEvent.press(screen.getByTestId("calendar.day.2026-10-08"));
		expect(dayList().getByText("Elektrik faturası")).toBeTruthy();
		expect(dayList().getByText("−842,30 TL")).toBeTruthy();
		expect(dayList().getByText(tr.calendar.status.paid)).toBeTruthy();

		await fireEvent.press(screen.getByTestId("calendar.day.2026-10-02"));
		expect(screen.getByText(tr.calendar.dayEmpty)).toBeTruthy();
	});

	it("switches to the next 7 days and to what is late", async () => {
		await openCalendar();
		await fireEvent.press(screen.getByTestId("calendar.range.week"));
		const week = within(screen.getByTestId("calendar.rangeList"));
		expect(week.getByText("11 Ekim Pazar · Bugün")).toBeTruthy();
		expect(week.queryByText("Yapı Kredi World son ödeme")).toBeNull();

		await fireEvent.press(screen.getByTestId("calendar.range.days30"));
		expect(
			within(screen.getByTestId("calendar.rangeList")).getByText(
				"Yapı Kredi World son ödeme",
			),
		).toBeTruthy();

		await fireEvent.press(screen.getByTestId("calendar.range.overdue"));
		const late = within(screen.getByTestId("calendar.rangeList"));
		expect(late.getByText("Ahmet Yılmaz · Beklenen tahsilat")).toBeTruthy();
		expect(late.getByText("Kira")).toBeTruthy();
	});

	it("projects the next 30 days of cash from Toplam Nakit", async () => {
		await openCalendar();
		const card = within(screen.getByTestId("calendar.projection"));
		expect(card.getByText(tr.calendar.projection.title)).toBeTruthy();
		expect(screen.getByTestId("calendar.projection.bars")).toBeTruthy();
		expect(screen.getByTestId("calendar.projection.note")).toHaveTextContent(/En düşük nokta/);
	});

	it("asks for accounts before projecting cash", async () => {
		provideTestApi(createTestApi({ seed: "empty" }));
		provideTestAccountsApi(createTestAccountsApi({ seed: "empty" }));
		await renderRouter(appRoutes, { initialUrl: "/calendar" });
		await waitFor(() => {
			expect(screen.getByTestId("calendar.projection.addAccount")).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("calendar.range.overdue"));
		expect(screen.getByText(tr.calendar.overdueEmpty)).toBeTruthy();
	});

	it("moves between months", async () => {
		await openCalendar();
		await fireEvent.press(screen.getByTestId("calendar.next.button"));
		await waitFor(() => {
			expect(screen.getByTestId("calendar.range.month")).toHaveProp(
				"accessibilityLabel",
				"Kasım 2026",
			);
		});
		await waitFor(() => {
			expect(screen.getByTestId("calendar.day.2026-11-01")).toHaveProp(
				"accessibilityLabel",
				"1 Kasım, 2 işlem",
			);
		});
		await fireEvent.press(screen.getByTestId("calendar.prev.button"));
		await fireEvent.press(screen.getByTestId("calendar.prev.button"));
		await waitFor(() => {
			expect(screen.getByTestId("calendar.range.month")).toHaveProp(
				"accessibilityLabel",
				"Eylül 2026",
			);
		});
	});

	it("opens the agreement from a listed item", async () => {
		await openCalendar();
		await fireEvent.press(
			screen.getByTestId(`calendar.item.agreement.${SEED_IDS.yildizFurniture}.1`),
		);
		await waitFor(() => {
			expect(screen.getByTestId("agreement.screen")).toBeTruthy();
		});
	});
});
