export type NotificationPermission = "granted" | "denied";

// Prototype stand-in: F1-18 replaces this with expo-notifications (permission + Expo push token).
export async function requestNotificationPermission(): Promise<NotificationPermission> {
	return Promise.resolve("granted");
}
