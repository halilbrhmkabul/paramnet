import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError, messageForError } from "../errors";
import { createSupabaseProfileApi } from "../profile/supabaseProfile";
import { tr } from "@/i18n/tr";

type Call = { fn: string; args: unknown };

function fakeClient(
	results: Record<string, { data: unknown; error: unknown }> = {},
	uploadError: unknown = null,
) {
	const calls: Call[] = [];
	const storage: { op: string; args: unknown[] }[] = [];
	const bucket = {
		upload: (...args: unknown[]) => {
			storage.push({ op: "upload", args });
			return Promise.resolve({ data: null, error: uploadError });
		},
		remove: (...args: unknown[]) => {
			storage.push({ op: "remove", args });
			return Promise.resolve({ data: [], error: null });
		},
		createSignedUrl: (...args: unknown[]) => {
			storage.push({ op: "sign", args });
			return Promise.resolve({ data: { signedUrl: "https://signed/x" }, error: null });
		},
	};
	const client = {
		rpc: (fn: string, args?: unknown) => {
			calls.push({ fn, args });
			return Promise.resolve(results[fn] ?? { data: {}, error: null });
		},
		auth: {
			getSession: () =>
				Promise.resolve({ data: { session: { user: { id: "uid-1" } } }, error: null }),
		},
		storage: { from: (name: string) => (name === "avatars" ? bucket : null) },
	};
	return { client: client as unknown as SupabaseClient, calls, storage };
}

describe("Supabase ProfileApi", () => {
	it.each([
		[
			"getMyProfile",
			(api: ReturnType<typeof createSupabaseProfileApi>) => api.getMyProfile(),
			"get_my_profile",
			undefined,
		],
		[
			"updateProfile",
			(api: ReturnType<typeof createSupabaseProfileApi>) =>
				api.updateProfile({ first_name: "Deniz", last_name: "Yılmaz", username: "deniz" }),
			"update_profile",
			{ p_first_name: "Deniz", p_last_name: "Yılmaz", p_username: "deniz" },
		],
		[
			"findByParamnetId",
			(api: ReturnType<typeof createSupabaseProfileApi>) => api.findByParamnetId("PN-7KQ2M9"),
			"find_by_paramnet_id",
			{ p_paramnet_id: "PN-7KQ2M9" },
		],
		[
			"regenerateParamnetId",
			(api: ReturnType<typeof createSupabaseProfileApi>) => api.regenerateParamnetId(),
			"regenerate_paramnet_id",
			undefined,
		],
		[
			"setIdDiscoverable",
			(api: ReturnType<typeof createSupabaseProfileApi>) => api.setIdDiscoverable(false),
			"set_id_discoverable",
			{ p_on: false },
		],
		[
			"listNotifications",
			(api: ReturnType<typeof createSupabaseProfileApi>) =>
				api.listNotifications("approval", 40),
			"list_notifications",
			{ p_category: "approval", p_before_id: 40, p_limit: 50 },
		],
		[
			"markNotificationsRead",
			(api: ReturnType<typeof createSupabaseProfileApi>) => api.markNotificationsRead(null),
			"mark_notifications_read",
			{ p_ids: null },
		],
	])("%s calls %s", async (_name, run, fn, args) => {
		const { client, calls } = fakeClient();
		await run(createSupabaseProfileApi(client));
		expect(calls).toEqual([{ fn, args }]);
	});

	it("unwraps the username status and the reminder days", async () => {
		const { client, calls } = fakeClient({
			check_username: { data: { status: "taken" }, error: null },
			set_reminder_prefs: { data: { reminder_before_days: [3, 0] }, error: null },
		});
		const api = createSupabaseProfileApi(client);
		await expect(api.checkUsername("ahmet")).resolves.toBe("taken");
		await expect(api.setReminderPrefs([0, 3])).resolves.toEqual([3, 0]);
		expect(calls[1]).toEqual({ fn: "set_reminder_prefs", args: { p_days: [0, 3] } });
	});

	it("uploads the photo to the user's folder, points the profile at it and deletes the old file", async () => {
		const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue({
			arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
		} as Response);
		const { client, calls, storage } = fakeClient({
			set_avatar: {
				data: { avatar_path: "x", previous_path: "uid-1/old.jpg" },
				error: null,
			},
		});
		const result = await createSupabaseProfileApi(
			client,
			() => "11111111-2222-4333-8444-555555555555",
		).uploadAvatar("file:///tmp/a.jpg");
		const path = "uid-1/11111111-2222-4333-8444-555555555555.jpg";
		expect(result).toEqual({ avatar_path: path });
		expect(storage[0]).toMatchObject({
			op: "upload",
			args: [path, expect.any(ArrayBuffer), { contentType: "image/jpeg", upsert: false }],
		});
		expect(calls).toEqual([{ fn: "set_avatar", args: { p_path: path } }]);
		expect(storage[1]).toEqual({ op: "remove", args: [["uid-1/old.jpg"]] });
		fetchMock.mockRestore();
	});

	it("removes the photo and its file", async () => {
		const { client, calls, storage } = fakeClient({
			set_avatar: {
				data: { avatar_path: null, previous_path: "uid-1/old.jpg" },
				error: null,
			},
		});
		await createSupabaseProfileApi(client).removeAvatar();
		expect(calls).toEqual([{ fn: "set_avatar", args: { p_path: null } }]);
		expect(storage).toEqual([{ op: "remove", args: [["uid-1/old.jpg"]] }]);
	});

	it("signs a short-lived URL for a photo", async () => {
		const { client, storage } = fakeClient();
		await expect(createSupabaseProfileApi(client).avatarUrl("uid-1/a.jpg")).resolves.toBe(
			"https://signed/x",
		);
		expect(storage[0]).toEqual({ op: "sign", args: ["uid-1/a.jpg", 3600] });
	});

	it("maps a taken username and the 30-day ID limit", async () => {
		const { client } = fakeClient({
			update_profile: { data: null, error: { code: "P0001", message: "username_taken" } },
			regenerate_paramnet_id: {
				data: null,
				error: { code: "P0001", message: "rate_limited", details: "paramnet_id" },
			},
		});
		const api = createSupabaseProfileApi(client);
		const taken = await api
			.updateProfile({ first_name: "A", last_name: "", username: "ahmet" })
			.catch((error: unknown) => error);
		expect(taken).toEqual(new ApiError("username_taken"));
		expect(messageForError(taken)).toBe(tr.error.usernameTaken);
		const wait = await api.regenerateParamnetId().catch((error: unknown) => error);
		expect(messageForError(wait)).toBe(tr.error.idRegenerateWait);
		expect(messageForError(new ApiError("rate_limited"), "paramnetId")).toBe(
			tr.error.idLimited,
		);
	});
});
