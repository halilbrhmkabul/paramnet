import { addDays, formatDateTR, formatTRY, todayInIstanbul } from "@paramnet/shared";

import type { NotificationPayload, ReminderDay } from "@/api/types";
import { fill, tr } from "@/i18n/tr";

export type InboxGroup = "today" | "week" | "older";

export const REMINDER_DAYS: readonly ReminderDay[] = [7, 3, 1, 0];

const WEEK_DAYS = 7;
// Europe/Istanbul has no DST since 2016 (ADR-011): a fixed offset turns a timestamp into local time.
const ISTANBUL_OFFSET_MS = 3 * 3600 * 1000;

function localClock(timestamp: string): string {
	return new Date(new Date(timestamp).getTime() + ISTANBUL_OFFSET_MS).toISOString().slice(11, 16);
}

// Design 06: Bugün, Bu hafta (the six days before), Daha eski; days are Istanbul days.
export function groupOf(createdAt: string, now: Date): InboxGroup {
	const day = todayInIstanbul(new Date(createdAt));
	const today = todayInIstanbul(now);
	if (day === today) {
		return "today";
	}
	return day > addDays(today, -WEEK_DAYS) ? "week" : "older";
}

// "09:05" today, "Dün 21:40" yesterday, "6 Eki" before that.
export function timeLabel(createdAt: string, now: Date): string {
	const day = todayInIstanbul(new Date(createdAt));
	const today = todayInIstanbul(now);
	if (day === today) {
		return localClock(createdAt);
	}
	if (day === addDays(today, -1)) {
		return fill(tr.inbox.yesterday, { time: localClock(createdAt) });
	}
	return formatDateTR(day, "short").replace(/ \d{4}$/, "");
}

function isTemplate(template: string): template is keyof typeof tr.inbox.titles {
	return template in tr.inbox.titles;
}

// A short title with the other party's name, and the facts (installment, amount, date, remaining) on one
// line below it, as in the design; the push texts themselves are rendered on the server.
export function notificationText(
	template: string,
	payload: NotificationPayload,
): { title: string; detail: string } {
	if (!isTemplate(template)) {
		return { title: tr.inbox.fallbackTitle, detail: "" };
	}
	const parts: string[] = [];
	if (payload.seq !== undefined && payload.count !== undefined && payload.count > 1) {
		parts.push(fill(tr.inbox.installment, { seq: String(payload.seq) }));
	}
	if (payload.amount_minor !== undefined) {
		parts.push(formatTRY(payload.amount_minor));
	}
	if (payload.due_date !== undefined) {
		parts.push(formatDateTR(payload.due_date, "long"));
	}
	if (payload.remaining_minor !== undefined) {
		parts.push(fill(tr.inbox.remaining, { amount: formatTRY(payload.remaining_minor) }));
	}
	return {
		title: fill(tr.inbox.titles[template], { name: payload.name ?? "" }).trim(),
		detail: parts.join(" · "),
	};
}

// Profil's "Bildirim tercihleri" value: "3 gün önce, Vade günü".
export function reminderSummary(days: readonly ReminderDay[]): string {
	const chosen = REMINDER_DAYS.filter((day) => days.includes(day));
	return chosen.length === 0
		? tr.me.remindersOff
		: chosen.map((day) => tr.inbox.reminderDays[day]).join(", ");
}
