import { formatDateTR } from "@paramnet/shared";
import { router } from "expo-router";
import { View } from "react-native";

import type { DueItem } from "@/api/types";
import { AmountText } from "@/components/AmountText";
import { ListItem } from "@/components/ListItem";
import { InstallmentStatusBadge } from "@/components/StatusBadge";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

export function installmentPosition(seq: number, count: number): string {
	return count === 1
		? tr.installment.single
		: fill(tr.installment.position, { seq: String(seq), count: String(count) });
}

// One unpaid installment in a list (home, calendar). Receivables are green, payables orange, always with a label.
export function DueItemRow({ item, testID }: { item: DueItem; testID: string }) {
	const { spacing } = useAppTheme();
	const title = `${item.counterparty_name} · ${item.title}`;
	return (
		<ListItem
			title={title}
			subtitle={`${formatDateTR(item.due_date, "short")} · ${installmentPosition(item.seq, item.installment_count)}`}
			accessibilityLabel={title}
			onPress={() => {
				router.push({ pathname: "/agreement/[id]", params: { id: item.agreement_id } });
			}}
			right={
				<View style={{ alignItems: "flex-end", gap: spacing.xs }}>
					<AmountText
						minor={item.due_minor}
						variant="headline"
						tone={item.my_role === "creditor" ? "receivable" : "payable"}
					/>
					<InstallmentStatusBadge
						status={item.state.status}
						partial={item.state.partial}
					/>
				</View>
			}
			testID={testID}
		/>
	);
}
