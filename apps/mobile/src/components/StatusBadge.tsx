import type { AgreementStatus, InstallmentStatus } from "@paramnet/shared";
import { StyleSheet, Text, View } from "react-native";

import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

// Design system "Durum rozetleri": approved green, request/info blue, upcoming amber, overdue red.
export type BadgeTone = "success" | "pending" | "warning" | "overdue" | "neutral" | "primary";

const TONE_COLORS = {
	success: ["success", "successSoft"],
	pending: ["pending", "pendingSoft"],
	warning: ["warning", "warningSoft"],
	overdue: ["overdue", "overdueSoft"],
	neutral: ["neutral", "neutralSoft"],
	primary: ["primary", "primarySoft"],
} as const;

const AGREEMENT_TONE: Record<AgreementStatus, BadgeTone> = {
	personal: "neutral",
	pending: "pending",
	countered: "pending",
	active: "success",
	amendment_pending: "warning",
	disputed: "overdue",
	rejected: "neutral",
	settled: "success",
	cancelled: "neutral",
};

const INSTALLMENT_TONE: Record<InstallmentStatus, BadgeTone> = {
	upcoming: "neutral",
	due_today: "warning",
	overdue: "overdue",
	paid: "success",
};

// Design ".bd" comes in three heights: 20 (dense rows), 22 (lists), 24 (headers).
export type BadgeSize = "sm" | "md" | "lg";
const SIZES = {
	sm: { minHeight: 20, paddingHorizontal: 7, fontSize: 11 },
	md: { minHeight: 22, paddingHorizontal: 8, fontSize: 12 },
	lg: { minHeight: 24, paddingHorizontal: 9, fontSize: 12 },
} as const;

type BadgeProps = { label: string; tone: BadgeTone; size?: BadgeSize; testID?: string };

// Colour never carries meaning alone: the label is always shown.
export function Badge({ label, tone, size = "md", testID }: BadgeProps) {
	const { colors, typography, radius, sizes } = useAppTheme();
	const [fg, bg] = TONE_COLORS[tone];
	const { minHeight, paddingHorizontal, fontSize } = SIZES[size];
	return (
		<View
			testID={testID}
			style={[
				styles.badge,
				{
					minHeight,
					paddingHorizontal,
					backgroundColor: colors[bg],
					borderRadius: radius.pill,
				},
			]}
		>
			<Text
				maxFontSizeMultiplier={sizes.maxAmountFontScale}
				style={[typography.badge, { fontSize, color: colors[fg] }]}
			>
				{label}
			</Text>
		</View>
	);
}

export function AgreementStatusBadge({
	status,
	size,
	testID,
}: {
	status: AgreementStatus;
	size?: BadgeSize;
	testID?: string;
}) {
	return (
		<Badge
			label={tr.agreement.status[status]}
			tone={AGREEMENT_TONE[status]}
			size={size}
			testID={testID}
		/>
	);
}

export function InstallmentStatusBadge({
	status,
	partial,
	size,
	testID,
}: {
	status: InstallmentStatus;
	partial: boolean;
	size?: BadgeSize;
	testID?: string;
}) {
	const label = partial
		? `${tr.installment.status[status]} · ${tr.installment.partial}`
		: tr.installment.status[status];
	return <Badge label={label} tone={INSTALLMENT_TONE[status]} size={size} testID={testID} />;
}

const styles = StyleSheet.create({
	badge: {
		alignSelf: "flex-start",
		justifyContent: "center",
		paddingVertical: 2,
	},
});
