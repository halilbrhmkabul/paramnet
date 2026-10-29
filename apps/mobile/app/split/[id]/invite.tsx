import { useLocalSearchParams } from "expo-router";

import { SplitInviteScreen } from "@/features/split/SplitInviteScreen";

export default function SplitInviteRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <SplitInviteScreen id={id} />;
}
