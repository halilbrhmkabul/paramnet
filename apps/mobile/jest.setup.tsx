import type { ReactElement } from "react";

import { clock } from "@/lib/clock";
import * as mockTesting from "@/testing/providers";

// Every test sees the same "today" as the mock adapter seed: 2026-10-11 (Europe/Istanbul).
clock.now = mockTesting.TEST_NOW;

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

// The root layout renders ApiProvider without props; in tests it receives the in-memory adapters,
// including one prepared with provideTestApi() (same module instance the tests import).
jest.mock("@/api/ApiProvider", () => {
	const actual = jest.requireActual<typeof import("@/api/ApiProvider")>("@/api/ApiProvider");
	const { useState } = jest.requireActual<typeof import("react")>("react");
	function MockApiProvider(props: Parameters<typeof actual.ApiProvider>[0]) {
		const [api] = useState(() => props.api ?? mockTesting.takeTestApi());
		const [authApi] = useState(() => props.authApi ?? mockTesting.takeTestAuthApi());
		const [queryClient] = useState(
			() => props.queryClient ?? mockTesting.takeTestQueryClient(),
		);
		return (
			<actual.ApiProvider {...props} api={api} authApi={authApi} queryClient={queryClient} />
		);
	}
	return { ...actual, ApiProvider: MockApiProvider };
});

jest.mock("@react-native-community/netinfo", () =>
	jest.requireActual<object>("@react-native-community/netinfo/jest/netinfo-mock.js"),
);
