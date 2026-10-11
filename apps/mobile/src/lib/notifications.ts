import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export type NotificationPermission = "granted" | "denied";
export type PushToken = { token: string; platform: "ios" | "android" };

export async function requestNotificationPermission(): Promise<NotificationPermission> {
	const { granted } = await Notifications.requestPermissionsAsync();
	return granted ? "granted" : "denied";
}

export async function hasNotificationPermission(): Promise<boolean> {
	return (await Notifications.getPermissionsAsync()).granted;
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

// Null where a push token cannot exist: simulators, or no EAS project id yet (F3-06 sets it up).
export async function getPushToken(): Promise<PushToken | null> {
	const projectId = readProjectId();
	if (!Device.isDevice || projectId === null) {
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
		// e.g. Expo Go on Android, which no longer receives remote pushes; reminders just stay off.
		return null;
	}
}

// Calls back with the agreement of a tapped reminder, including the one that cold-started the app.
export function onNotificationOpened(listener: (agreementId: string) => void): () => void {
	const handle = (response: Notifications.NotificationResponse | null) => {
		const data: unknown = response?.notification.request.content.data;
		if (
			typeof data === "object" &&
			data !== null &&
			"agreement_id" in data &&
			typeof data.agreement_id === "string"
		) {
			listener(data.agreement_id);
		}
	};
	handle(Notifications.getLastNotificationResponse());
	const subscription = Notifications.addNotificationResponseReceivedListener(handle);
	return () => {
		subscription.remove();
	};
}

export function configureForegroundNotifications(): void {
	Notifications.setNotificationHandler({
		handleNotification: () =>
			Promise.resolve({
				shouldShowBanner: true,
				shouldShowList: true,
				shouldPlaySound: false,
				shouldSetBadge: false,
			}),
	});
}
