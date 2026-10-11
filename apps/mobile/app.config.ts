import type { ConfigContext, ExpoConfig } from "expo/config";

// app.json plus the invite link domain (deep-links.md). Without EXPO_PUBLIC_APP_DOMAIN (not decided
// yet) the app has no Universal / App Links and invites open on the web page.
export default ({ config }: ConfigContext): ExpoConfig => {
	const raw: unknown = process.env.EXPO_PUBLIC_APP_DOMAIN;
	const domain = typeof raw === "string" && raw !== "" ? raw : null;
	const base = { ...config, name: config.name ?? "Paramnet", slug: config.slug ?? "paramnet" };
	if (domain === null) {
		return base;
	}
	return {
		...base,
		ios: { ...base.ios, associatedDomains: [`applinks:${domain}`] },
		android: {
			...base.android,
			intentFilters: [
				{
					action: "VIEW",
					autoVerify: true,
					data: [{ scheme: "https", host: domain, pathPrefix: "/i/" }],
					category: ["BROWSABLE", "DEFAULT"],
				},
			],
		},
	};
};
