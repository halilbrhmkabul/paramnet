import { useLocalSearchParams } from "expo-router";

import { RequestSentScreen } from "@/features/request/RequestSentScreen";

export default function RequestSentRoute() {
	const p = useLocalSearchParams<{
		agreement: string;
		name: string;
		id: string;
		amount: string;
		due: string;
	}>();
	return (
		<RequestSentScreen
			agreementId={p.agreement}
			name={p.name}
			paramnetId={p.id}
			amountMinor={Number(p.amount)}
			due={p.due}
		/>
	);
}
