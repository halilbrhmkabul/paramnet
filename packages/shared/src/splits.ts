import { z } from "zod";

import {
	displayNameSchema,
	isoDateSchema,
	nonNegativeMinorSchema,
	positiveMinorSchema,
	titleSchema,
} from "./schemas";

// "Hesabı böl" (F4-11, ADR-061). Shares are kuruş integers; the payer is always the first share and takes
// whatever rounding leaves over, as the design says ("Kuruş farkı senin payına eklendi").

export const SPLIT_MODES = ["equal", "amount", "percent"] as const;
export type SplitMode = (typeof SPLIT_MODES)[number];

// Everyone else plus the payer; the server allows the same.
export const SPLIT_MAX_MEMBERS = 19;

export function sumShares(shares: readonly number[]): number {
	return shares.reduce((sum, share) => sum + share, 0);
}

export function equalShares(totalMinor: number, count: number): number[] {
	if (!Number.isInteger(count) || count < 1) {
		throw new RangeError("count");
	}
	const base = Math.floor(totalMinor / count);
	const rest = totalMinor - base * count;
	return Array.from({ length: count }, (_, index) => (index === 0 ? base + rest : base));
}

// bps: hundredths of a percent, 10000 in all; null when they do not make 100.
export function percentShares(totalMinor: number, bps: readonly number[]): number[] | null {
	if (bps.length === 0 || sumShares(bps) !== 10000) {
		return null;
	}
	const shares = bps.map((bp) => Math.floor((totalMinor * bp) / 10000));
	shares[0] = (shares[0] ?? 0) + totalMinor - sumShares(shares);
	return shares;
}

// "33,33" or "12.5" → basis points; at most two decimals, 0–100.
export function parsePercentBps(text: string): number | null {
	const match = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(text.trim());
	if (match === null) {
		return null;
	}
	const bps = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
	return bps > 10000 ? null : bps;
}

export function formatPercentBps(bps: number): string {
	const whole = Math.floor(bps / 100);
	const part = bps % 100;
	return part === 0 ? `%${String(whole)}` : `%${String(whole)},${String(part).padStart(2, "0")}`;
}

export const splitMemberInputSchema = z.strictObject({
	display_name: displayNameSchema,
	share_minor: positiveMinorSchema,
	paramnet_id: z.string().nullable(),
});

export const splitInputSchema = z
	.strictObject({
		title: titleSchema,
		total_minor: positiveMinorSchema,
		spent_on: isoDateSchema,
		mode: z.enum(SPLIT_MODES),
		owner_share_minor: nonNegativeMinorSchema,
		members: z.array(splitMemberInputSchema).min(1).max(SPLIT_MAX_MEMBERS),
	})
	.refine(
		(input) =>
			input.owner_share_minor + sumShares(input.members.map((m) => m.share_minor)) ===
			input.total_minor,
		{ error: "shares_total" },
	);

export type SplitInput = z.input<typeof splitInputSchema>;
