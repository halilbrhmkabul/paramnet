import { useLocalSearchParams } from "expo-router";

import { LoanFormScreen } from "@/features/loans/LoanFormScreen";

export default function EditLoanRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <LoanFormScreen id={id} />;
}
