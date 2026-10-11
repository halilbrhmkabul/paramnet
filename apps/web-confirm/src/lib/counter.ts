import {
	MAX_INSTALLMENTS,
	parseTRY,
	validatePlan,
	type PlanError,
	type PlanInstallment,
} from "@paramnet/shared";

import { field } from "./form";

export type BaseTerms = {
	principal_minor: number;
	down_payment_minor: number;
	notes: string | null;
};
export type CounterTerms = BaseTerms & { plan: PlanInstallment[] };
export type CounterResult =
	{ ok: true; terms: CounterTerms } | { ok: false; error: PlanError | "invalid_amount" };

// W03 "Düzeltme öner": the invitee edits dates and amounts of the rows. The total and down payment
// stay as shared (a different total is a different agreement); the server re-validates everything.
export function counterFromForm(base: BaseTerms, form: FormData): CounterResult {
	const count = Number(field(form, "rows"));
	if (!Number.isSafeInteger(count) || count < 1 || count > MAX_INSTALLMENTS) {
		return { ok: false, error: "invalid_count" };
	}
	const rows: { due_date: string | null; amount_minor: number }[] = [];
	for (let seq = 1; seq <= count; seq++) {
		const amount = parseTRY(field(form, `amount.${String(seq)}`));
		if (!amount.ok) {
			return { ok: false, error: "invalid_amount" };
		}
		const due = field(form, `due_date.${String(seq)}`);
		rows.push({ due_date: due === "" ? null : due, amount_minor: amount.value });
	}
	const result = validatePlan({
		principal: base.principal_minor,
		downPayment: base.down_payment_minor,
		installments: rows,
	});
	return result.ok
		? { ok: true, terms: { ...base, plan: result.plan } }
		: { ok: false, error: result.error };
}
