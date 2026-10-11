import type { NextConfig } from "next";

// spec 11.2 "Tarayıcı kaynaklı sızıntı": HTTPS + HSTS, no referrer, not indexed, not framed.
const securityHeaders = [
	{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
	{ key: "Referrer-Policy", value: "no-referrer" },
	{ key: "X-Robots-Tag", value: "noindex, nofollow" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
	{ key: "Cache-Control", value: "no-store" },
];

const config: NextConfig = {
	poweredByHeader: false,
	reactStrictMode: true,
	// @paramnet/shared is a TypeScript source package (ADR-007).
	transpilePackages: ["@paramnet/shared"],
	headers: () => Promise.resolve([{ source: "/:path*", headers: securityHeaders }]),
};

export default config;
