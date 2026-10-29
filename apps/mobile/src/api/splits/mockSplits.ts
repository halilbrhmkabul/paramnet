import { normalizeParamnetId, splitInputSchema, todayInIstanbul } from "@paramnet/shared";

import { ApiError } from "../errors";
import { MOCK_DIRECTORY, MOCK_OWN_PARAMNET_ID } from "../mock/seed";
import type { SplitDetail, SplitEvent, SplitInvite, SplitMember, SplitSummary } from "../types";
import type { SplitsApi } from "./SplitsApi";

export type MockSplitsOptions = {
	now?: () => Date;
	latencyMs?: number;
	seed?: "demo" | "empty";
	newId?: () => string;
};

// The prototype has nobody else: other people's steps are already in the seed, and a link join is
// approved on the spot so the invited person's screen (43) can be walked through.
type Stored = SplitDetail & { code: string; keys: Set<string>; payments: Map<string, string> };

const ME = "Deniz Yılmaz";
export const MOCK_JOIN_CODE = "KRD-7Q2X";
export const MOCK_INVITE_CODE = "HSB-4M9T";

function member(
	partial: Partial<SplitMember> & Pick<SplitMember, "id" | "display_name">,
): SplitMember {
	return {
		share_minor: 90000,
		is_owner: false,
		is_me: false,
		state: "accepted",
		joined_via: null,
		requested_at: null,
		agreement_id: null,
		paid_minor: 0,
		reported_payment: null,
		paid_at: null,
		...partial,
	};
}

function collected(members: SplitMember[]): number {
	return members.reduce((sum, m) => sum + (m.is_owner ? m.share_minor : m.paid_minor), 0);
}

