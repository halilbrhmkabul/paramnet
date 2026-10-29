import type { SplitInput } from "@paramnet/shared";

import type { SplitDetail, SplitInvite, SplitSummary } from "../types";

// "Hesabı böl" (F4-11, ADR-061). A member's answer and payment run through their share's agreement
// (decide_agreement, record_payment, decide_payment); this interface hides that from the screens.
// Mock and Supabase adapters both implement it (EXPO_PUBLIC_API_MODE).
export interface SplitsApi {
	createSplit(input: SplitInput, idempotencyKey: string): Promise<{ split_id: string }>;
	getSplit(id: string): Promise<SplitDetail>;
	listSplits(): Promise<SplitSummary[]>;
	// Agreement detail links back to the split a share belongs to.
	splitForAgreement(agreementId: string): Promise<{ split_id: string; title: string } | null>;
	// The QR code and the link (design 41, 43).
	getSplitInvite(code: string): Promise<SplitInvite>;
	requestSplitJoin(
		code: string,
		memberId: string,
		via: "link" | "qr",
	): Promise<{ split_id: string }>;
	// The payer.
	decideSplitJoin(memberId: string, decision: "approve" | "reject"): Promise<SplitDetail>;
	assignSplitMember(memberId: string, paramnetId: string): Promise<SplitDetail>;
	remindSplitMember(memberId: string): Promise<void>;
	confirmSharePayment(paymentId: string, decision: "confirm" | "reject"): Promise<void>;
	// The member, on their own share.
	answerShare(agreementId: string, decision: "accept" | "reject"): Promise<void>;
	reportSharePayment(
		agreementId: string,
		amountMinor: number,
		idempotencyKey: string,
	): Promise<void>;
}
