// ADR-057: estimates for the user's own card and loan (design 10). Display only (ADR-045): nothing is
// recorded, nothing touches an agreement. Integer kuruş; rates in hundredths of a percent.
export const DEFAULT_KKDF_BPS = 1500;
export const DEFAULT_BSMV_BPS = 1500;

function roundDiv(numerator: bigint, denominator: bigint): bigint {
	return (numerator * 2n + denominator) / (2n * denominator);
}

export type InterestEstimate = {
	interest_minor: number;
	kkdf_minor: number;
	bsmv_minor: number;
	total_minor: number;
};

// Faiz = kalan × aylık oran × gün / 30; KKDF and BSMV are charged on the interest.
export function cardInterestEstimate(
	remainingMinor: number,
	monthlyRateBps: number,
	days: number,
	kkdfBps: number = DEFAULT_KKDF_BPS,
	bsmvBps: number = DEFAULT_BSMV_BPS,
): InterestEstimate {
	if (remainingMinor <= 0 || days <= 0) {
		return { interest_minor: 0, kkdf_minor: 0, bsmv_minor: 0, total_minor: 0 };
	}
	const interest = roundDiv(
		BigInt(remainingMinor) * BigInt(monthlyRateBps) * BigInt(days),
		10000n * 30n,
	);
	const kkdf = roundDiv(interest * BigInt(kkdfBps), 10000n);
	const bsmv = roundDiv(interest * BigInt(bsmvBps), 10000n);
	return {
		interest_minor: Number(interest),
		kkdf_minor: Number(kkdf),
		bsmv_minor: Number(bsmv),
		total_minor: Number(interest + kkdf + bsmv),
	};
}

export type EarlyPayoff = {
	fee_bps: number;
	fee_minor: number;
	total_minor: number;
	saved_minor: number;
};

// Closing a consumer loan early: the remaining principal plus a fee of 1%, or 2% when more than
// 36 months are left; what is saved is the interest of the installments left.
export function earlyPayoff(
	remainingPrincipalMinor: number,
	remainingMonths: number,
	remainingTotalMinor: number,
): EarlyPayoff {
	const feeBps = remainingMonths > 36 ? 200 : 100;
	const fee = Number(roundDiv(BigInt(remainingPrincipalMinor) * BigInt(feeBps), 10000n));
	const total = remainingPrincipalMinor + fee;
	return {
		fee_bps: feeBps,
		fee_minor: fee,
		total_minor: total,
		saved_minor: Math.max(0, remainingTotalMinor - total),
	};
}
