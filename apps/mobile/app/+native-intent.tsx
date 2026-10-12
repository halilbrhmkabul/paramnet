// Invite links are https://<APP_DOMAIN>/i/<token> (deep-links.md); the screen lives at /invite/<token>.
const INVITE =
	/^(?:https?:\/\/[^/]+)?\/i\/([A-Za-z0-9_-]+)\/?$|^paramnet:\/\/i\/([A-Za-z0-9_-]+)\/?$/;

// No app link is anywhere near this long. expo-router decodes paths with a decode-uri-component that a
// crafted, oversized link can stall (GHSA-vcc3-ghjq-m6fr, no compatible fix yet); such links go home.
const MAX_PATH_LENGTH = 512;

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
	if (path.length > MAX_PATH_LENGTH) {
		return "/";
	}
	const match = INVITE.exec(path);
	const token = match?.[1] ?? match?.[2];
	return token === undefined ? path : `/invite/${token}`;
}
