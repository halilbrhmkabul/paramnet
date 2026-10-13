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

type BadgeProps = { label: string; tone: BadgeTone; testID?: string };

// Colour never carries meaning alone: the label is always shown.
export function Badge({ label, tone, testID }: BadgeProps) {
	const { colors, typography, radius, sizes } = useAppTheme();
	const [fg, bg] = TONE_COLORS[tone];
	return (
		<View
			testID={testID}
			style={[styles.badge, { backgroundColor: colors[bg], borderRadius: radius.pill }]}
		>
			<Text
				maxFontSizeMultiplier={sizes.maxAmountFontScale}
				style={[typography.badge, { color: colors[fg] }]}
			>
				{label}
			</Text>
		</View>
	);
}

export function AgreementStatusBadge({
	status,
	testID,
}: {
	status: AgreementStatus;
	testID?: string;
}) {
	return (
		<Badge label={tr.agreement.status[status]} tone={AGREEMENT_TONE[status]} testID={testID} />
	);
}

export function InstallmentStatusBadge({
	status,
	partial,
	testID,
}: {
	status: InstallmentStatus;
	partial: boolean;
	testID?: string;
}) {
	const label = partial
		? `${tr.installment.status[status]} · ${tr.installment.partial}`
		: tr.installment.status[status];
	return <Badge label={label} tone={INSTALLMENT_TONE[status]} testID={testID} />;
}

const styles = StyleSheet.create({
	badge: {
		alignSelf: "flex-start",
		minHeight: 24,
		justifyContent: "center",
		paddingHorizontal: 9,
		paddingVertical: 3,
	},
});
