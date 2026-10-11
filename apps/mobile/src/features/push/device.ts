import type { AuthApi } from "@/api/auth/AuthApi";
import { getPushToken, hasNotificationPermission } from "@/lib/notifications";

let registeredToken: string | null = null;

// Best effort: reminders are a convenience, so a failure here never blocks the app.
export async function registerDevice(auth: AuthApi): Promise<void> {
	try {
		if (!(await hasNotificationPermission())) {
			return;
		}
		const push = await getPushToken();
		if (push === null) {
			return;
		}
		await auth.registerPushToken(push.token, push.platform);
		registeredToken = push.token;
	} catch {
		// Retried on the next launch.
	}
}

// On sign-out the device must stop receiving the previous account's reminders.
export async function unregisterDevice(auth: AuthApi): Promise<void> {
	if (registeredToken === null) {
		return;
	}
	const token = registeredToken;
	registeredToken = null;
	await auth.unregisterPushToken(token).catch(() => undefined);
}
