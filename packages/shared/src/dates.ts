// BR-16: due dates are calendar days ("YYYY-MM-DD", same as Postgres `date`).
// ISO day strings sort lexicographically, so plain string comparison orders them.
export type IsoDate = string;

// Turkey has stayed on UTC+03:00 without DST since 2016. A fixed offset avoids relying on
// Hermes' Intl time zone support (ADR-011); a test guards it against the IANA zone.
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type DateParts = { year: number; month: number; day: number };

function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
	if (month === 2) {
		return isLeapYear(year) ? 29 : 28;
	}
	return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

function toParts(value: string): DateParts | null {
	const match = ISO_DATE_PATTERN.exec(value);
	if (match === null) {
		return null;
	}
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
		return null;
	}
	return { year, month, day };
}

function parseOrThrow(value: IsoDate): DateParts {
	const parts = toParts(value);
	if (parts === null) {
		throw new RangeError(`invalid ISO date: ${value}`);
	}
	return parts;
}

function fromParts({ year, month, day }: DateParts): IsoDate {
	return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isIsoDate(value: string): value is IsoDate {
	return toParts(value) !== null;
}

export function todayInIstanbul(now: Date = new Date()): IsoDate {
	const time = now.getTime();
	if (Number.isNaN(time)) {
		throw new RangeError("invalid Date");
	}
	return new Date(time + ISTANBUL_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
	const { year, month, day } = parseOrThrow(date);
	if (!Number.isSafeInteger(days)) {
		throw new RangeError("days must be an integer");
	}
	return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// Always pass the plan's first due date with the installment offset, not the previous due date;
// otherwise a clamp (31 Jan → 28 Feb) would drift every later month to the 28th.
export function addMonthsClamped(date: IsoDate, months: number): IsoDate {
	const { year, month, day } = parseOrThrow(date);
	if (!Number.isSafeInteger(months) || months < 0) {
		throw new RangeError("months must be a non-negative integer");
	}
	const monthIndex = year * 12 + (month - 1) + months;
	const nextYear = Math.floor(monthIndex / 12);
	const nextMonth = (monthIndex % 12) + 1;
	return fromParts({
		year: nextYear,
		month: nextMonth,
		day: Math.min(day, daysInMonth(nextYear, nextMonth)),
	});
}

// Hand-written like formatTRY (ADR-010): Hermes' Intl month names depend on device ICU.
const MONTHS_LONG = [
	"Ocak",
	"Şubat",
	"Mart",
	"Nisan",
	"Mayıs",
	"Haziran",
	"Temmuz",
	"Ağustos",
	"Eylül",
	"Ekim",
	"Kasım",
	"Aralık",
] as const;
const MONTHS_SHORT = [
	"Oca",
	"Şub",
	"Mar",
	"Nis",
	"May",
	"Haz",
	"Tem",
	"Ağu",
	"Eyl",
	"Eki",
	"Kas",
	"Ara",
] as const;

export type DateStyle = "short" | "long" | "dayMonth";

export function formatDateTR(date: IsoDate, style: DateStyle): string {
	const { year, month, day } = parseOrThrow(date);
	if (style === "short") {
		return `${String(day)} ${MONTHS_SHORT[month - 1] ?? ""} ${String(year)}`;
	}
	const monthName = MONTHS_LONG[month - 1] ?? "";
	return style === "long"
		? `${String(day)} ${monthName} ${String(year)}`
		: `${String(day)} ${monthName}`;
}

export function monthName(month: number): string {
	const name = MONTHS_LONG[month - 1];
	if (name === undefined) {
		throw new RangeError("month must be 1..12");
	}
	return name;
}

export function monthOf(date: IsoDate): IsoDate {
	const { year, month } = parseOrThrow(date);
	return fromParts({ year, month, day: 1 });
}

export function daysOfMonth(date: IsoDate): IsoDate[] {
	const { year, month } = parseOrThrow(date);
	return Array.from({ length: daysInMonth(year, month) }, (_, i) =>
		fromParts({ year, month, day: i + 1 }),
	);
}

export function isoWeekday(date: IsoDate): number {
	const { year, month, day } = parseOrThrow(date);
	const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
	return weekday === 0 ? 7 : weekday;
}

// Event times (timestamptz) shown as "10 Kas 2026, 14:05" in Istanbul time (ADR-011 fixed offset).
export function formatDateTimeTR(timestamp: string): string {
	const time = new Date(timestamp).getTime();
	if (Number.isNaN(time)) {
		throw new RangeError("invalid timestamp");
	}
	const local = new Date(time + ISTANBUL_OFFSET_MS).toISOString();
	return `${formatDateTR(local.slice(0, 10), "short")}, ${local.slice(11, 16)}`;
}
