import { useEffect, useState, type ReactNode } from "react";
import {
	Dimensions,
	Keyboard,
	Platform,
	ScrollView,
	View,
	type RefreshControlProps,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { useAppTheme } from "@/theme/useAppTheme";

export type ScreenProps = {
	children: ReactNode;
	scroll?: boolean;
	edges?: Edge[];
	refreshControl?: React.ReactElement<RefreshControlProps>;
	footer?: ReactNode;
	testID?: string;
};

export function keyboardOverlap(screenHeight: number, keyboardTop: number): number {
	return Math.max(0, screenHeight - keyboardTop);
}

// iOS draws the keyboard over the window; Android resizes it (adjustResize). Taken from the screen, not
// from measureInWindow: inside a modal card that reports card coordinates, and the footer stays hidden.
function useKeyboardInset() {
	const [inset, setInset] = useState(0);
	useEffect(() => {
		if (Platform.OS !== "ios") {
			return;
		}
		// One event for showing, hiding and resizing: a keyboard closing with a sheet while the next field
		// opens it again fires hide after show, and the last frame is the one that counts.
		const change = Keyboard.addListener("keyboardWillChangeFrame", (event) => {
			setInset(
				keyboardOverlap(Dimensions.get("window").height, event.endCoordinates.screenY),
			);
		});
		return () => {
			change.remove();
		};
	}, []);
	return inset;
}

export function Screen({
	children,
	scroll = true,
	edges = ["top"],
	refreshControl,
	footer,
	testID,
}: ScreenProps) {
	const { colors, sizes, spacing } = useAppTheme();
	const inset = useKeyboardInset();
	const padding = {
		paddingHorizontal: sizes.screenPadding,
		paddingVertical: spacing.lg,
		gap: spacing.lg,
	};
	return (
		<View style={{ flex: 1, paddingBottom: inset, backgroundColor: colors.bg }}>
			{/* The keyboard covers the home indicator: its inset is not kept, or the footer stays under it. */}
			<SafeAreaView
				testID={testID}
				edges={inset > 0 ? edges.filter((edge) => edge !== "bottom") : edges}
				style={{ flex: 1, backgroundColor: colors.bg }}
			>
				{scroll ? (
					<ScrollView
						contentContainerStyle={padding}
						refreshControl={refreshControl}
						keyboardShouldPersistTaps="handled"
						// The number pad has no return key: a drag is the way out of it, on short screens too.
						keyboardDismissMode="on-drag"
						alwaysBounceVertical
					>
						{children}
					</ScrollView>
				) : (
					<View style={[{ flex: 1 }, padding]}>{children}</View>
				)}
				{footer !== undefined ? (
					<View
						style={{
							paddingHorizontal: sizes.screenPadding,
							paddingBottom: spacing.lg,
						}}
					>
						{footer}
					</View>
				) : null}
			</SafeAreaView>
		</View>
	);
}
