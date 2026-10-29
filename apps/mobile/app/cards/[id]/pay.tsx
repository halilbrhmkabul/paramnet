import { useLocalSearchParams } from "expo-router";

import { CardPaymentScreen } from "@/features/cards/CardPaymentScreen";

export default function CardPaymentRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <CardPaymentScreen id={id} />;
}
