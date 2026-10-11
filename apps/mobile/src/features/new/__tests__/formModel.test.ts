import { createAgreementInputSchema } from "@paramnet/shared";

import {
	defaultValues,
	planFromValues,
	toCreateInput,
	validateForm,
	type NewFormValues,
} from "../formModel";

const furniture: NewFormValues = {
	...defaultValues("2026-10-11"),
	contact: { contact: { display_name: "Kaya Mobilya", phone_e164: null, kind: "merchant" } },
	contact_label: "Kaya Mobilya",
	title: "Mobilya",
	amount_minor: 2800000,
	down_payment_minor: 800000,
	count: "5",
	first_due_date: "2026-11-10",
};

describe("defaultValues", () => {
	it("defaults to monthly with the first payment one month from today", () => {
		expect(defaultValues("2026-01-31")).toMatchObject({
			period: "monthly",
			repayment: "once",
			first_due_date: "2026-02-28",
		});
	});
});

describe("validateForm", () => {
	it("accepts the spec furniture example", () => {
		expect(validateForm("boughtInstallment", furniture)).toEqual({});
	});

	it("reports codes per field", () => {
		expect(
			validateForm("boughtInstallment", {
				...furniture,
				contact: null,
				title: " ",
				amount_minor: null,
				count: "0",
			}),
		).toEqual({
			contact: "contact_required",
			title: "required",
			amount_minor: "invalid_amount",
			count: "invalid_count",
		});
	});

	it("maps plan errors to the field that causes them", () => {
		expect(
			validateForm("boughtInstallment", { ...furniture, down_payment_minor: 2800000 }),
		).toEqual({
			down_payment_minor: "down_payment_too_large",
		});
		expect(
			validateForm("boughtInstallment", { ...furniture, amount_minor: 800003, count: "5" }),
		).toEqual({
			count: "count_exceeds_remaining",
		});
		expect(validateForm("boughtInstallment", { ...furniture, first_due_date: null })).toEqual({
			first_due_date: "due_date_required",
		});
	});

	it("a one-off loan may have no due date and needs no title", () => {
		expect(
			validateForm("lent", {
				...defaultValues("2026-10-11"),
				contact: { contact_id: "00000000-0000-4000-8000-0000000000a1" },
				contact_label: "Ahmet",
				amount_minor: 100000,
				first_due_date: null,
			}),
		).toEqual({});
	});
});

describe("planFromValues / toCreateInput", () => {
	it("builds the spec plan and a create input the server schema accepts", () => {
		const plan = planFromValues("boughtInstallment", furniture);
		expect(plan.map((row) => [row.due_date, row.amount_minor])).toEqual([
			["2026-11-10", 400000],
			["2026-12-10", 400000],
			["2027-01-10", 400000],
			["2027-02-10", 400000],
			["2027-03-10", 400000],
		]);
		const input = toCreateInput("boughtInstallment", furniture, plan);
		expect(createAgreementInputSchema.safeParse(input).success).toBe(true);
		expect(input).toMatchObject({
			kind: "installment_purchase",
			creator_role: "debtor",
			title: "Mobilya",
			terms: { principal_minor: 2800000, down_payment_minor: 800000, notes: null },
		});
	});

	it("a lent loan is a creditor loan titled 'Borç' with one row", () => {
		const values: NewFormValues = {
			...defaultValues("2026-10-11"),
			contact: { contact_id: "00000000-0000-4000-8000-0000000000a1" },
			contact_label: "Ahmet",
			amount_minor: 1000000,
			first_due_date: null,
			notes: "  Tatil  ",
		};
		const plan = planFromValues("lent", values);
		expect(plan).toEqual([{ seq: 1, due_date: null, amount_minor: 1000000 }]);
		expect(toCreateInput("lent", values, plan)).toMatchObject({
			kind: "loan",
			creator_role: "creditor",
			title: "Borç",
			terms: { principal_minor: 1000000, down_payment_minor: 0, notes: "Tatil" },
		});
	});
});
