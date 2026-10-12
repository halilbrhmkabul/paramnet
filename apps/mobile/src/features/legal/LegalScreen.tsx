import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

import { ErrorState } from "@/components/ErrorState";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { SectionHeader } from "@/components/SectionHeader";
import { fill, tr } from "@/i18n/tr";
import { KVKK_VERSION, TERMS_VERSION } from "@/lib/legal";
import { useAppTheme } from "@/theme/useAppTheme";

const DOCUMENTS = {
	kvkk: { text: tr.legal.kvkk, version: KVKK_VERSION },
	terms: { text: tr.legal.terms, version: TERMS_VERSION },
};

function isDocument(value: string | undefined): value is keyof typeof DOCUMENTS {
	return value === "kvkk" || value === "terms";
}

// KVKK notice and terms (spec 5.1 step 4, S20). Readable signed out too, before accepting them.
export function LegalScreen() {
	const { doc } = useLocalSearchParams<{ doc: string }>();
	const { colors, typography, spacing } = useAppTheme();
	if (!isDocument(doc)) {
		return (
			<Screen testID="legal.screen" edges={["bottom"]}>
				<ErrorState
					message={tr.legal.notFound}
					onRetry={() => {
						router.back();
					}}
					testID="legal.error"
				/>
			</Screen>
		);
	}
	const { text, version } = DOCUMENTS[doc];
	return (
		<Screen testID="legal.screen" edges={["bottom"]}>
			<ScreenTitle>{text.title}</ScreenTitle>
			<Text testID="legal.version" style={[typography.caption, { color: colors.textMuted }]}>
				{fill(tr.legal.version, { version })}
			</Text>
			<Text testID="legal.draft" style={[typography.callout, { color: colors.warning }]}>
				{tr.legal.draft}
			</Text>
			{text.sections.map((section) => (
				<View key={section.heading} style={{ gap: spacing.xs }}>
					<SectionHeader>{section.heading}</SectionHeader>
					<Text style={[typography.body, { color: colors.text }]}>{section.body}</Text>
				</View>
			))}
		</Screen>
	);
}
