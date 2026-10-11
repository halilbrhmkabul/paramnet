import Script from "next/script";

// Cloudflare Turnstile against SMS pumping (spec 11.2). Without a site key (local tests) nothing is
// rendered and the function side runs with TURNSTILE_DISABLED=1.
export function Turnstile({ nonce }: { nonce: string | undefined }) {
	const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
	if (siteKey === undefined || siteKey === "") {
		return null;
	}
	return (
		<>
			<Script
				src="https://challenges.cloudflare.com/turnstile/v0/api.js"
				strategy="afterInteractive"
				nonce={nonce}
			/>
			<div className="cf-turnstile" data-sitekey={siteKey} data-language="tr" />
		</>
	);
}
