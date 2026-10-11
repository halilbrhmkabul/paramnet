import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAuthApi } from "../auth/supabaseAuth";
import { ApiError } from "../errors";

type Result = { data: unknown; error: unknown };

function fakeClient(overrides: {
	signInWithOtp?: Result;
	verifyOtp?: Result;
	getSession?: Result;
	profile?: Result;
	rpc?: Result;
}) {
	const calls: { method: string; args: unknown[] }[] = [];
	const record =
		(method: string, result: Result | undefined) =>
		(...args: unknown[]) => {
			calls.push({ method, args });
			return Promise.resolve(result ?? { data: null, error: null });
		};
	const client = {
		auth: {
			signInWithOtp: record("signInWithOtp", overrides.signInWithOtp),
			verifyOtp: record("verifyOtp", overrides.verifyOtp),
			getSession: record("getSession", overrides.getSession),
			signOut: record("signOut", undefined),
			onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
		},
		from: () => ({
			select: () => ({ maybeSingle: record("profile", overrides.profile) }),
		}),
		rpc: record("rpc", overrides.rpc),
	};
	return { client: client as unknown as SupabaseClient, calls };
}

const user = { id: "u1", phone: "905550000001" };

describe("Supabase AuthApi", () => {
	it("sends the OTP to the normalised E.164 number", async () => {
		const { client, calls } = fakeClient({});
		await expect(createSupabaseAuthApi(client).requestOtp("0555 000 00 01")).resolves.toEqual({
			resend_after_s: 60,
		});
		expect(calls[0]).toEqual({ method: "signInWithOtp", args: [{ phone: "+905550000001" }] });
	});

	it("maps Supabase auth errors to app codes", async () => {
		const limited = fakeClient({
			signInWithOtp: { data: null, error: { code: "over_sms_send_rate_limit" } },
		});
		await expect(
			createSupabaseAuthApi(limited.client).requestOtp("5550000001"),
		).rejects.toEqual(new ApiError("rate_limited"));
		const wrong = fakeClient({ verifyOtp: { data: null, error: { code: "otp_expired" } } });
		await expect(
			createSupabaseAuthApi(wrong.client).verifyOtp("5550000001", "000000"),
		).rejects.toEqual(new ApiError("otp_invalid"));
		await expect(
			createSupabaseAuthApi(wrong.client).requestOtp("+15551234567"),
		).rejects.toEqual(new ApiError("invalid_phone"));
	});

	it("verifies the code and reads the profile name (null for a new user)", async () => {
		const fresh = fakeClient({
			verifyOtp: { data: { user, session: {} }, error: null },
			profile: { data: null, error: null },
		});
		await expect(
			createSupabaseAuthApi(fresh.client).verifyOtp("5550000001", "123456"),
		).resolves.toEqual({
			id: "u1",
			phone_e164: "+905550000001",
			display_name: null,
		});
		expect(fresh.calls[0]).toEqual({
			method: "verifyOtp",
			args: [{ phone: "+905550000001", token: "123456", type: "sms" }],
		});

		const returning = fakeClient({
			verifyOtp: { data: { user, session: {} }, error: null },
			profile: { data: { display_name: "Ayşe" }, error: null },
		});
		expect(
			(await createSupabaseAuthApi(returning.client).verifyOtp("5550000001", "123456"))
				.display_name,
		).toBe("Ayşe");
	});

	it("completes the profile with the consent versions", async () => {
		const { client, calls } = fakeClient({
			rpc: {
				data: { id: "u1", display_name: "Ayşe", phone_e164: "+905550000001" },
				error: null,
			},
		});
		await expect(createSupabaseAuthApi(client).updateProfile("Ayşe")).resolves.toEqual({
			id: "u1",
			display_name: "Ayşe",
			phone_e164: "+905550000001",
		});
		expect(calls[0]).toEqual({
			method: "rpc",
			args: [
				"complete_profile",
				{ p_display_name: "Ayşe", p_kvkk_version: "2026-10", p_terms_version: "2026-10" },
			],
		});
	});

	it("restores a stored session with its profile, or nothing", async () => {
		const none = fakeClient({ getSession: { data: { session: null }, error: null } });
		await expect(createSupabaseAuthApi(none.client).restore()).resolves.toBeNull();
		const stored = fakeClient({
			getSession: { data: { session: { user } }, error: null },
			profile: { data: { display_name: "Ayşe" }, error: null },
		});
		await expect(createSupabaseAuthApi(stored.client).restore()).resolves.toEqual({
			id: "u1",
			phone_e164: "+905550000001",
			display_name: "Ayşe",
		});
	});
});
