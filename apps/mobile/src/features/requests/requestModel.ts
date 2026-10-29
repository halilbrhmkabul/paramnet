import { formatTRY } from "@paramnet/shared";
import type { Href } from "expo-router";

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

export function requestLine(item: RequestItem): string {
	const name = item.from_name ?? "";
	if (item.kind === "amendment" || item.kind === "dispute" || item.kind === "cancel") {
		return fill(tr.requests[item.kind], { name });
	}
	if (item.kind === "payment") {
		return fill(tr.requests.paymentReported, {
			name,
			amount: formatTRY(item.amount_minor ?? 0),
		});
	}
	return `${fill(item.kind === "counter" ? tr.requests.countered : tr.requests.shared, { name })} · ${formatTRY(item.principal_minor)}`;
}

// Plans are answered on the decision screen, everything else on the agreement.
export function requestHref(item: RequestItem): Href {
	return item.kind === "share" || item.kind === "counter" || item.kind === "amendment"
		? { pathname: "/agreement/[id]/decide", params: { id: item.agreement_id } }
		: { pathname: "/agreement/[id]", params: { id: item.agreement_id } };
}

export function requestKey(item: RequestItem): string {
	return item.kind === "dispute" || item.kind === "cancel"
		? `${item.kind}.${item.agreement_id}`
		: (item.payment_id ?? item.agreement_id);
}
