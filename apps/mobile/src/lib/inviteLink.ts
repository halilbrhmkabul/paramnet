import { readConfig } from "./config";
import { tr } from "@/i18n/tr";

// https://<APP_DOMAIN>/i/<token> (deep-links.md). EXPO_PUBLIC_INVITE_BASE_URL overrides the domain for
// local development (e.g. the web-confirm dev server on the LAN). Null when nothing is configured.
export function inviteLink(token: string): string | null {
	if (readConfig().mode === "mock") {
		return tr.share.prototypeLink;
	}
	const base: unknown = process.env.EXPO_PUBLIC_INVITE_BASE_URL;
	const domain: unknown = process.env.EXPO_PUBLIC_APP_DOMAIN;
	const origin =
		typeof base === "string" && base !== ""
			? base.replace(/\/$/, "")
			: typeof domain === "string" && domain !== ""
				? `https://${domain}`
				: null;
	return origin === null ? null : `${origin}/i/${token}`;
}
