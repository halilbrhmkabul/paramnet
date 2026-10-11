// jest.setup mocks "@/lib/notifications" for screens; here the real module is loaded in isolation.
type Lib = typeof import("../notifications");

function load(platform: "ios" | "android", environment: string, onImport: () => void): Lib {
	// resetModules + doMock (not isolateModules): the library imports expo-notifications later,
	// asynchronously, and must still see these mocks then.
	jest.resetModules();
	{
		jest.doMock("react-native", () => ({ Platform: { OS: platform } }));
		jest.doMock("expo-constants", () => ({
			__esModule: true,
			default: { executionEnvironment: environment, expoConfig: { extra: {} } },
			ExecutionEnvironment: {
				StoreClient: "storeClient",
				Standalone: "standalone",
				Bare: "bare",
			},
		}));
		jest.doMock("expo-device", () => ({ isDevice: true }));
		jest.doMock("expo-notifications", () => {
			onImport();
			return {
				requestPermissionsAsync: () => Promise.resolve({ granted: true }),
				getPermissionsAsync: () => Promise.resolve({ granted: true }),
				setNotificationHandler: jest.fn(),
				getLastNotificationResponse: () => null,
				addNotificationResponseReceivedListener: () => ({ remove: jest.fn() }),
			};
		});
	}
	return jest.requireActual<Lib>("../notifications");
}

describe("notifications loader", () => {
	it("never imports expo-notifications in Expo Go on Android (it throws there since SDK 53)", async () => {
		const onImport = jest.fn();
		const lib = load("android", "storeClient", onImport);
		lib.configureForegroundNotifications();
		const stop = lib.onNotificationOpened(jest.fn());
		expect(await lib.requestNotificationPermission()).toBe("denied");
		expect(await lib.hasNotificationPermission()).toBe(false);
		expect(await lib.getPushToken()).toBeNull();
		stop();
		expect(onImport).not.toHaveBeenCalled();
	});

	it("does not import it just by being imported", () => {
		const onImport = jest.fn();
		load("ios", "storeClient", onImport);
		expect(onImport).not.toHaveBeenCalled();
	});

	it("uses it where it works (iOS Expo Go, development builds)", async () => {
		const onImport = jest.fn();
		const lib = load("ios", "storeClient", onImport);
		expect(await lib.requestNotificationPermission()).toBe("granted");
		expect(onImport).toHaveBeenCalled();
		const dev = load("android", "bare", jest.fn());
		expect(await dev.hasNotificationPermission()).toBe(true);
	});
});
