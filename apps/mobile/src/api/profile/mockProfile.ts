import {
	PARAMNET_ID_ALPHABET,
	PARAMNET_ID_LENGTH,
	PARAMNET_ID_PREFIX,
	addDays,
	normalizeParamnetId,
	normalizeUsername,
	todayInIstanbul,
} from "@paramnet/shared";

import { ApiError } from "../errors";
import { MOCK_DIRECTORY, MOCK_OWN_PARAMNET_ID, SEED_IDS } from "../mock/seed";
import type { InboxItem, MyProfile, ReminderDay } from "../types";
import type { ProfileApi } from "./ProfileApi";
import { clock } from "@/lib/clock";

const DAY_MS = 24 * 3600 * 1000;
const HOUR_MS = 3600 * 1000;
const REGENERATE_EVERY_MS = 30 * DAY_MS;
// Names other prototype users already hold.
const TAKEN_USERNAMES = ["ahmet", "emre.kilic"];
const REMINDER_DAYS: readonly ReminderDay[] = [7, 3, 1, 0];

export type MockProfileOptions = {
	now?: () => Date;
	latencyMs?: number;
	profile?: Partial<MyProfile>;
	inbox?: "demo" | "empty";
};

function demoInbox(now: Date): InboxItem[] {
	const at = (msAgo: number) => new Date(now.getTime() - msAgo).toISOString();
	const today = todayInIstanbul(now);
	return [
		{
			id: 1,
			template: "paymentConfirmed",
			category: "completed",
			payload: {
				agreement_id: SEED_IDS.mertLoan,
				name: "Mert Demir",
				amount_minor: 50000,
				remaining_minor: 50000,
			},
			agreement_id: SEED_IDS.mertLoan,
			created_at: at(12 * DAY_MS),
			read_at: at(12 * DAY_MS),
		},
		{
			id: 2,
			template: "dueSoon",
			category: "reminder",
			payload: {
				agreement_id: SEED_IDS.yildizFurniture,
				name: "Yıldız Mobilya",
				amount_minor: 333333,
				due_date: addDays(today, 3),
				seq: 3,
				count: 6,
			},
			agreement_id: SEED_IDS.yildizFurniture,
			created_at: at(3 * DAY_MS),
			read_at: at(3 * DAY_MS),
		},
		{
			id: 3,
			template: "dueToday",
			category: "reminder",
			payload: {
				agreement_id: SEED_IDS.ahmetLoan,
				name: "Ahmet Yılmaz",
				amount_minor: 400000,
				due_date: today,
				seq: 2,
				count: 3,
			},
			agreement_id: SEED_IDS.ahmetLoan,
			created_at: at(2 * HOUR_MS),
			read_at: null,
		},
		{
			id: 4,
			template: "shareReceived",
			category: "approval",
			payload: {
				agreement_id: SEED_IDS.zeynepShare,
				name: "Zeynep Arslan",
				amount_minor: 600000,
			},
			agreement_id: SEED_IDS.zeynepShare,
			created_at: at(HOUR_MS),
			read_at: null,
		},
	];
}

function randomParamnetId(): string {
	let code = "";
	for (let i = 0; i < PARAMNET_ID_LENGTH; i += 1) {
		code += PARAMNET_ID_ALPHABET.charAt(
			Math.floor(Math.random() * PARAMNET_ID_ALPHABET.length),
		);
	}
	return PARAMNET_ID_PREFIX + code;
}

