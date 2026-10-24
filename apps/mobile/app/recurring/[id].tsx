import { useLocalSearchParams } from "expo-router";

import { RecurringFormScreen } from "@/features/cash/RecurringFormScreen";

export default function EditRecurringRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <RecurringFormScreen id={id} />;
}
