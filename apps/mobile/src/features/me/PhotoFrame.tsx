import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useAppTheme } from "@/theme/useAppTheme";

// Design 04 / 35: a 3 pt surface border and a hairline ring around the profile photo.
export function PhotoFrame({ children }: { children: ReactNode }) {
	const { colors } = useAppTheme();
	return (
		<View style={[styles.outer, { borderColor: colors.borderStrong }]}>
			<View style={[styles.inner, { borderColor: colors.surface }]}>{children}</View>
		</View>
	);
}

const styles = StyleSheet.create({
	outer: { borderWidth: 1, borderRadius: 999 },
	inner: { borderWidth: 3, borderRadius: 999 },
});
