import { useLocalSearchParams } from "expo-router";

import { InterestScreen } from "@/features/interest/InterestScreen";

export default function InterestRoute() {
	const { card, loan } = useLocalSearchParams<{ card?: string; loan?: string }>();
	return <InterestScreen cardId={card ?? null} loanId={loan ?? null} />;
}
