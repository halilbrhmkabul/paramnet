import { useNetInfo } from "@react-native-community/netinfo";

// Unknown (null) counts as online so the first render does not flash a disabled state.
export function useIsOnline(): boolean {
	return useNetInfo().isConnected !== false;
}
