import type { AgreementStatus, InstallmentStatus } from "@paramnet/shared";
import { StyleSheet, Text, View } from "react-native";

import { tr } from "@/i18n/tr";
import type { ColorToken } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

const AGREEMENT_TONE: Record<AgreementStatus, ColorToken> = {
	personal: "textMuted",
	pending: "pending",
	countered: "warning",
	active: "primary",
	amendment_pending: "warning",
	disputed: "warning",
	rejected: "textMuted",
	settled: "success",
	cancelled: "textMuted",
};

const INSTALLMENT_TONE: Record<InstallmentStatus, ColorToken> = {
	upcoming: "textMuted",
	due_today: "warning",
	overdue: "overdue",
	paid: "success",
};

type BadgeProps = { label: string; tone: ColorToken; testID?: string };

// Colour never carries meaning alone: the label is always shown.
export function Badge({ label, tone, testID }: BadgeProps) {
	const { colors, typography, radius, spacing, sizes } = useAppTheme();
	return (
		<View
			testID={testID}
			style={[
				styles.badge,
				{
					borderColor: colors[tone],
					borderRadius: radius.sm,
					paddingHorizontal: spacing.sm,
				},
			]}
		>
			<Text
				maxFontSizeMultiplier={sizes.maxAmountFontScale}
				style={[typography.micro, { color: colors[tone] }]}
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
		borderWidth: 1,
		paddingVertical: 2,
	},
});
