// W02 → W03: checks the code (5 tries, then locked) and returns a 15-minute approval session plus
// the plan to decide on.
import { signSession } from "../_shared/invite.ts";
import {
	errorStatus,
	json,
	readBody,
	rpcError,
	serviceClient,
	sessionSecret,
	text,
} from "../_shared/server.ts";
import { withSentry } from "../_shared/sentry.ts";

Deno.serve(
	withSentry("invite-otp-verify", async (request) => {
		if (request.method !== "POST") {
			return json(405, { error: "method_not_allowed" });
		}
		const body = await readBody(request);
		if (body === null) {
			return json(400, { error: "validation_error" });
		}
		const client = serviceClient();
		const verified = await client.rpc("invite_verify_otp", {
			p_token: text(body, "token"),
			p_phone: text(body, "phone"),
			p_code: text(body, "code"),
		});
		if (verified.error) {
			return rpcError(verified.error);
		}
		const result = verified.data as {
			ok: boolean;
			error?: string;
			invite_id?: string;
			phone?: string;
		};
		if (!result.ok || result.invite_id === undefined || result.phone === undefined) {
			const code = result.error ?? "otp_invalid";
			return json(errorStatus(code), { error: code });
		}
		const details = await client.rpc("invite_details", { p_invite_id: result.invite_id });
		if (details.error) {
			return rpcError(details.error);
		}
		const session = await signSession(
			{ invite_id: result.invite_id, phone: result.phone },
			sessionSecret(),
		);
		return json(200, { session, details: details.data });
	}),
);
