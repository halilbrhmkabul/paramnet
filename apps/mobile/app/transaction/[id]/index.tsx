import { useLocalSearchParams } from "expo-router";

import { TransactionDetailScreen } from "@/features/cash/TransactionDetailScreen";

export default function TransactionDetailRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <TransactionDetailScreen id={id} />;
}
