import { useLocalSearchParams } from "expo-router";

import { LoanDetailScreen } from "@/features/loans/LoanDetailScreen";

export default function LoanDetailRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <LoanDetailScreen id={id} />;
}
