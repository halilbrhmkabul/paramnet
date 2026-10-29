// Invite links are https://<APP_DOMAIN>/i/<token> (deep-links.md); the screen lives at /invite/<token>.
const INVITE =
	/^(?:https?:\/\/[^/]+)?\/i\/([A-Za-z0-9_-]+)\/?$|^paramnet:\/\/i\/([A-Za-z0-9_-]+)\/?$/;

// Split joins are https://<APP_DOMAIN>/h/<code> (F4-11, ADR-061); the screen lives at /split/join/<code>.
// "?v=qr" marks a scan of the QR code.
const SPLIT = /^(?:(?:https?:\/\/[^/]+)?\/h\/|paramnet:\/\/h\/)([A-Za-z0-9-]+)\/?(\?v=qr)?$/;

// No app link is anywhere near this long. expo-router decodes paths with a decode-uri-component that a
// crafted, oversized link can stall (GHSA-vcc3-ghjq-m6fr, no compatible fix yet); such links go home.
const MAX_PATH_LENGTH = 512;

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
	if (path.length > MAX_PATH_LENGTH) {
		return "/";
	}
	const split = SPLIT.exec(path);
	if (split?.[1] !== undefined) {
		return `/split/join/${split[1].toUpperCase()}${split[2] === undefined ? "" : "?via=qr"}`;
	}
	const match = INVITE.exec(path);
	const token = match?.[1] ?? match?.[2];
	return token === undefined ? path : `/invite/${token}`;
}
