import { addMonthsClamped, todayInIstanbul } from "@paramnet/shared";
import { createClient } from "@supabase/supabase-js";

import { createSupabaseAuthApi } from "../auth/supabaseAuth";
import { createSupabaseAgreementsApi } from "../supabase/supabaseAgreements";

// Web confirmation end to end (F2-02): Ayşe shares in the app, the invitee answers through the invite
// edge functions without an account. Needs `pnpm supabase functions serve --env-file
// supabase/functions/.env.example` next to the local stack.
const rawUrl: unknown = process.env.PARAMNET_SUPABASE_URL;
const rawKey: unknown = process.env.PARAMNET_SUPABASE_KEY;
const url = typeof rawUrl === "string" ? rawUrl : undefined;
const key = typeof rawKey === "string" ? rawKey : undefined;
const describeLocal = url !== undefined && key !== undefined ? describe : describe.skip;

async function call(
	name: string,
	init: { method: "GET" | "POST"; body?: unknown; query?: string },
) {
	const response = await fetch(`${url ?? ""}/functions/v1/${name}${init.query ?? ""}`, {
		method: init.method,
		headers: {
			"content-type": "application/json",
			apikey: key ?? "",
			"user-agent": "integration-test",
		},
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
	});
	return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describeLocal("invite web flow against local Supabase (F2-02)", () => {
	const client = createClient(url ?? "", key ?? "", {
		auth: { persistSession: false, autoRefreshToken: false },
	});
	const auth = createSupabaseAuthApi(client);
	const api = createSupabaseAgreementsApi(client);

	it("open → code → verify → decide, with the safety rules", async () => {
		await auth.requestOtp("+905550000001").catch(() => undefined);
		await auth.verifyOtp("+905550000001", "123456");
		await auth.updateProfile("Ayşe");

		const { agreement_id } = await api.createAgreement(
			{
				kind: "loan",
				creator_role: "creditor",
				title: "Web onay",
				description: null,
				started_on: null,
				counterparty: {
					contact: {
						display_name: `Web ${String(Date.now())}`,
						phone_e164: null,
						kind: "person",
					},
				},
				terms: {
					principal_minor: 200000,
					down_payment_minor: 0,
					notes: null,
					plan: [
						{
							seq: 1,
							due_date: addMonthsClamped(todayInIstanbul(), 1),
							amount_minor: 200000,
						},
					],
				},
			},
			crypto.randomUUID(),
		);
		const shared = await client.rpc("share_agreement", {
			p_id: agreement_id,
			p_phone: "+905550000002",
			p_row_version: 1,
		});
		expect(shared.error).toBeNull();
		const token = (shared.data as { token: string }).token;

		// GET is side-effect free; other methods are refused.
		expect(await call("invite-open", { method: "GET", query: `?token=${token}` })).toEqual({
			status: 200,
			body: { status: "active", creator_name: "Ayşe" },
		});
		expect((await call("invite-open", { method: "POST", body: { token } })).status).toBe(405);
		expect(
			(await call("invite-open", { method: "GET", query: `?token=${token}` })).body.status,
		).toBe("active");

		// A different number gets the same answer but no usable code.
		expect(
			await call("invite-otp-send", {
				method: "POST",
				body: { token, phone: "05550000003" },
			}),
		).toEqual({
			status: 200,
			body: { sent: true },
		});
		expect(
			(
				await call("invite-otp-verify", {
					method: "POST",
					body: { token, phone: "+905550000003", code: "123456" },
				})
			).body,
		).toEqual({
			error: "otp_invalid",
		});

		expect(
			(
				await call("invite-otp-send", {
					method: "POST",
					body: { token, phone: "0555 000 00 02" },
				})
			).status,
		).toBe(200);
		const verified = await call("invite-otp-verify", {
			method: "POST",
			body: { token, phone: "+905550000002", code: "123456" },
		});
		expect(verified.status).toBe(200);
		const details = verified.body.details as {
			version: number;
			terms_hash: string;
			my_role: string;
			principal_minor: number;
		};
		expect(details).toMatchObject({ version: 1, my_role: "debtor", principal_minor: 200000 });
		const session = verified.body.session as string;

		expect(
			(
				await call("invite-decide", {
					method: "POST",
					body: {
						session: `${session}x`,
						version: 1,
						terms_hash: details.terms_hash,
						decision: "accept",
					},
				})
			).status,
		).toBe(401);
		expect(
			(
				await call("invite-decide", {
					method: "POST",
					body: { session, version: 1, terms_hash: "0".repeat(64), decision: "accept" },
				})
			).body,
		).toEqual({ error: "conflict" });
		expect(
			await call("invite-decide", {
				method: "POST",
				body: { session, version: 1, terms_hash: details.terms_hash, decision: "accept" },
			}),
		).toEqual({ status: 200, body: { status: "active", version: 1 } });

		expect((await api.getAgreement(agreement_id)).status).toBe("active");
		expect(
			(await call("invite-open", { method: "GET", query: `?token=${token}` })).body.status,
		).toBe("consumed");
		expect((await api.getAgreement(agreement_id)).events.at(-1)?.type).toBe("accepted");
	}, 30000);
});
