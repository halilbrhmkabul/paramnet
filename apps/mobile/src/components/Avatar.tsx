import { Image, StyleSheet, Text, View } from "react-native";

import type { ColorToken } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

// Soft background + its text colour from the badge palette, so contrast is already tested.
const FALLBACK: readonly [ColorToken, ColorToken] = ["primary", "primarySoft"];
const TONES: readonly (readonly [ColorToken, ColorToken])[] = [
	["primary", "primarySoft"],
	["pending", "pendingSoft"],
	["warning", "warningSoft"],
	["success", "successSoft"],
	["neutral", "neutralSoft"],
];

export function initials(name: string): string {
	const letters = name
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((word) => word.charAt(0).toLocaleUpperCase("tr-TR"))
		.join("");
	return letters === "" ? "?" : letters;
}

// The same person always gets the same colour.
function toneFor(name: string): readonly [ColorToken, ColorToken] {
	let hash = 0;
	for (const char of name) {
		hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 997;
	}
	return TONES[hash % TONES.length] ?? FALLBACK;
}

// Design "av": initials in a circle, or the photo when there is one (ADR-051); decorative, the name is
// always written next to it.
export function Avatar({
	name,
	size = 42,
	uri = null,
	testID,
}: {
	name: string;
	size?: number;
	uri?: string | null;
	testID?: string;
}) {
	const { colors, fonts } = useAppTheme();
	const [fg, bg] = toneFor(name);
	const circle = { width: size, height: size, borderRadius: size / 2 };
	if (uri !== null) {
		return (
			<Image
				testID={testID === undefined ? undefined : `${testID}.image`}
				source={{ uri }}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
				style={[circle, { backgroundColor: colors[bg] }]}
			/>
		);
	}
	return (
		<View
			testID={testID}
			importantForAccessibility="no-hide-descendants"
			accessibilityElementsHidden
			style={[styles.circle, circle, { backgroundColor: colors[bg] }]}
		>
			<Text style={{ fontFamily: fonts.extrabold, fontSize: size / 3, color: colors[fg] }}>
				{initials(name)}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	circle: { alignItems: "center", justifyContent: "center" },
});
