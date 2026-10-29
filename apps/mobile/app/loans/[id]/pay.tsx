import { useLocalSearchParams } from "expo-router";

import { LoanPaymentScreen } from "@/features/loans/LoanPaymentScreen";

export default function LoanPaymentRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <LoanPaymentScreen id={id} />;
}
