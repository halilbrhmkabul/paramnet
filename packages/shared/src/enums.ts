// Mirrors the Postgres enums (paramnet-domain schema.md); order matches the SQL definitions.
export const AGREEMENT_STATUSES = [
	"personal",
	"pending",
	"countered",
	"active",
	"amendment_pending",
	"disputed",
	"rejected",
	"settled",
	"cancelled",
] as const;
export const AGREEMENT_KINDS = ["loan", "installment_purchase"] as const;
export const PARTY_ROLES = ["creditor", "debtor"] as const;
export const CONTACT_KINDS = ["person", "merchant"] as const;
export const VERSION_STATUSES = [
	"draft",
	"proposed",
	"accepted",
	"rejected",
	"superseded",
] as const;
export const PAYMENT_STATUSES = [
	"reported",
	"confirmed",
	"rejected",
	"withdrawn",
	"voided",
] as const;
export const PAYMENT_KINDS = ["payment", "down_payment", "discount"] as const;
export const PAYMENT_METHODS = ["cash", "transfer", "card", "other"] as const;

export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];
export type AgreementKind = (typeof AGREEMENT_KINDS)[number];
export type PartyRole = (typeof PARTY_ROLES)[number];
export type ContactKind = (typeof CONTACT_KINDS)[number];
export type VersionStatus = (typeof VERSION_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type PaymentKind = (typeof PAYMENT_KINDS)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
