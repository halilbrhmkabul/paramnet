import { useLocalSearchParams } from "expo-router";

import { CardDetailScreen } from "@/features/cards/CardDetailScreen";

export default function CardDetailRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <CardDetailScreen id={id} />;
}
