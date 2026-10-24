import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "../errors";
import { toApiError } from "../supabase/toApiError";
import type { IdLookup, InboxPage, MyProfile, ReminderDay, UsernameStatus } from "../types";
import type { ProfileApi } from "./ProfileApi";
import { newIdempotencyKey } from "@/lib/ids";

const AVATARS = "avatars";
const SIGNED_URL_TTL_S = 3600;
const INBOX_PAGE = 50;

// Shapes are guarded by the pgTAP tests (240_paramnet_id, 250_profile, 260_notification_inbox).
// newId names the photo file; tests pass a fixed one.
export function createSupabaseProfileApi(
	client: SupabaseClient,
	newId: () => string = newIdempotencyKey,
): ProfileApi {
	async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
		const response: { data: unknown; error: unknown } = await client.rpc(fn, args);
		if (response.error !== null) {
			throw toApiError(response.error);
		}
		return response.data as T;
	}

	// Storage has no SQL delete (ADR-051): the app removes the replaced file. A leftover file costs only
	// space and goes with the account, so a failure here is not shown.
	async function removeFile(path: string | null): Promise<void> {
		if (path === null) {
			return;
		}
		try {
			await client.storage.from(AVATARS).remove([path]);
		} catch {
			// See above.
		}
	}

	return {
		getMyProfile: () => call<MyProfile>("get_my_profile"),
		updateProfile: (input) =>
			call<MyProfile>("update_profile", {
				p_first_name: input.first_name,
				p_last_name: input.last_name,
				p_username: input.username,
			}),
		checkUsername: async (username) =>
			(await call<{ status: UsernameStatus }>("check_username", { p_username: username }))
				.status,

		uploadAvatar: async (localUri) => {
			const { data } = await client.auth.getSession();
			const uid = data.session?.user.id;
			if (uid === undefined) {
				throw new ApiError("forbidden");
			}
			// The avatars policy only accepts {uid}/{uuid}.jpg (ADR-051).
			const path = `${uid}/${newId()}.jpg`;
			const bytes = await (await fetch(localUri)).arrayBuffer();
			const upload = await client.storage
				.from(AVATARS)
				.upload(path, bytes, { contentType: "image/jpeg", upsert: false });
			if (upload.error !== null) {
				throw toApiError(upload.error);
			}
			let previous: string | null;
			try {
				({ previous_path: previous } = await call<{ previous_path: string | null }>(
					"set_avatar",
					{ p_path: path },
				));
			} catch (error) {
				await removeFile(path);
				throw error;
			}
			await removeFile(previous);
			return { avatar_path: path };
		},

		removeAvatar: async () => {
			const { previous_path } = await call<{ previous_path: string | null }>("set_avatar", {
				p_path: null,
			});
			await removeFile(previous_path);
		},

		avatarUrl: async (path) => {
			const { data, error } = await client.storage
				.from(AVATARS)
				.createSignedUrl(path, SIGNED_URL_TTL_S);
			if (error !== null) {
				throw toApiError(error);
			}
			return data.signedUrl;
		},

		findByParamnetId: (paramnetId) =>
			call<IdLookup>("find_by_paramnet_id", { p_paramnet_id: paramnetId }),
		regenerateParamnetId: () => call("regenerate_paramnet_id"),
		setIdDiscoverable: async (on) => {
			await call("set_id_discoverable", { p_on: on });
		},
		listNotifications: (category, beforeId) =>
			call<InboxPage>("list_notifications", {
				p_category: category,
				p_before_id: beforeId,
				p_limit: INBOX_PAGE,
			}),
		markNotificationsRead: async (ids) => {
			await call("mark_notifications_read", { p_ids: ids });
		},
		setReminderPrefs: async (days) =>
			(
				await call<{ reminder_before_days: ReminderDay[] }>("set_reminder_prefs", {
					p_days: days,
				})
			).reminder_before_days,
	};
}
