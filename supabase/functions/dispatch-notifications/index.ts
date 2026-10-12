// Sends queued notifications (notification_outbox) through the Expo Push API. Called every minute by
// pg_cron (private.trigger_dispatch) with the service role key; never by clients.
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

import {
	buildMessages,
	interpretTickets,
	type ClaimedNotification,
	type PushTicket,
} from "../_shared/notifications.ts";
import { withSentry } from "../_shared/sentry.ts";

const EXPO_PUSH_URL = Deno.env.get("EXPO_PUSH_URL") ?? "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH = 100;
const MAX_ROUNDS = 5;

async function send(messages: unknown[]): Promise<PushTicket[]> {
	const tickets: PushTicket[] = [];
	for (let i = 0; i < messages.length; i += EXPO_BATCH) {
		const batch = messages.slice(i, i + EXPO_BATCH);
		try {
			const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
			const response = await fetch(EXPO_PUSH_URL, {
				method: "POST",
				headers: {
					accept: "application/json",
					"content-type": "application/json",
					...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
				},
				body: JSON.stringify(batch),
			});
			const json = (await response.json()) as { data?: PushTicket[] };
			tickets.push(
				...(response.ok && Array.isArray(json.data)
					? json.data
					: batch.map(() => ({ status: "error" as const }))),
			);
		} catch {
			// Network trouble: every message in this batch is retried later.
			tickets.push(...batch.map(() => ({ status: "error" as const })));
		}
	}
	return tickets;
}

Deno.serve(
	withSentry("dispatch-notifications", async (request) => {
		const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
		if (serviceKey === "" || request.headers.get("authorization") !== `Bearer ${serviceKey}`) {
			return new Response("unauthorized", { status: 401 });
		}
		const client = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey, {
			auth: { persistSession: false, autoRefreshToken: false },
		});

		let processed = 0;
		for (let round = 0; round < MAX_ROUNDS; round++) {
			const claimed = await client.rpc("claim_notifications", { p_limit: EXPO_BATCH });
			if (claimed.error) {
				return new Response(JSON.stringify({ error: claimed.error.message }), {
					status: 500,
				});
			}
			const rows = claimed.data as ClaimedNotification[];
			if (rows.length === 0) {
				break;
			}
			const { messages, owners } = buildMessages(rows);
			const tickets = messages.length === 0 ? [] : await send(messages);
			const finished = await client.rpc("finish_notifications", {
				p_results: interpretTickets(rows, owners, tickets),
			});
			if (finished.error) {
				return new Response(JSON.stringify({ error: finished.error.message }), {
					status: 500,
				});
			}
			processed += rows.length;
		}
		// Counts only; no personal data in responses or logs (spec 13).
		return new Response(JSON.stringify({ processed }), {
			headers: { "content-type": "application/json" },
		});
	}),
);
