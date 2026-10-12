// W03 → W04: accept / counter / reject with the approval session. The decision names the version and
// terms_hash that were shown (BR-06); the event log gets channel "web", the verified number, a keyed
// IP hash and the user agent as evidence.
import { hashIp, verifySession } from "../_shared/invite.ts";
import {
	clientIp,
	json,
	readBody,
	rpcError,
	serviceClient,
	sessionSecret,
	text,
} from "../_shared/server.ts";
import { withSentry } from "../_shared/sentry.ts";

Deno.serve(
	withSentry("invite-decide", async (request) => {
		if (request.method !== "POST") {
			return json(405, { error: "method_not_allowed" });
		}
		const body = await readBody(request);
		if (body === null || typeof body.version !== "number") {
			return json(400, { error: "validation_error" });
		}
		const secret = sessionSecret();
		const session = await verifySession(text(body, "session"), secret);
		if (session === null) {
			return json(401, { error: "session_expired" });
		}
		const counter = body.counter_terms;
		const { data, error } = await serviceClient().rpc("invite_decide", {
			p_invite_id: session.invite_id,
			p_phone: session.phone,
			p_version: body.version,
			p_terms_hash: text(body, "terms_hash"),
			p_decision: text(body, "decision"),
			p_counter_terms: typeof counter === "object" && counter !== null ? counter : null,
			p_ip_hash: await hashIp(clientIp(request), secret),
			p_user_agent: (request.headers.get("user-agent") ?? "").slice(0, 200),
		});
		return error ? rpcError(error) : json(200, data);
	}),
);
