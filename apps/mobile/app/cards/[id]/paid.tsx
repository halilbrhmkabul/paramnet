import { useLocalSearchParams } from "expo-router";

import { CardPaidScreen } from "@/features/cards/CardPaidScreen";

// The before/after numbers travel from the payment form: the result screen shows that moment.
export default function CardPaidRoute() {
	const { tx, before, remaining } = useLocalSearchParams<{
		tx: string;
		before?: string;
		remaining?: string;
	}>();
	return (
		<CardPaidScreen
			txId={tx}
			beforeMinor={Number(before ?? "0")}
			remainingMinor={Number(remaining ?? "0")}
		/>
	);
}
