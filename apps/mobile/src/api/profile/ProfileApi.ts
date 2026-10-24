import type {
	IdLookup,
	InboxPage,
	MyProfile,
	NotificationCategory,
	ProfileInput,
	ReminderDay,
	UsernameStatus,
} from "../types";

// The signed-in user's own profile, ParamNet ID and inbox (F4-02, ADR-050 / ADR-051). Kept apart from
// AgreementsApi; mock and Supabase adapters both implement it (EXPO_PUBLIC_API_MODE).
export interface ProfileApi {
	getMyProfile(): Promise<MyProfile>;
	updateProfile(input: ProfileInput): Promise<MyProfile>;
	checkUsername(username: string): Promise<UsernameStatus>;
	// localUri: an already squared and shrunk JPEG (src/lib/avatarImage.ts).
	uploadAvatar(localUri: string): Promise<{ avatar_path: string }>;
	removeAvatar(): Promise<void>;
	// A short-lived URL the image view can load; null when there is no photo.
	avatarUrl(path: string): Promise<string | null>;
	findByParamnetId(paramnetId: string): Promise<IdLookup>;
	regenerateParamnetId(): Promise<{ paramnet_id: string; can_regenerate_at: string }>;
	setIdDiscoverable(on: boolean): Promise<void>;
	listNotifications(
		category: NotificationCategory | null,
		beforeId: number | null,
	): Promise<InboxPage>;
	// null marks everything read.
	markNotificationsRead(ids: number[] | null): Promise<void>;
	setReminderPrefs(days: ReminderDay[]): Promise<ReminderDay[]>;
}
