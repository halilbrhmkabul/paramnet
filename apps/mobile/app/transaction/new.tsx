import { useLocalSearchParams } from "expo-router";

import { TransactionFormScreen, type FormKind } from "@/features/cash/TransactionFormScreen";

const KINDS: readonly string[] = ["expense", "income", "transfer"];

function isKind(value: string | undefined): value is FormKind {
	return value !== undefined && KINDS.includes(value);
}

export default function NewTransactionRoute() {
	const { kind, account } = useLocalSearchParams<{ kind?: string; account?: string }>();
	return (
		<TransactionFormScreen
			kind={isKind(kind) ? kind : "expense"}
			accountId={account === undefined || account === "" ? null : account}
			editId={null}
		/>
	);
}
