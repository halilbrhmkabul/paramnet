import { ApiError } from "../errors";
import { createMockApi } from "../mock/mockApi";

const now = () => new Date("2026-10-11T09:00:00Z");

describe("mock AgreementsApi — demo seed", () => {
	const api = createMockApi({ now, seed: "demo", latencyMs: 0 });

	it("dashboard totals follow the outstanding balances", async () => {
		const dashboard = await api.getDashboard();
		expect(dashboard.receivable_minor).toBe(1550000);
		expect(dashboard.payable_minor).toBe(2250000);
		expect(dashboard.due_this_month_minor).toBe(400000);
		expect(dashboard.collect_this_month_minor).toBe(550000);
		expect(dashboard.has_agreements).toBe(true);
		expect(dashboard.pending_count).toBe(0);
	});

	it("lists overdue and the next five due installments", async () => {
		const dashboard = await api.getDashboard();
		expect(
			dashboard.overdue.map((item) => [item.due_date, item.due_minor, item.state.partial]),
		).toEqual([["2026-10-01", 250000, true]]);
		expect(dashboard.upcoming.map((item) => [item.due_date, item.state.status])).toEqual([
			["2026-10-11", "due_today"],
			["2026-10-16", "upcoming"],
			["2026-11-01", "upcoming"],
			["2026-11-11", "upcoming"],
			["2026-11-16", "upcoming"],
		]);
	});

	it("contacts carry a signed net balance (+ owes me, − I owe)", async () => {
		const contacts = await api.listContacts();
		expect(contacts.map((c) => [c.display_name, c.net_minor, c.open_agreement_count])).toEqual([
			["Ahmet Yılmaz", 650000, 1],
			["Elif Kaya", -250000, 1],
			["Mert Demir", 900000, 1],
			["Yıldız Mobilya", -2000000, 1],
		]);
	});

	it("contact detail lists that contact's agreements", async () => {
		const [, , mert] = await api.listContacts();
		const detail = await api.getContact(mert?.id ?? "");
		expect(detail.agreements.map((a) => a.status).sort()).toEqual(["personal", "settled"]);
	});

	it("agreement detail derives installment states from today", async () => {
		const dashboard = await api.getDashboard();
		const id = dashboard.overdue[0]?.agreement_id ?? "";
		const detail = await api.getAgreement(id);
		expect(detail.title).toBe("Borç");
		expect(detail.my_role).toBe("creditor");
		expect(detail.outstanding_minor).toBe(650000);
		expect(
			detail.installments.map((i) => [i.seq, i.paid_minor, i.state.status, i.state.partial]),
		).toEqual([
			[1, 400000, "paid", false],
			[2, 150000, "overdue", true],
			[3, 0, "upcoming", false],
		]);
		expect(detail.next_installment).toEqual({
			seq: 2,
			due_date: "2026-10-01",
			due_minor: 250000,
			state: { status: "overdue", partial: true },
		});
		expect(detail.payments).toHaveLength(2);
		expect(detail.events[0]?.type).toBe("created");
	});

	it("calendar groups installments by due day", async () => {
		const calendar = await api.getCalendar("2026-10-01");
		expect(Object.keys(calendar.days).sort()).toEqual([
			"2026-10-01",
			"2026-10-11",
			"2026-10-16",
		]);
		expect(calendar.days["2026-10-11"]?.[0]?.counterparty_name).toBe("Yıldız Mobilya");
	});

	it("unknown ids fail with not_found", async () => {
		await expect(api.getAgreement("missing")).rejects.toEqual(new ApiError("not_found"));
		await expect(api.getContact("missing")).rejects.toEqual(new ApiError("not_found"));
	});
});

describe("mock AgreementsApi — empty seed", () => {
	it("has nothing to show", async () => {
		const api = createMockApi({ now, seed: "empty", latencyMs: 0 });
		const dashboard = await api.getDashboard();
		expect(dashboard).toMatchObject({
			has_agreements: false,
			receivable_minor: 0,
			overdue: [],
			upcoming: [],
		});
		expect(await api.listContacts()).toEqual([]);
	});
});
