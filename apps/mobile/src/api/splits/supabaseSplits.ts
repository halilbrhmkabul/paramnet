import { todayInIstanbul } from "@paramnet/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { toApiError } from "../supabase/toApiError";
import type { PendingDecision, SplitDetail, SplitInvite, SplitSummary } from "../types";
import type { SplitsApi } from "./SplitsApi";

// Shapes are guarded by the pgTAP test 350_splits.
export function createSupabaseSplitsApi(client: SupabaseClient): SplitsApi {
	async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
		const response: { data: unknown; error: unknown } = await client.rpc(fn, args);
		if (response.error !== null) {
			throw toApiError(response.error);
		}
		return response.data as T;
	}

	return {
		createSplit: (input, idempotencyKey) =>
			call("create_split", { p_input: input, p_idempotency_key: idempotencyKey }),
		getSplit: (id) => call<SplitDetail>("get_split", { p_id: id }),
		listSplits: () => call<SplitSummary[]>("list_splits"),
		splitForAgreement: (agreementId) =>
			call("split_for_agreement", { p_agreement_id: agreementId }),
		getSplitInvite: (code) => call<SplitInvite>("get_split_invite", { p_code: code }),
		requestSplitJoin: (code, memberId, via) =>
			call("request_split_join", { p_code: code, p_member_id: memberId, p_via: via }),
		decideSplitJoin: (memberId, decision) =>
			call<SplitDetail>("decide_split_join", { p_member_id: memberId, p_decision: decision }),
		assignSplitMember: (memberId, paramnetId) =>
			call<SplitDetail>("assign_split_member", {
				p_member_id: memberId,
				p_paramnet_id: paramnetId,
			}),
		remindSplitMember: async (memberId) => {
			await call("remind_split_member", { p_member_id: memberId });
		},
		confirmSharePayment: async (paymentId, decision) => {
			await call("decide_payment", { p_payment_id: paymentId, p_decision: decision });
		},
		// The answer is bound to the version and terms hash the server shows now (BR-06).
		answerShare: async (agreementId, decision) => {
			const pending = await call<PendingDecision>("get_pending_decision", {
				p_id: agreementId,
			});
			await call("decide_agreement", {
				p_id: agreementId,
				p_version: pending.version,
				p_terms_hash: pending.terms_hash,
				p_decision: decision,
				p_counter_terms: null,
			});
		},
		reportSharePayment: async (agreementId, amountMinor, idempotencyKey) => {
			const detail = await call<{ row_version: number }>("get_agreement_detail", {
				p_id: agreementId,
			});
			await call("record_payment", {
				p_agreement_id: agreementId,
				p_input: {
					amount_minor: amountMinor,
					paid_on: todayInIstanbul(),
					method: "other",
					note: null,
				},
				p_row_version: detail.row_version,
				p_idempotency_key: idempotencyKey,
			});
		},
	};
}
