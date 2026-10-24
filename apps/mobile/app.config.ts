import type { ConfigContext, ExpoConfig } from "expo/config";

import permissions from "./src/i18n/permissions.json";

// app.json plus the invite link domain (deep-links.md). Without EXPO_PUBLIC_APP_DOMAIN (not decided
// yet) the app has no Universal / App Links and invites open on the web page.
export default ({ config }: ConfigContext): ExpoConfig => {
	const raw: unknown = process.env.EXPO_PUBLIC_APP_DOMAIN;
	const domain = typeof raw === "string" && raw !== "" ? raw : null;
	const base = {
		...config,
		name: config.name ?? "Paramnet",
		slug: config.slug ?? "paramnet",
		// The permission text is Turkish copy too (src/i18n, shared with tr.ts).
		plugins: [
			...(config.plugins ?? []),
			["expo-contacts", { contactsPermission: permissions.contacts }],
			[
				"expo-image-picker",
				{
					cameraPermission: permissions.camera,
					photosPermission: permissions.photos,
					microphonePermission: false,
				},
			],
		] satisfies ExpoConfig["plugins"],
	};
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
