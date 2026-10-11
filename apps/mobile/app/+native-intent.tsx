// Invite links are https://<APP_DOMAIN>/i/<token> (deep-links.md); the screen lives at /invite/<token>.
const INVITE =
	/^(?:https?:\/\/[^/]+)?\/i\/([A-Za-z0-9_-]+)\/?$|^paramnet:\/\/i\/([A-Za-z0-9_-]+)\/?$/;

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
	const match = INVITE.exec(path);
	const token = match?.[1] ?? match?.[2];
	return token === undefined ? path : `/invite/${token}`;
}
