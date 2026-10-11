// Android App Links (deep-links.md): the release signing certificate fingerprints, comma separated in
// ANDROID_SHA256_CERT_FINGERPRINTS; absent until the signing key exists (F3-06).
export const dynamic = "force-dynamic";

export function GET(): Response {
	const fingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS ?? "")
		.split(",")
		.map((value) => value.trim())
		.filter((value) => value !== "");
	if (fingerprints.length === 0) {
		return new Response(null, { status: 404 });
	}
	return Response.json([
		{
			relation: ["delegate_permission/common.handle_all_urls"],
			target: {
				namespace: "android_app",
				package_name: "com.paramnet.app",
				sha256_cert_fingerprints: fingerprints,
			},
		},
	]);
}
