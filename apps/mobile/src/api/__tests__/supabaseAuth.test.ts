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
	invoke?: Result;
	setSession?: Result;
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
			setSession: record("setSession", overrides.setSession),
			signOut: record("signOut", undefined),
			onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
		},
		from: () => ({
			select: () => ({ maybeSingle: record("profile", overrides.profile) }),
		}),
		rpc: record("rpc", overrides.rpc),
		functions: { invoke: record("invoke", overrides.invoke) },
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
			has_pin: false,
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
			has_pin: false,
		});
	});

	it("deletes the account through the edge function, then forgets the local session (F3-03)", async () => {
		const { client, calls } = fakeClient({ invoke: { data: { deleted: true }, error: null } });
		await createSupabaseAuthApi(client).deleteAccount();
		expect(calls).toEqual([
			{ method: "invoke", args: ["delete-account", { method: "POST" }] },
			{ method: "signOut", args: [{ scope: "local" }] },
		]);
	});

	it("keeps the session when deletion fails", async () => {
		const { client, calls } = fakeClient({ invoke: { data: null, error: new Error("boom") } });
		await expect(createSupabaseAuthApi(client).deleteAccount()).rejects.toBeInstanceOf(Error);
		expect(calls.map((c) => c.method)).toEqual(["invoke"]);
	});

	// supabase-js hands a non-2xx function answer over as an error whose context is the Response.
	function httpError(body: unknown) {
		return { name: "FunctionsHttpError", context: { json: () => Promise.resolve(body) } };
	}

	it("signs in through pin-login and keeps the returned session (ADR-046)", async () => {
		const tokens = { access_token: "at", refresh_token: "rt", expires_in: 3600 };
		const { client, calls } = fakeClient({
			invoke: { data: { session: tokens }, error: null },
			setSession: { data: { user, session: {} }, error: null },
			profile: { data: { display_name: "Ayşe" }, error: null },
			rpc: { data: true, error: null },
		});
		await expect(
			createSupabaseAuthApi(client).signInWithPin("0555 000 00 01", "482915"),
		).resolves.toEqual({
			id: "u1",
			phone_e164: "+905550000001",
			display_name: "Ayşe",
			has_pin: true,
		});
		expect(calls.slice(0, 2)).toEqual([
			{
				method: "invoke",
				args: ["pin-login", { body: { phone: "+905550000001", pin: "482915" } }],
			},
			{ method: "setSession", args: [{ access_token: "at", refresh_token: "rt" }] },
		]);
		expect(calls).toContainEqual({ method: "rpc", args: ["has_pin"] });
	});

	it("maps a wrong PIN and a locked number with their details (ADR-049)", async () => {
		const wrong = fakeClient({
			invoke: {
				data: null,
				error: httpError({ error: "invalid_credentials", attempts_left: 2 }),
			},
		});
		const error: unknown = await createSupabaseAuthApi(wrong.client)
			.signInWithPin("5550000001", "482915")
			.catch((e: unknown) => e);
		expect(error).toEqual(new ApiError("invalid_credentials"));
		expect((error as ApiError).details).toEqual({ attempts_left: 2 });
		expect(wrong.calls.map((c) => c.method)).toEqual(["invoke"]);

		const locked = fakeClient({
			invoke: {
				data: null,
				error: httpError({ error: "account_locked", retry_after_s: 840 }),
			},
		});
		const lockError: unknown = await createSupabaseAuthApi(locked.client)
			.signInWithPin("5550000001", "482915")
			.catch((e: unknown) => e);
		expect(lockError).toEqual(new ApiError("account_locked"));
		expect((lockError as ApiError).details).toEqual({ retry_after_s: 840 });
	});

	it("sets the PIN through pin-set", async () => {
		const ok = fakeClient({ invoke: { data: { pin_set: true }, error: null } });
		await createSupabaseAuthApi(ok.client).setPin("482915");
		expect(ok.calls).toEqual([
			{ method: "invoke", args: ["pin-set", { body: { pin: "482915" } }] },
		]);
		const weak = fakeClient({
			invoke: { data: null, error: httpError({ error: "pin_weak" }) },
		});
		await expect(createSupabaseAuthApi(weak.client).setPin("123456")).rejects.toEqual(
			new ApiError("pin_weak"),
		);
	});
});
