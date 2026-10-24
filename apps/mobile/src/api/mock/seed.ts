import { addDays, type IsoDate } from "@paramnet/shared";

import { applyPayment, insertAgreement, planFor, type MockState } from "./store";

export type MockSeed = "demo" | "empty";

// UUID-shaped like real ids, because the input schemas validate contact_id as a UUID.
export const SEED_IDS = {
	ahmet: "00000000-0000-4000-8000-0000000000a1",
	yildiz: "00000000-0000-4000-8000-0000000000a2",
	elif: "00000000-0000-4000-8000-0000000000a3",
	mert: "00000000-0000-4000-8000-0000000000a4",
	ahmetLoan: "00000000-0000-4000-8000-0000000000b1",
	yildizFurniture: "00000000-0000-4000-8000-0000000000b2",
	elifLoan: "00000000-0000-4000-8000-0000000000b3",
	mertSale: "00000000-0000-4000-8000-0000000000b4",
	mertLoan: "00000000-0000-4000-8000-0000000000b5",
	zeynepShare: "00000000-0000-4000-8000-0000000000c1",
} as const;

// ParamNet IDs (ADR-050) the prototype knows: the signed-in user's own and other discoverable users.
export const MOCK_OWN_PARAMNET_ID = "PN-48K7QZ";
export const MOCK_DIRECTORY: Readonly<Record<string, string>> = {
	"PN-7KQ2M9": "Ahmet Yılmaz",
	"PN-EK4X8R": "Emre Kılıç",
};

function at(date: IsoDate): string {
	return `${date}T09:00:00.000Z`;
}

// Dates are relative to today so the prototype always shows something overdue, due today and upcoming.
export function seedState(seed: MockSeed, today: IsoDate): MockState {
	const state: MockState = { contacts: [], agreements: [], incoming: [], shares: new Map() };
	if (seed === "empty") {
		return state;
	}
	state.contacts.push(
		{
			id: SEED_IDS.ahmet,
			display_name: "Ahmet Yılmaz",
			phone_e164: "+905551112233",
			kind: "person",
		},
		{ id: SEED_IDS.yildiz, display_name: "Yıldız Mobilya", phone_e164: null, kind: "merchant" },
		{
			id: SEED_IDS.elif,
			display_name: "Elif Kaya",
			phone_e164: "+905552223344",
			kind: "person",
		},
		{
			id: SEED_IDS.mert,
			display_name: "Mert Demir",
			phone_e164: "+905553334455",
			kind: "person",
		},
	);

	const lentStart = addDays(today, -40);
	const lent = insertAgreement(state, {
		id: SEED_IDS.ahmetLoan,
		kind: "loan",
		title: "Borç",
		description: null,
		started_on: null,
		notes: null,
		my_role: "creditor",
		contact_id: SEED_IDS.ahmet,
		principal_minor: 1200000,
		down_payment_minor: 0,
		down_payment_on: lentStart,
		created_at: at(addDays(lentStart, -30)),
		plan: planFor(1200000, 0, 3, "monthly", lentStart),
	});
	applyPayment(lent, {
		id: "p-ahmet-1",
		amount_minor: 400000,
		paid_on: lentStart,
		method: "transfer",
		kind: "payment",
		status: "confirmed",
		note: null,
		by_me: true,
		created_at: at(lentStart),
	});
	applyPayment(lent, {
		id: "p-ahmet-2",
		amount_minor: 150000,
		paid_on: addDays(today, -6),
		method: "cash",
		kind: "payment",
		status: "confirmed",
		note: null,
		by_me: true,
		created_at: at(addDays(today, -6)),
	});

	insertAgreement(state, {
		id: SEED_IDS.yildizFurniture,
		kind: "installment_purchase",
		title: "Mobilya",
		description: "Yemek odası takımı",
		started_on: null,
		notes: null,
		my_role: "debtor",
		contact_id: SEED_IDS.yildiz,
		principal_minor: 2800000,
		down_payment_minor: 800000,
		down_payment_on: addDays(today, -20),
		created_at: at(addDays(today, -20)),
		plan: planFor(2800000, 800000, 5, "monthly", today),
	});

	insertAgreement(state, {
		id: SEED_IDS.elifLoan,
		kind: "loan",
		title: "Borç",
		description: null,
		started_on: null,
		notes: "Tatil dönüşü",
		my_role: "debtor",
		contact_id: SEED_IDS.elif,
		principal_minor: 250000,
		down_payment_minor: 0,
		down_payment_on: today,
		created_at: at(addDays(today, -3)),
		plan: planFor(250000, 0, 1, "monthly", null),
	});

	insertAgreement(state, {
		id: SEED_IDS.mertSale,
		kind: "installment_purchase",
		title: "Bisiklet",
		description: null,
		started_on: null,
		notes: null,
		my_role: "creditor",
		contact_id: SEED_IDS.mert,
		principal_minor: 900000,
		down_payment_minor: 0,
		down_payment_on: today,
		created_at: at(addDays(today, -10)),
		plan: planFor(900000, 0, 3, "monthly", addDays(today, 5)),
	});

	const oldDue = addDays(today, -60);
	const settled = insertAgreement(state, {
		id: SEED_IDS.mertLoan,
		kind: "loan",
		title: "Borç",
		description: null,
		started_on: null,
		notes: null,
		my_role: "creditor",
		contact_id: SEED_IDS.mert,
		principal_minor: 100000,
		down_payment_minor: 0,
		down_payment_on: oldDue,
		created_at: at(addDays(oldDue, -14)),
		plan: planFor(100000, 0, 1, "monthly", oldDue),
	});
	applyPayment(settled, {
		id: "p-mert-1",
		amount_minor: 100000,
		paid_on: oldDue,
		method: "cash",
		kind: "payment",
		status: "confirmed",
		note: null,
		by_me: true,
		created_at: at(oldDue),
	});

	// Someone shared a plan with me: it waits in Talepler (S14, S19).
	state.incoming.push({
		agreement_id: SEED_IDS.zeynepShare,
		token: "demo-incoming",
		title: "Kira payı",
		kind: "loan",
		creator_name: "Zeynep Arslan",
		my_role: "debtor",
		status: "pending",
		principal_minor: 600000,
		down_payment_minor: 0,
		notes: "Ekim kirasından",
		plan: planFor(600000, 0, 3, "monthly", addDays(today, 20)),
	});

	return state;
}
