import { router } from "expo-router";

import { Row, RowGroup } from "@/components/RowGroup";
import { Screen } from "@/components/Screen";
import { tr } from "@/i18n/tr";

// Profil > "Yasal metinler": the KVKK notice and the terms (F3-03 texts).
export function LegalListScreen() {
	return (
		<Screen testID="meLegal.screen" edges={["bottom"]}>
			<RowGroup>
				<Row
					icon="document-text-outline"
					title={tr.me.kvkk}
					onPress={() => {
						router.push({ pathname: "/legal/[doc]", params: { doc: "kvkk" } });
					}}
					testID="meLegal.kvkk.item"
				/>
				<Row
					icon="document-text-outline"
					title={tr.me.terms}
					onPress={() => {
						router.push({ pathname: "/legal/[doc]", params: { doc: "terms" } });
					}}
					testID="meLegal.terms.item"
				/>
			</RowGroup>
		</Screen>
	);
}
