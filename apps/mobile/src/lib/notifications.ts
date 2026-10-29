import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";

export type NotificationPermission = "granted" | "denied";
export type PushToken = { token: string; platform: "ios" | "android" };

type NotificationsModule = typeof import("expo-notifications");
type NotificationResponse = import("expo-notifications").NotificationResponse;

// Expo Go on Android dropped expo-notifications in SDK 53 and the module throws as soon as it is
// imported, which took every importing route down with it. It is therefore loaded lazily and never
// there; reminders simply stay off until a development build is used. The web build only exists for
// the design comparison (F4-12) and has no push either.
function unsupported(): boolean {
	return (
		Platform.OS === "web" ||
		(Platform.OS === "android" &&
			Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
	);
}

let loaded: NotificationsModule | null | undefined;

// A lazy require, not a top-level import: importing the module is what throws in Expo Go on Android.
function loadNow(): NotificationsModule | null {
	if (unsupported()) {
		return null;
	}
	if (loaded === undefined) {
		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay lazy (see above).
			loaded = require("expo-notifications") as NotificationsModule;
		} catch {
			loaded = null;
		}
	}
	return loaded;
}

function load(): Promise<NotificationsModule | null> {
	return Promise.resolve(loadNow());
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
	const Notifications = await load();
	if (Notifications === null) {
		return "denied";
	}
	const { granted } = await Notifications.requestPermissionsAsync();
	return granted ? "granted" : "denied";
}

export async function hasNotificationPermission(): Promise<boolean> {
	const Notifications = await load();
	return Notifications === null ? false : (await Notifications.getPermissionsAsync()).granted;
}

// app.json extra.eas.projectId, written by `eas init` (F3-06).
function readProjectId(): string | null {
	const extra: unknown = Constants.expoConfig?.extra;
	const eas: unknown =
		typeof extra === "object" && extra !== null && "eas" in extra ? extra.eas : undefined;
	const projectId: unknown =
		typeof eas === "object" && eas !== null && "projectId" in eas ? eas.projectId : undefined;
	return typeof projectId === "string" ? projectId : null;
}

// Null where a push token cannot exist: simulators, Expo Go on Android, or no EAS project id yet.
export async function getPushToken(): Promise<PushToken | null> {
	const projectId = readProjectId();
	if (!Device.isDevice || projectId === null) {
		return null;
	}
	const Notifications = await load();
	if (Notifications === null) {
		return null;
	}
	if (Platform.OS === "android") {
		await Notifications.setNotificationChannelAsync("default", {
			name: "Hatırlatmalar",
			importance: Notifications.AndroidImportance.DEFAULT,
		});
	}
	try {
		const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
		return { token: data, platform: Platform.OS === "ios" ? "ios" : "android" };
	} catch {
		return null;
	}
}

// Calls back with the agreement of a tapped reminder, including the one that cold-started the app.
export function onNotificationOpened(
	listener: (agreementId: string, template: string | null) => void,
): () => void {
	let stopped = false;
	let remove: (() => void) | null = null;
	const handle = (response: NotificationResponse | null) => {
		const data: unknown = response?.notification.request.content.data;
		if (
			typeof data === "object" &&
			data !== null &&
			"agreement_id" in data &&
			typeof data.agreement_id === "string"
		) {
			listener(
				data.agreement_id,
				"template" in data && typeof data.template === "string" ? data.template : null,
			);
		}
	};
	void load().then((Notifications) => {
		if (Notifications === null || stopped) {
			return;
		}
		handle(Notifications.getLastNotificationResponse());
		const subscription = Notifications.addNotificationResponseReceivedListener(handle);
		remove = () => {
			subscription.remove();
		};
	});
	return () => {
		stopped = true;
		remove?.();
	};
}

export function configureForegroundNotifications(): void {
	void load().then((Notifications) => {
		Notifications?.setNotificationHandler({
			handleNotification: () =>
				Promise.resolve({
					shouldShowBanner: true,
					shouldShowList: true,
					shouldPlaySound: false,
					shouldSetBadge: false,
				}),
		});
	});
}
