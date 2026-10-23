// Account deletion (F3-03, ADR-039): the signed-in user's data is erased or anonymised in the database,
// then the auth user is soft-deleted so the number can no longer sign in to this account. Needs the
// service role, which the app never has; the platform checks the user's JWT before this runs.
import { json, rpcError, serviceClient } from "../_shared/server.ts";
import { withSentry } from "../_shared/sentry.ts";

Deno.serve(
	withSentry("delete-account", async (request) => {
		if (request.method !== "POST") {
			return json(405, { error: "method_not_allowed" });
		}
		const jwt = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
		const client = serviceClient();
		const { data, error } = await client.auth.getUser(jwt);
		if (error !== null || data.user === null) {
			return json(401, { error: "not_authenticated" });
		}
		const erased = await client.rpc("delete_account_data", { p_uid: data.user.id });
		if (erased.error !== null) {
			return rpcError(erased.error);
		}
		// Storage refuses SQL deletes, so the photo goes through the API: every file in the user's folder,
		// old uploads the app failed to clean up included (ADR-051).
		const avatars = client.storage.from("avatars");
		const listed = await avatars.list(data.user.id);
		if (listed.error !== null) {
			throw listed.error;
		}
		if (listed.data.length > 0) {
			const removedFiles = await avatars.remove(
				listed.data.map((file) => `${data.user.id}/${file.name}`),
			);
			if (removedFiles.error !== null) {
				throw removedFiles.error;
			}
		}
		const removed = await client.auth.admin.deleteUser(data.user.id, true);
		if (removed.error !== null) {
			throw removed.error;
		}
		return json(200, { deleted: true });
	}),
);
