import {
	equalShares,
	formatPercentBps,
	formatTRY,
	parsePercentBps,
	percentShares,
	sumShares,
	type IsoDate,
	type SplitInput,
	type SplitMode,
} from "@paramnet/shared";
import qrcode from "qrcode-generator";

import type { SplitEvent, SplitMember } from "@/api/types";
import type { BadgeTone } from "@/components/StatusBadge";
import { fill, tr } from "@/i18n/tr";

// Design 40: everyone the payer listed; the payer is always first and always included.
export type DraftPerson = {
	key: string;
	display_name: string;
	// Null: a seat filled through the QR code or the link.
	paramnet_id: string | null;
	included: boolean;
	amount: number | null;
	percent: string;
};

export type ShareResult = {
	// The payer's share first, then each included person in order; null while they do not add up.
	shares: number[] | null;
	mine: number;
	note: string;
};

export function computeShares(
	total: number,
	mode: SplitMode,
	me: Pick<DraftPerson, "amount" | "percent">,
	people: readonly DraftPerson[],
): ShareResult {
	const included = people.filter((p) => p.included);
	if (mode === "equal") {
		const shares = equalShares(total, included.length + 1);
		const rest = (shares[0] ?? 0) - (shares[1] ?? shares[0] ?? 0);
		return {
			shares,
			mine: shares[0] ?? 0,
			note:
				(rest > 0 ? fill(tr.split.noteEqualRest, { amount: formatTRY(rest) }) : "") +
				tr.split.noteEqual,
		};
	}
	if (mode === "amount") {
		const shares = [me.amount ?? 0, ...included.map((p) => p.amount ?? 0)];
		const sum = sumShares(shares);
		const ok = sum === total && included.every((p) => (p.amount ?? 0) > 0);
		return {
			shares: ok ? shares : null,
			mine: shares[0] ?? 0,
			note:
				sum === total
					? fill(tr.split.noteMatch, { amount: formatTRY(total) })
					: fill(tr.split.noteDiff, {
							sum: formatTRY(sum),
							diff: formatTRY(Math.abs(total - sum)),
						}),
		};
	}
	const bps = [me.percent, ...included.map((p) => p.percent)].map((text) =>
		text.trim() === "" ? 0 : (parsePercentBps(text) ?? Number.NaN),
	);
	const valid = bps.every((bp) => Number.isFinite(bp));
	const shares = valid ? percentShares(total, bps) : null;
	const ok = shares !== null && shares.slice(1).every((share) => share > 0);
	return {
		shares: ok ? shares : null,
		mine: shares?.[0] ?? 0,
		note: ok
			? fill(tr.split.noteMatch, { amount: formatTRY(total) })
			: fill(tr.split.notePercentDiff, {
					sum: valid ? formatPercentBps(sumShares(bps)) : "—",
				}),
	};
}

export function buildSplitInput(
	draft: { title: string; total: number; spentOn: IsoDate; mode: SplitMode },
	people: readonly DraftPerson[],
	shares: readonly number[],
): SplitInput {
	const included = people.filter((p) => p.included);
	return {
		title: draft.title.trim(),
		total_minor: draft.total,
		spent_on: draft.spentOn,
		mode: draft.mode,
		owner_share_minor: shares[0] ?? 0,
		members: included.map((p, index) => ({
			display_name: p.display_name.trim(),
			share_minor: shares[index + 1] ?? 0,
			paramnet_id: p.paramnet_id,
		})),
	};
}

// The QR code carries the https link when a domain is configured; otherwise the app's own URL, which
// is what Expo Go can open during development.
// The QR code adds "v=qr" so the payer sees how each person joined (design 42 "kare kodla katıldı").
export function splitLink(
	code: string,
	fallback: (path: string, query: Record<string, string>) => string,
	qr = false,
): string {
	const domain: unknown = process.env.EXPO_PUBLIC_APP_DOMAIN;
	return typeof domain === "string" && domain !== ""
		? `https://${domain}/h/${code}${qr ? "?v=qr" : ""}`
		: fallback(`split/join/${code}`, qr ? { via: "qr" } : {});
}

export function shortLink(url: string): string {
	return url.replace(/^[a-z+]+:\/\//, "");
}

// Rows of dark modules, error correction M (a logo covers no part of it here).
export function qrModules(text: string): boolean[][] {
	const qr = qrcode(0, "M");
	qr.addData(text);
	qr.make();
	const count = qr.getModuleCount();
	return Array.from({ length: count }, (_, row) =>
		Array.from({ length: count }, (_, col) => qr.isDark(row, col)),
	);
}

// Runs of dark modules in a row, so a 33×33 code needs a few hundred views instead of a thousand.
export function qrRuns(row: readonly boolean[]): { start: number; length: number }[] {
	const runs: { start: number; length: number }[] = [];
	row.forEach((dark, index) => {
		const last = runs.at(-1);
		if (!dark) {
			return;
		}
		if (last !== undefined && last.start + last.length === index) {
			last.length += 1;
		} else {
			runs.push({ start: index, length: 1 });
		}
	});
	return runs;
}

export function memberBadge(
	member: SplitMember,
	iAmOwner: boolean,
): { label: string; tone: BadgeTone } {
	const b = tr.split.badges;
	switch (member.state) {
		case "payer":
			return { label: b.payer, tone: "pending" };
		case "paid":
			return { label: b.paid, tone: "success" };
		case "reported":
			return { label: iAmOwner ? b.reported : b.reportedOther, tone: "warning" };
		case "accepted":
			return { label: b.accepted, tone: "neutral" };
		case "invited":
			return { label: b.invited, tone: "neutral" };
		case "requested":
			return { label: b.requested, tone: "warning" };
		case "open":
			return { label: b.open, tone: "neutral" };
		case "declined":
			return { label: b.declined, tone: "neutral" };
		case "disputed":
			return { label: b.disputed, tone: "overdue" };
	}
}

export function timeOf(iso: string): string {
	return new Intl.DateTimeFormat("tr-TR", {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Europe/Istanbul",
	}).format(new Date(iso));
}

export function memberSub(member: SplitMember, ownerName: string): string {
	const s = tr.split.subs;
	switch (member.state) {
		case "paid":
			return fill(s.paid, { name: ownerName });
		case "reported":
			return fill(s.reported, {
				time:
					member.reported_payment === null
						? ""
						: timeOf(member.reported_payment.reported_at),
			}).trim();
		default:
			return s[member.state];
	}
}

// Segments of the collected bar (design 42): one per share, in order.
export function barTone(member: SplitMember): "payer" | "paid" | "pending" | "unpaid" {
	if (member.state === "payer") {
		return "payer";
	}
	if (member.state === "paid") {
		return "paid";
	}
	return member.state === "reported" ? "pending" : "unpaid";
}

export function eventText(event: SplitEvent): string {
	const via =
		event.via === "qr" ? tr.split.via.qr : event.via === "link" ? tr.split.via.link : "";
	return fill(tr.split.events[event.type], { name: event.name ?? "", via })
		.replace(/\s+/g, " ")
		.trim();
}

export function eventTone(event: SplitEvent): "success" | "warning" | "neutral" {
	switch (event.type) {
		case "payment_confirmed":
		case "join_approved":
		case "accepted":
			return "success";
		case "payment_reported":
		case "join_requested":
			return "warning";
		default:
			return "neutral";
	}
}
