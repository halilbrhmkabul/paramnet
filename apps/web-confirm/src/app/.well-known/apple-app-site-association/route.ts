// iOS Universal Links (deep-links.md): only /i/* opens the app. Served as JSON without redirects;
// absent until the Apple team id is known (F3-06).
export const dynamic = "force-dynamic";

export function GET(): Response {
	const team = process.env.APPLE_TEAM_ID;
	if (team === undefined || team === "") {
		return new Response(null, { status: 404 });
	}
	return Response.json({
		applinks: {
			details: [{ appIDs: [`${team}.com.paramnet.app`], components: [{ "/": "/i/*" }] }],
		},
	});
}
