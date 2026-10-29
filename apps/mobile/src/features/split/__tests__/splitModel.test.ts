import { splitInputSchema } from "@paramnet/shared";

import type { SplitMember } from "@/api/types";

import {
	buildSplitInput,
	computeShares,
	eventText,
	memberBadge,
	qrModules,
	qrRuns,
	shortLink,
	splitLink,
	type DraftPerson,
} from "../splitModel";

const person = (key: string, partial: Partial<DraftPerson> = {}): DraftPerson => ({
	key,
	display_name: key,
	paramnet_id: null,
	included: true,
	amount: null,
	percent: "",
	...partial,
});

describe("computeShares (design 40)", () => {
	const people = [
		person("Ayşe"),
		person("Mehmet"),
		person("Can"),
		person("Burak", { included: false }),
	];

	it("splits equally among the included and says nothing about kuruş when even", () => {
		const result = computeShares(360000, "equal", { amount: null, percent: "" }, people);
		expect(result.shares).toEqual([90000, 90000, 90000, 90000]);
		expect(result.note).not.toContain("Kuruş");
	});

	it("puts the kuruş difference on the payer and says so", () => {
		const result = computeShares(
			100000,
			"equal",
			{ amount: null, percent: "" },
			people.slice(0, 2),
		);
		expect(result.shares).toEqual([33334, 33333, 33333]);
		expect(result.note).toContain("Kuruş farkı (0,01 TL)");
	});

	it("amounts must add up to the total", () => {
		const custom = [person("Ayşe", { amount: 90000 }), person("Can", { amount: 60000 })];
		expect(
			computeShares(360000, "amount", { amount: 120000, percent: "" }, custom).shares,
		).toBeNull();
		const fixed = computeShares(270000, "amount", { amount: 120000, percent: "" }, custom);
		expect(fixed.shares).toEqual([120000, 90000, 60000]);
		expect(fixed.note).toBe("Paylar toplamı hesapla eşit: 2.700,00 TL.");
	});

	it("percents must make 100", () => {
		const custom = [person("Ayşe", { percent: "25" }), person("Can", { percent: "25" })];
		expect(
			computeShares(100000, "percent", { amount: null, percent: "40" }, custom).shares,
		).toBeNull();
		expect(
			computeShares(100000, "percent", { amount: null, percent: "50" }, custom).shares,
		).toEqual([50000, 25000, 25000]);
	});
});

describe("buildSplitInput", () => {
	it("sends only the included people, the payer's share apart", () => {
		const people = [
			person("Ayşe", { paramnet_id: "PN-552013" }),
			person("Burak", { included: false }),
		];
		const input = buildSplitInput(
			{ title: " Yemek ", total: 200000, spentOn: "2026-10-12", mode: "equal" },
			people,
			[100000, 100000],
		);
		expect(input).toEqual({
			title: "Yemek",
			total_minor: 200000,
			spent_on: "2026-10-12",
			mode: "equal",
			owner_share_minor: 100000,
			members: [{ display_name: "Ayşe", share_minor: 100000, paramnet_id: "PN-552013" }],
		});
		expect(splitInputSchema.safeParse(input).success).toBe(true);
	});
});

describe("links and QR", () => {
	const domain: unknown = process.env.EXPO_PUBLIC_APP_DOMAIN;
	afterEach(() => {
		process.env.EXPO_PUBLIC_APP_DOMAIN = typeof domain === "string" ? domain : "";
	});

	it("uses the https link when a domain is set, the app URL otherwise", () => {
		process.env.EXPO_PUBLIC_APP_DOMAIN = "paramnet.app";
		expect(splitLink("KRD-7Q2X", (p) => `exp://x/--/${p}`)).toBe(
			"https://paramnet.app/h/KRD-7Q2X",
		);
		expect(splitLink("KRD-7Q2X", (p) => p, true)).toBe("https://paramnet.app/h/KRD-7Q2X?v=qr");
		process.env.EXPO_PUBLIC_APP_DOMAIN = "";
		expect(splitLink("KRD-7Q2X", (p) => `exp://x/--/${p}`)).toBe(
			"exp://x/--/split/join/KRD-7Q2X",
		);
		expect(
			splitLink("KRD-7Q2X", (p, q) => `${p}?${new URLSearchParams(q).toString()}`, true),
		).toBe("split/join/KRD-7Q2X?via=qr");
		expect(shortLink("https://paramnet.app/h/KRD-7Q2X")).toBe("paramnet.app/h/KRD-7Q2X");
	});

	it("draws a square code and merges dark runs", () => {
		const rows = qrModules("https://paramnet.app/h/KRD-7Q2X");
		expect(rows.length).toBeGreaterThanOrEqual(21);
		expect(rows.every((row) => row.length === rows.length)).toBe(true);
		// The finder pattern starts every code with seven dark modules.
		expect(qrRuns(rows[0] ?? [])[0]).toEqual({ start: 0, length: 7 });
		expect(qrRuns([true, true, false, true])).toEqual([
			{ start: 0, length: 2 },
			{ start: 3, length: 1 },
		]);
	});
});

describe("labels", () => {
	const member = (partial: Partial<SplitMember>): SplitMember => ({
		id: "m",
		display_name: "Mehmet",
		share_minor: 90000,
		is_owner: false,
		is_me: false,
		state: "reported",
		joined_via: null,
		requested_at: null,
		agreement_id: null,
		paid_minor: 0,
		reported_payment: null,
		paid_at: null,
		...partial,
	});

	it("the payer is asked to confirm, others see it waiting", () => {
		expect(memberBadge(member({}), true).label).toBe("Onayın bekleniyor");
		expect(memberBadge(member({}), false).label).toBe("Onay bekliyor");
		expect(memberBadge(member({ state: "paid" }), true).tone).toBe("success");
	});

	it("tells how someone joined", () => {
		expect(eventText({ type: "join_requested", name: "Can", at: "", via: "link" })).toBe(
			"Can linkle katılmak istedi",
		);
		expect(eventText({ type: "payment_confirmed", name: "Ayşe", at: "", via: null })).toBe(
			"Ayşe ödemesi onaylandı",
		);
	});
});
