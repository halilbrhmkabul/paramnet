import {
	formatDateTR,
	formatDateTimeTR,
	isoWeekday,
	monthName,
	type IsoDate,
} from "@paramnet/shared";

import { nextAmountState } from "@/components/amountInputModel";
import type { Account, Transaction, TransactionEvent } from "@/api/types";
import { fill, tr } from "@/i18n/tr";

// 99.999.999.999 TL: stays under the server's limit (CASH_AMOUNT_MAX_MINOR).
const MAX_LIRA_DIGITS = 11;

// Design 22 keypad: digits, one comma, two decimals; "del" removes the last character.
export function pressKey(text: string, key: string): string {
	if (key === "del") {
		return text.slice(0, -1);
	}
	const [lira = "", decimals] = text.split(",");
	if (key === ",") {
		return decimals === undefined ? `${lira === "" ? "0" : lira},` : text;
	}
	if (decimals !== undefined) {
		return decimals.length >= 2 ? text : `${text}${key}`;
	}
	if (lira.length >= MAX_LIRA_DIGITS) {
		return text;
	}
	return lira === "0" ? key : `${text}${key}`;
}

// What the keypad shows for a stored amount: digits and an optional comma, no grouping dots.
export function keypadText(minor: number): string {
	const lira = String(Math.floor(minor / 100));
	const kurus = minor % 100;
	return kurus === 0 ? lira : `${lira},${String(kurus).padStart(2, "0")}`;
}

// Integer kuruş, read the same way as AmountInput.
export function amountOf(text: string): number | null {
	return nextAmountState(text, text).value;
}

export type CashFilter = "all" | "income" | "expense" | "transfer";

export function categoryLabel(tx: {
	kind: Transaction["kind"];
	category: string | null;
}): string | null {
	if (tx.category === null) {
		return null;
	}
	if (tx.kind === "income") {
		const labels: Record<string, string> = tr.categories.income;
		return labels[tx.category] ?? null;
	}
	const labels: Record<string, string> = tr.categories.expense;
	return labels[tx.category] ?? null;
}

export function titleOf(tx: Transaction): string {
	if (tx.title !== null) {
		return tx.title;
	}
	if (tx.kind === "transfer") {
		return fill(tr.txHistory.transferTitle, {
			from: tx.account_name,
			to: tx.to_account_name ?? "",
		});
	}
	if (tx.kind === "adjustment") {
		return tr.txHistory.adjustmentTitle;
	}
	return categoryLabel(tx) ?? "";
}

export function signOf(tx: Pick<Transaction, "kind" | "amount_minor">): "plus" | "minus" | "none" {
	if (tx.kind === "transfer") {
		return "none";
	}
	if (tx.kind === "adjustment") {
		return tx.amount_minor < 0 ? "minus" : "plus";
	}
	return tx.kind === "income" ? "plus" : "minus";
}

// Turkish dotted/dotless i, without relying on the engine's locale support (Hermes).
function upperTR(text: string): string {
	return text.replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase();
}

function lowerTR(text: string): string {
	return text.replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase();
}

// Design ".ic" text marks ("MG", "EL"): two words give their initials, one word its first two letters.
export function monogram(text: string): string {
	const words = text
		.trim()
		.split(/\s+/)
		.filter((word) => word !== "");
	const letters =
		words.length >= 2
			? `${words[0]?.charAt(0) ?? ""}${words[1]?.charAt(0) ?? ""}`
			: (words[0] ?? "").slice(0, 2);
	return upperTR(letters);
}

export function dayLabel(date: IsoDate): string {
	return fill(tr.txHistory.dayLabel, {
		date: formatDateTR(date, "dayMonth"),
		weekday: tr.txHistory.weekdays[isoWeekday(date) - 1] ?? "",
	});
}

export function filterTransactions(
	items: readonly Transaction[],
	filter: CashFilter,
	query: string,
): Transaction[] {
	const needle = lowerTR(query.trim());
	return items.filter((tx) => {
		if (filter !== "all" && tx.kind !== filter) {
			return false;
		}
		if (needle === "") {
			return true;
		}
		const haystack = [
			titleOf(tx),
			categoryLabel(tx),
			tx.account_name,
			tx.to_account_name,
			tx.note,
		]
			.filter((part): part is string => part !== null)
			.map(lowerTR);
		return haystack.some((part) => part.includes(needle));
	});
}

export type DayGroup = { date: IsoDate; items: Transaction[] };

// Items come newest first from the server; groups keep that order.
export function groupByDay(items: readonly Transaction[]): DayGroup[] {
	const groups: DayGroup[] = [];
	for (const tx of items) {
		const last = groups.at(-1);
		if (last?.date === tx.occurred_on) {
			last.items.push(tx);
		} else {
			groups.push({ date: tx.occurred_on, items: [tx] });
		}
	}
	return groups;
}

// Design 37: "Son düzenleme · kategori “Diğer” → “Market”, 11 Eki 20:18".
export function lastEditLine(
	events: readonly TransactionEvent[],
	kind: Transaction["kind"],
): string | null {
	const edit = [...events].reverse().find((event) => event.type === "updated");
	if (edit === undefined) {
		return null;
	}
	const fields = Object.keys(edit.changes);
	const category = edit.changes.category;
	let change: string;
	if (fields.length === 1 && category !== undefined) {
		const label = (value: unknown) =>
			typeof value === "string" ? (categoryLabel({ kind, category: value }) ?? value) : "";
		change = fill(tr.txDetail.changeCategory, {
			from: label(category[0]),
			to: label(category[1]),
		});
	} else {
		const names: Record<string, string> = tr.txDetail.fields;
		change = fill(tr.txDetail.changed, {
			fields: fields.map((field) => names[field] ?? field).join(", "),
		});
	}
	return fill(tr.txDetail.lastEdit, { change, time: formatDateTimeTR(edit.created_at) });
}

// "Ekim" for 2026-10-01.
export function monthTitle(month: IsoDate): string {
	return monthName(Number(month.slice(5, 7)));
}

// Design 29 ".t2": "İş Bankası · Banka hesabı", "Elde nakit".
export function accountSub(account: Pick<Account, "kind" | "bank_name">): string {
	if (account.kind === "cash" && account.bank_name === null) {
		return tr.accounts.cashSub;
	}
	const kind = tr.accounts.kinds[account.kind];
	return account.bank_name === null ? kind : `${account.bank_name} · ${kind}`;
}
