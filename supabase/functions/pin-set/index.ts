// Sets or replaces the account PIN (ADR-046): after the SMS code at sign-up, "Şifremi unuttum" and for
// accounts from before PINs. The platform checks the user's JWT; the derived password needs the
// service role and PIN_PEPPER, which the app never has.
import { pinSet } from "../_shared/pin.ts";
import { json, pinPepper, readBody, serviceClient, text } from "../_shared/server.ts";
import { withSentry } from "../_shared/sentry.ts";

Deno.serve(
	withSentry("pin-set", async (request) => {
		if (request.method !== "POST") {
			return json(405, { error: "method_not_allowed" });
		}
		const jwt = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
		const client = serviceClient();
		const { data, error } = await client.auth.getUser(jwt);
		if (error !== null || data.user === null || data.user.phone === undefined) {
			return json(401, { error: "not_authenticated" });
		}
		const body = await readBody(request);
		if (body === null) {
			return json(400, { error: "validation_error" });
		}
		const result = await pinSet(
			{ id: data.user.id, phone: data.user.phone },
			text(body, "pin"),
			{
				pepper: pinPepper(),
				async setPassword(userId, password) {
					const updated = await client.auth.admin.updateUserById(userId, { password });
					if (updated.error !== null) {
						throw updated.error;
					}
				},
				async markSet(userId, phone) {
					const marked = await client.rpc("pin_mark_set", {
						p_uid: userId,
						p_phone: phone,
					});
					if (marked.error !== null) {
						throw new Error(`rpc pin_mark_set: ${marked.error.code}`);
					}
				},
			},
		);
		return json(result.status, result.body);
	}),
);