// In-memory profile for the prototype and tests; the photo stays a local file URI.
export function createMockProfileApi({
	now = () => clock.now(),
	latencyMs = 300,
	profile = {},
	inbox = "demo",
}: MockProfileOptions = {}): ProfileApi {
	let me: MyProfile = {
		id: "u-demo",
		first_name: "Deniz",
		last_name: "Yılmaz",
		display_name: "Deniz Yılmaz",
		username: "denizyilmaz",
		phone_e164: "+905550000001",
		paramnet_id: MOCK_OWN_PARAMNET_ID,
		id_discoverable: true,
		can_regenerate_at: new Date(now().getTime() - 10 * DAY_MS).toISOString(),
		avatar_path: null,
		reminder_before_days: [3, 0],
		...profile,
	};
	let items = inbox === "demo" ? demoInbox(now()) : [];

	async function respond<T>(produce: () => T): Promise<T> {
		if (latencyMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, latencyMs));
		}
		const value = produce();
		// A copy, so callers never mutate the in-memory profile; void results have nothing to copy.
		return (value === undefined ? value : JSON.parse(JSON.stringify(value))) as T;
	}

	return {
		getMyProfile: () => respond(() => me),

		updateProfile: (input) =>
			respond(() => {
				const first = input.first_name.trim();
				const last = input.last_name.trim();
				if (first === "") {
					throw new ApiError("validation_error", { field: "first_name" });
				}
				let username: string | null = null;
				if (input.username.trim() !== "") {
					username = normalizeUsername(input.username);
					if (username === null) {
						throw new ApiError("validation_error", { field: "username" });
					}
					if (TAKEN_USERNAMES.includes(username)) {
						throw new ApiError("username_taken");
					}
				}
				me = {
					...me,
					first_name: first,
					last_name: last === "" ? null : last,
					display_name: last === "" ? first : `${first} ${last}`,
					username,
				};
				return me;
			}),

		checkUsername: (username) =>
			respond(() => {
				const name = normalizeUsername(username);
				if (name === null) {
					return "invalid" as const;
				}
				return TAKEN_USERNAMES.includes(name) ? ("taken" as const) : ("available" as const);
			}),

		uploadAvatar: (localUri) =>
			respond(() => {
				me = { ...me, avatar_path: localUri };
				return { avatar_path: localUri };
			}),

		removeAvatar: () =>
			respond(() => {
				me = { ...me, avatar_path: null };
			}),

		// The prototype keeps the picked file's own URI as the path.
		avatarUrl: (path) => Promise.resolve(path),

		findByParamnetId: (input) =>
			respond(() => {
				const id = normalizeParamnetId(input);
				if (id === null) {
					return { status: "invalid" as const };
				}
				if (id === me.paramnet_id) {
					return { status: "self" as const };
				}
				const name = MOCK_DIRECTORY[id];
				return name === undefined
					? { status: "not_found" as const }
					: { status: "found" as const, display_name: name, paramnet_id: id };
			}),

		regenerateParamnetId: () =>
			respond(() => {
				if (new Date(me.can_regenerate_at).getTime() > now().getTime()) {
					throw new ApiError("rate_limited", { field: "paramnet_id" });
				}
				me = {
					...me,
					paramnet_id: randomParamnetId(),
					can_regenerate_at: new Date(
						now().getTime() + REGENERATE_EVERY_MS,
					).toISOString(),
				};
				return { paramnet_id: me.paramnet_id, can_regenerate_at: me.can_regenerate_at };
			}),

		setIdDiscoverable: (on) =>
			respond(() => {
				me = { ...me, id_discoverable: on };
			}),

		listNotifications: (category, beforeId) =>
			respond(() => ({
				items: items
					.filter(
						(item) =>
							(category === null || item.category === category) &&
							(beforeId === null || item.id < beforeId),
					)
					.sort((a, b) => b.id - a.id),
				unread_count: items.filter((item) => item.read_at === null).length,
				// The server counts what still waits in Talepler; the prototype's inbox stands in for it.
				approval_count: items.filter(
					(item) => item.category === "approval" && item.read_at === null,
				).length,
			})),

		markNotificationsRead: (ids) =>
			respond(() => {
				const readAt = now().toISOString();
				items = items.map((item) =>
					item.read_at === null && (ids === null || ids.includes(item.id))
						? { ...item, read_at: readAt }
						: item,
				);
			}),

		setReminderPrefs: (days) =>
			respond(() => {
				if (days.some((day) => !REMINDER_DAYS.includes(day))) {
					throw new ApiError("validation_error", { field: "reminder_before_days" });
				}
				const sorted = [...new Set(days)].sort((a, b) => b - a);
				me = { ...me, reminder_before_days: sorted };
				return sorted;
			}),
	};
}
