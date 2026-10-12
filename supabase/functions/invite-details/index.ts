// W03 again after a page reload: the approval session (not the link) gives access to the plan.
import { verifySession } from "../_shared/invite.ts";
import { json, readBody, rpcError, serviceClient, sessionSecret, text } from "../_shared/server.ts";
import { withSentry } from "../_shared/sentry.ts";

Deno.serve(
	withSentry("invite-details", async (request) => {
		if (request.method !== "POST") {
			return json(405, { error: "method_not_allowed" });
		}
		const body = await readBody(request);
		const session =
			body === null ? null : await verifySession(text(body, "session"), sessionSecret());
		if (session === null) {
			return json(401, { error: "session_expired" });
		}
		const { data, error } = await serviceClient().rpc("invite_details", {
			p_invite_id: session.invite_id,
		});
		return error ? rpcError(error) : json(200, { phone: session.phone, details: data });
	}),
);