export function createMockSplitsApi(options: MockSplitsOptions = {}): SplitsApi {
	const now = options.now ?? (() => new Date());
	const latencyMs = options.latencyMs ?? 150;
	let counter = 0;
	const newId =
		options.newId ??
		(() => {
			counter += 1;
			return `split-${String(counter).padStart(6, "0")}`;
		});
	const splits: Stored[] = [];
	const at = (minutesAgo: number) =>
		new Date(now().getTime() - minutesAgo * 60_000).toISOString();

	if ((options.seed ?? "demo") === "demo") {
		const spentOn = todayInIstanbul(now());
		const events: SplitEvent[] = [
			{ type: "join_requested", name: "Can Özdemir", at: at(20), via: "link" },
			{ type: "payment_reported", name: "Mehmet Yılmaz", at: at(30), via: null },
			{ type: "payment_confirmed", name: "Ayşe Demir", at: at(45), via: null },
			{ type: "join_approved", name: "Mehmet Yılmaz", at: at(60), via: "link" },
			{ type: "join_approved", name: "Ayşe Demir", at: at(70), via: "qr" },
		];
		const members = [
			member({ id: "sm-me", display_name: ME, is_owner: true, is_me: true, state: "payer" }),
			member({
				id: "sm-ayse",
				display_name: "Ayşe Demir",
				state: "paid",
				joined_via: "qr",
				agreement_id: "sa-ayse",
				paid_minor: 90000,
				paid_at: at(45),
			}),
			member({
				id: "sm-mehmet",
				display_name: "Mehmet Yılmaz",
				state: "reported",
				joined_via: "link",
				agreement_id: "sa-mehmet",
				reported_payment: { id: "sp-mehmet", amount_minor: 90000, reported_at: at(30) },
			}),
			member({
				id: "sm-can",
				display_name: "Can Özdemir",
				state: "requested",
				joined_via: "link",
				requested_at: at(20),
			}),
		];
		splits.push({
			id: "split-dinner",
			title: "Kordon’da akşam yemeği",
			total_minor: 360000,
			spent_on: spentOn,
			mode: "equal",
			is_owner: true,
			owner_name: ME,
			join_code: MOCK_JOIN_CODE,
			join_expires_at: new Date(now().getTime() + 48 * 3600_000).toISOString(),
			collected_minor: collected(members),
			members,
			events,
			row_version: 1,
			code: MOCK_JOIN_CODE,
			keys: new Set(),
			payments: new Map([["sp-mehmet", "sm-mehmet"]]),
		});
		// Someone else's split with a seat for me (design 43 through the link).
		const theirs = [
			member({
				id: "so-owner",
				display_name: "Ahmet Yılmaz",
				is_owner: true,
				state: "payer",
			}),
			member({
				id: "so-emre",
				display_name: "Emre Kılıç",
				share_minor: 60000,
				state: "paid",
				paid_minor: 60000,
			}),
			member({ id: "so-seat", display_name: "Deniz", share_minor: 60000, state: "open" }),
		];
		splits.push({
			id: "split-picnic",
			title: "Piknik alışverişi",
			total_minor: 180000,
			spent_on: spentOn,
			mode: "equal",
			is_owner: false,
			owner_name: "Ahmet Yılmaz",
			join_code: null,
			join_expires_at: null,
			collected_minor: collected(theirs),
			members: theirs,
			events: [],
			row_version: 1,
			code: MOCK_INVITE_CODE,
			keys: new Set(),
			payments: new Map(),
		});
	}

	function wait<T>(value: () => T): Promise<T> {
		// Without latency the answer comes on the microtask queue: tests may hold fake timers.
		if (latencyMs === 0) {
			return Promise.resolve().then(value);
		}
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				try {
					resolve(value());
				} catch (error) {
					reject(error instanceof Error ? error : new Error(String(error)));
				}
			}, latencyMs);
		});
	}

	function find(id: string): Stored {
		const split = splits.find((s) => s.id === id);
		if (split === undefined) {
			throw new ApiError("not_found");
		}
		return split;
	}

	function visible(split: Stored): boolean {
		return split.is_owner || split.members.some((m) => m.is_me);
	}

	function view(split: Stored): SplitDetail {
		const { code: _code, keys: _keys, payments: _payments, ...detail } = split;
		return JSON.parse(
			JSON.stringify({ ...detail, collected_minor: collected(split.members) }),
		) as SplitDetail;
	}

	function locate(memberId: string): { split: Stored; m: SplitMember } {
		for (const split of splits) {
			const m = split.members.find((x) => x.id === memberId);
			if (m !== undefined && visible(split)) {
				return { split, m };
			}
		}
		throw new ApiError("not_found");
	}

	function owned(memberId: string): { split: Stored; m: SplitMember } {
		const found = locate(memberId);
		if (!found.split.is_owner) {
			throw new ApiError("forbidden");
		}
		return found;
	}

	function byAgreement(agreementId: string): { split: Stored; m: SplitMember } {
		for (const split of splits) {
			const m = split.members.find((x) => x.agreement_id === agreementId);
			if (m !== undefined && visible(split)) {
				return { split, m };
			}
		}
		throw new ApiError("not_found");
	}

	function log(split: Stored, type: SplitEvent["type"], name: string, via: string | null = null) {
		split.events.unshift({ type, name, at: now().toISOString(), via });
	}

	return {
		createSplit: (input, idempotencyKey) =>
			wait(() => {
				const replay = splits.find((s) => s.keys.has(idempotencyKey));
				if (replay !== undefined) {
					return { split_id: replay.id };
				}
				const parsed = splitInputSchema.safeParse(input);
				if (!parsed.success) {
					throw new ApiError("validation_error");
				}
				const data = parsed.data;
				for (const m of data.members) {
					const id = m.paramnet_id === null ? null : normalizeParamnetId(m.paramnet_id);
					if (
						m.paramnet_id !== null &&
						(id === null || MOCK_DIRECTORY[id] === undefined)
					) {
						throw new ApiError("not_found");
					}
				}
				const id = newId();
				const members: SplitMember[] = [
					member({
						id: newId(),
						display_name: ME,
						share_minor: data.owner_share_minor,
						is_owner: true,
						is_me: true,
						state: "payer",
					}),
					...data.members.map((m) =>
						member({
							id: newId(),
							display_name: m.display_name,
							share_minor: m.share_minor,
							state: m.paramnet_id === null ? "open" : "invited",
							joined_via: m.paramnet_id === null ? null : "paramnet_id",
							agreement_id: m.paramnet_id === null ? null : newId(),
						}),
					),
				];
				splits.unshift({
					id,
					title: data.title,
					total_minor: data.total_minor,
					spent_on: data.spent_on,
					mode: data.mode,
					is_owner: true,
					owner_name: ME,
					join_code: `NEW-${id
						.slice(0, 4)
						.toUpperCase()
						.replace(/[^2-9A-HJ-NP-Z]/g, "7")}`,
					join_expires_at: new Date(now().getTime() + 48 * 3600_000).toISOString(),
					collected_minor: 0,
					members,
					events: [],
					row_version: 1,
					code: "",
					keys: new Set([idempotencyKey]),
					payments: new Map(),
				});
				const created = splits[0];
				if (created !== undefined) {
					created.code = created.join_code ?? "";
				}
				return { split_id: id };
			}),
		getSplit: (id) =>
			wait(() => {
				const split = find(id);
				if (!visible(split)) {
					throw new ApiError("not_found");
				}
				return view(split);
			}),
		listSplits: () =>
			wait(() =>
				splits.filter(visible).map((s): SplitSummary => ({
					id: s.id,
					title: s.title,
					total_minor: s.total_minor,
					spent_on: s.spent_on,
					is_owner: s.is_owner,
					owner_name: s.owner_name,
					member_count: s.members.length,
					my_share_minor: s.members.find((m) => m.is_me)?.share_minor ?? null,
				})),
			),
		splitForAgreement: (agreementId) =>
			wait(() => {
				try {
					const { split } = byAgreement(agreementId);
					return { split_id: split.id, title: split.title };
				} catch {
					return null;
				}
			}),
		getSplitInvite: (code) =>
			wait((): SplitInvite => {
				const split = splits.find((s) => s.code === code.trim().toUpperCase());
				if (split === undefined) {
					return { status: "not_found" };
				}
				if (split.is_owner) {
					return { status: "owner", split_id: split.id };
				}
				if (split.members.some((m) => m.is_me)) {
					return { status: "member", split_id: split.id };
				}
				return {
					status: "open",
					title: split.title,
					total_minor: split.total_minor,
					spent_on: split.spent_on,
					owner_name: split.owner_name,
					member_count: split.members.length,
					seats: split.members
						.filter((m) => m.state === "open")
						.map((m) => ({
							id: m.id,
							display_name: m.display_name,
							share_minor: m.share_minor,
						})),
				};
			}),
		requestSplitJoin: (code, memberId, via) =>
			wait(() => {
				const split = splits.find((s) => s.code === code.trim().toUpperCase());
				const seat = split?.members.find((m) => m.id === memberId);
				if (split === undefined || seat === undefined || seat.is_owner) {
					throw new ApiError("not_found");
				}
				if (seat.state !== "open") {
					throw new ApiError("invalid_transition", { field: "taken" });
				}
				Object.assign(seat, {
					is_me: true,
					joined_via: via,
					requested_at: now().toISOString(),
					state: "invited",
					agreement_id: newId(),
				});
				log(split, "join_approved", seat.display_name, via);
				return { split_id: split.id };
			}),
		decideSplitJoin: (memberId, decision) =>
			wait(() => {
				const { split, m } = owned(memberId);
				if (m.state !== "requested") {
					throw new ApiError("invalid_transition");
				}
				if (decision === "approve") {
					Object.assign(m, { state: "invited", agreement_id: newId() });
					log(split, "join_approved", m.display_name, m.joined_via);
				} else {
					Object.assign(m, { state: "open", joined_via: null, requested_at: null });
					log(split, "join_rejected", m.display_name);
				}
				split.row_version += 1;
				return view(split);
			}),
		assignSplitMember: (memberId, paramnetId) =>
			wait(() => {
				const { split, m } = owned(memberId);
				const id = normalizeParamnetId(paramnetId);
				if (m.state !== "open") {
					throw new ApiError("invalid_transition");
				}
				if (
					id === null ||
					id === MOCK_OWN_PARAMNET_ID ||
					MOCK_DIRECTORY[id] === undefined
				) {
					throw new ApiError("not_found");
				}
				Object.assign(m, {
					state: "invited",
					joined_via: "paramnet_id",
					agreement_id: newId(),
				});
				log(split, "member_assigned", m.display_name);
				split.row_version += 1;
				return view(split);
			}),
		remindSplitMember: (memberId) =>
			wait(() => {
				const { m } = owned(memberId);
				if (!["invited", "accepted"].includes(m.state)) {
					throw new ApiError("invalid_transition");
				}
			}),
		confirmSharePayment: (paymentId, decision) =>
			wait(() => {
				const split = splits.find((s) => s.payments.has(paymentId));
				const m = split?.members.find((x) => x.id === split.payments.get(paymentId));
				if (split === undefined || m === undefined || m.reported_payment === null) {
					throw new ApiError("not_found");
				}
				if (decision === "confirm") {
					Object.assign(m, {
						state: "paid",
						paid_minor: m.paid_minor + m.reported_payment.amount_minor,
						paid_at: now().toISOString(),
						reported_payment: null,
					});
				} else {
					Object.assign(m, { state: "accepted", reported_payment: null });
				}
				split.payments.delete(paymentId);
				log(
					split,
					decision === "confirm" ? "payment_confirmed" : "payment_rejected",
					m.display_name,
				);
			}),
		answerShare: (agreementId, decision) =>
			wait(() => {
				const { split, m } = byAgreement(agreementId);
				if (m.state !== "invited") {
					throw new ApiError("invalid_transition");
				}
				m.state = decision === "accept" ? "accepted" : "declined";
				log(split, decision === "accept" ? "accepted" : "rejected", m.display_name);
			}),
		reportSharePayment: (agreementId, amountMinor, idempotencyKey) =>
			wait(() => {
				const { split, m } = byAgreement(agreementId);
				if (split.payments.has(idempotencyKey)) {
					return;
				}
				if (m.state !== "accepted") {
					throw new ApiError("invalid_transition");
				}
				m.state = "reported";
				m.reported_payment = {
					id: idempotencyKey,
					amount_minor: amountMinor,
					reported_at: now().toISOString(),
				};
				split.payments.set(idempotencyKey, m.id);
				log(split, "payment_reported", m.display_name);
			}),
	};
}
