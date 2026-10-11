// W01: who shared the plan, nothing more (spec 5.4). GET only and free of side effects, so link
// preview bots that fetch the URL cannot consume or change an invite (spec 11.2).
import { json, rpcError, serviceClient } from "../_shared/server.ts";

Deno.serve(async (request) => {
	if (request.method !== "GET") {
		return json(405, { error: "method_not_allowed" });
	}
	const token = new URL(request.url).searchParams.get("token") ?? "";
	const { data, error } = await serviceClient().rpc("invite_open", { p_token: token });
	return error ? rpcError(error) : json(200, data);
});
