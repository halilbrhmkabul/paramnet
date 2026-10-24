import { useLocalSearchParams } from "expo-router";

import { TransactionFormScreen } from "@/features/cash/TransactionFormScreen";

export default function EditTransactionRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <TransactionFormScreen kind="expense" accountId={null} editId={id} />;
}
