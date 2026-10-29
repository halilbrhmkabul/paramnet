import { useLocalSearchParams } from "expo-router";

import { SplitScreen } from "@/features/split/SplitScreen";

export default function SplitRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <SplitScreen id={id} />;
}
