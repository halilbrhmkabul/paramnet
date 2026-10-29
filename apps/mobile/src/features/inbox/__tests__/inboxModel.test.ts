import { groupOf, notificationText, timeLabel } from "../inboxModel";
import { fill, tr } from "@/i18n/tr";

// 2026-10-11 12:00 in Istanbul.
const NOW = new Date("2026-10-11T09:00:00Z");

describe("inbox model", () => {
	it("groups by Istanbul day: today, the last 7 days, older", () => {
		expect(groupOf("2026-10-10T21:30:00Z", NOW)).toBe("today"); // 00:30 on the 11th in Istanbul
		expect(groupOf("2026-10-10T20:30:00Z", NOW)).toBe("week"); // 23:30 on the 10th
		expect(groupOf("2026-10-05T09:00:00Z", NOW)).toBe("week");
		expect(groupOf("2026-10-03T20:00:00Z", NOW)).toBe("older");
	});

	it("labels the time: clock today, Dün yesterday, a short date before", () => {
		expect(timeLabel("2026-10-11T06:05:00Z", NOW)).toBe("09:05");
		expect(timeLabel("2026-10-10T18:40:00Z", NOW)).toBe(
			fill(tr.inbox.yesterday, { time: "21:40" }),
		);
		expect(timeLabel("2026-10-06T09:00:00Z", NOW)).toBe("6 Eki");
	});

	it("builds a short title and a detail line from the payload", () => {
		expect(
			notificationText("dueSoon", {
				name: "Yıldız Mobilya",
				amount_minor: 333333,
				due_date: "2026-10-15",
				seq: 3,
				count: 6,
			}),
		).toEqual({
			title: "Yıldız Mobilya ödemesi yaklaşıyor",
			detail: "3. taksit · 3.333,33 TL · 15 Ekim 2026",
		});
		expect(
			notificationText("paymentConfirmed", {
				name: "Mert Demir",
				amount_minor: 150000,
				remaining_minor: 350000,
			}),
		).toEqual({
			title: "Mert Demir ödemeni onayladı",
			detail: "1.500,00 TL · Kalan 3.500,00 TL",
		});
		expect(
			notificationText("dueToday", { name: "Ahmet", amount_minor: 100, count: 1, seq: 1 }),
		).toEqual({ title: "Bugün ödeme günü: Ahmet", detail: "1,00 TL" });
		expect(notificationText("somethingNew", {})).toEqual({
			title: tr.inbox.fallbackTitle,
			detail: "",
		});
	});

	it("has a title for every template the server sends", () => {
		const templates = [
			"dueSoon",
			"dueToday",
			"overdue1",
			"overdue7",
			"paymentReported",
			"paymentPending",
			"paymentConfirmed",
			"paymentRecorded",
			"paymentRejected",
			"amendmentProposed",
			"amendmentAccepted",
			"amendmentRejected",
			"disputeOpened",
			"disputeResolved",
			"cancelRequested",
			"cancelAccepted",
			"cancelRejected",
			"forgiven",
			"shareReceived",
			"shareAccepted",
			"shareCountered",
			"shareRejected",
			"counterAccepted",
			"shareWithdrawn",
			"inviteExpired",
			"settled",
			"splitReminder",
		];
		expect(Object.keys(tr.inbox.titles).sort()).toEqual([...templates].sort());
	});
});
