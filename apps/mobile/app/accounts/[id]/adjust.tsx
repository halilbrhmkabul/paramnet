import { useLocalSearchParams } from "expo-router";

import { AdjustBalanceScreen } from "@/features/cash/AdjustBalanceScreen";

export default function AdjustBalanceRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <AdjustBalanceScreen id={id} />;
}
