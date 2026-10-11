import { formatDateTR, formatTRY } from "@paramnet/shared";
import { router } from "expo-router";
import { View } from "react-native";

import type { AgreementSummary } from "@/api/types";
import { AmountText } from "@/components/AmountText";
import { ListItem } from "@/components/ListItem";
import { AgreementStatusBadge } from "@/components/StatusBadge";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

function nextLine(agreement: AgreementSummary): string {
	const role = agreement.my_role === "creditor" ? tr.agreement.owesYou : tr.agreement.youOwe;
	const next = agreement.next_installment;
	if (next === null) {
		return role;
	}
	const when =
		next.due_date === null ? tr.installment.noDueDate : formatDateTR(next.due_date, "short");
	return `${role} · ${when} · ${formatTRY(next.due_minor)}`;
}

export function AgreementRow({
	agreement,
	testID,
}: {
	agreement: AgreementSummary;
	testID: string;
}) {
	const { spacing } = useAppTheme();
	return (
		<ListItem
			title={agreement.title}
			subtitle={nextLine(agreement)}
			accessibilityLabel={`${agreement.title}, ${fill(tr.agreement.remainingOf, { amount: formatTRY(agreement.outstanding_minor) })}`}
			onPress={() => {
				router.push({ pathname: "/agreement/[id]", params: { id: agreement.id } });
			}}
			right={
				<View style={{ alignItems: "flex-end", gap: spacing.xs }}>
					<AmountText
						minor={agreement.outstanding_minor}
						variant="headline"
						tone={agreement.my_role === "creditor" ? "receivable" : "payable"}
					/>
					<AgreementStatusBadge status={agreement.status} />
				</View>
			}
			testID={testID}
		/>
	);
}
