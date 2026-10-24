import { useLocalSearchParams } from "expo-router";

import { DeliveryScreen } from "@/features/request/DeliveryScreen";

export default function DeliveryRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <DeliveryScreen id={id} />;
}
