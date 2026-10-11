import { todayInIstanbul, type IsoDate } from "@paramnet/shared";

// The picker runs in Europe/Istanbul (timeZoneName), so a calendar day is noon of that day in +03:00;
// noon keeps the instant inside the same day whatever the device zone is.
export function dateForPicker(day: IsoDate): Date {
	return new Date(`${day}T12:00:00+03:00`);
}

export function dayFromPicker(date: Date): IsoDate {
	return todayInIstanbul(date);
}
