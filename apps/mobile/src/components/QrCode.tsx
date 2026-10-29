import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { qrModules, qrRuns } from "@/features/split/splitModel";
import { useAppTheme } from "@/theme/useAppTheme";

// A QR code drawn with views: dark runs per row, on a white quiet zone so any camera reads it in both
// themes (design 41).
export function QrCode({
	value,
	size,
	accessibilityLabel,
	testID,
}: {
	value: string;
	size: number;
	accessibilityLabel: string;
	testID: string;
}) {
	const { colors } = useAppTheme();
	const rows = useMemo(() => qrModules(value), [value]);
	const cell = size / rows.length;
	return (
		<View
			testID={testID}
			accessible
			accessibilityRole="image"
			accessibilityLabel={accessibilityLabel}
			style={{ width: size, height: size }}
		>
			{rows.map((row, y) =>
				qrRuns(row).map((run) => (
					<View
						key={`${String(y)}-${String(run.start)}`}
						style={[
							styles.module,
							{
								top: y * cell,
								left: run.start * cell,
								width: run.length * cell + 0.5,
								height: cell + 0.5,
								// The code stays dark on white in both themes; the panel around it is the brand green.
								backgroundColor: colors.heroStage,
							},
						]}
					/>
				)),
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	module: { position: "absolute" },
});
