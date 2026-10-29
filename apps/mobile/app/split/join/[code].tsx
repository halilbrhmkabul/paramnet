import { useLocalSearchParams } from "expo-router";

import { SplitJoinScreen } from "@/features/split/SplitJoinScreen";

export default function SplitJoinRoute() {
	const { code, via } = useLocalSearchParams<{ code: string; via?: string }>();
	return <SplitJoinScreen code={code.toUpperCase()} via={via === "qr" ? "qr" : "link"} />;
}
