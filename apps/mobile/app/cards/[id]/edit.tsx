import { useLocalSearchParams } from "expo-router";

import { CardFormScreen } from "@/features/cards/CardFormScreen";

export default function EditCardRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <CardFormScreen id={id} />;
}
