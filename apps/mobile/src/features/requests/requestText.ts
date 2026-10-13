import { formatTRY } from "@paramnet/shared";

import type { RequestItem } from "@/api/types";
import type { BadgeTone } from "@/components/StatusBadge";
import { fill, tr } from "@/i18n/tr";

// Design 03 / 06: each row says what it needs from me.
export const REQUEST_ACTION: Record<RequestItem["kind"], { label: string; tone: BadgeTone }> = {
	share: { label: tr.requests.actionAnswer, tone: "pending" },
	counter: { label: tr.requests.actionAnswer, tone: "pending" },
	amendment: { label: tr.requests.actionAnswer, tone: "pending" },
	payment: { label: tr.requests.actionConfirm, tone: "warning" },
	dispute: { label: tr.requests.actionReview, tone: "overdue" },
	cancel: { label: tr.requests.actionReview, tone: "neutral" },
};

// "Ayşe Demir ödeme bildirdi" over "₺1.500,00 · Ulaştı mı?" (design 03).
export function requestLines(item: RequestItem): { title: string; subtitle: string } {
	const name = item.from_name ?? "";
	switch (item.kind) {
		case "payment":
			return {
				title: fill(tr.requests.paymentReportedShort, { name }),
				subtitle: `${formatTRY(item.amount_minor ?? 0)} · ${tr.requests.reached}`,
			};
		case "share":
		case "counter":
			return {
				title: fill(item.kind === "counter" ? tr.requests.countered : tr.requests.shared, {
					name,
				}),
				subtitle: `${formatTRY(item.principal_minor)} · ${item.title}`,
			};
		case "dispute":
			return {
				title: fill(tr.requests.dispute, { name }),
				subtitle: item.reason ?? item.title,
			};
		default:
			return { title: fill(tr.requests[item.kind], { name }), subtitle: item.title };
	}
}

// Plans are answered on the decision screen, everything else on the agreement.
export function requestTarget(item: RequestItem) {
	return item.kind === "share" || item.kind === "counter" || item.kind === "amendment"
		? { pathname: "/agreement/[id]/decide" as const, params: { id: item.agreement_id } }
		: { pathname: "/agreement/[id]" as const, params: { id: item.agreement_id } };
}

export function requestKey(item: RequestItem): string {
	return item.kind === "dispute" || item.kind === "cancel"
		? `${item.kind}.${item.agreement_id}`
		: (item.payment_id ?? item.agreement_id);
}
