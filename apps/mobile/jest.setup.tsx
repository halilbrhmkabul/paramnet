import type { ReactElement } from "react";

import { clock } from "@/lib/clock";
import { TEST_NOW } from "@/testing/providers";

// Every test sees the same "today" as the mock adapter seed: 2026-10-11 (Europe/Istanbul).
clock.now = TEST_NOW;

// The native date picker cannot render in Jest; tests type an ISO day into this stand-in instead.
jest.mock("@react-native-community/datetimepicker", () => {
	const { TextInput } = jest.requireActual<typeof import("react-native")>("react-native");
	function MockDateTimePicker(props: {
		testID?: string;
		onValueChange?: (event: unknown, date: Date) => void;
	}): ReactElement {
		return (
			<TextInput
				testID={props.testID}
				onChangeText={(day: string) => {
					props.onValueChange?.({ type: "set" }, new Date(`${day}T12:00:00+03:00`));
				}}
			/>
		);
	}
	return { __esModule: true, default: MockDateTimePicker };
});

// expo-contacts needs its native module; screens reach it only through this wrapper.
jest.mock("@/lib/contactPicker", () => ({
	pickContact: jest.fn(() => Promise.resolve(null)),
}));
