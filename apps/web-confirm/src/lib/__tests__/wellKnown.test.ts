import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as aasa } from "../../app/.well-known/apple-app-site-association/route";
import { GET as assetlinks } from "../../app/.well-known/assetlinks.json/route";

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("apple-app-site-association", () => {
	it("opens only /i/* links in the app, as JSON without redirects", async () => {
		vi.stubEnv("APPLE_TEAM_ID", "ABCDE12345");
		const response = aasa();
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/json");
		expect(await response.json()).toEqual({
			applinks: {
				details: [
					{ appIDs: ["ABCDE12345.com.paramnet.app"], components: [{ "/": "/i/*" }] },
				],
			},
		});
	});

	it("is absent until the team id is configured", () => {
		vi.stubEnv("APPLE_TEAM_ID", "");
		expect(aasa().status).toBe(404);
	});
});

describe("assetlinks.json", () => {
	it("lists the release signing fingerprints", async () => {
		vi.stubEnv("ANDROID_SHA256_CERT_FINGERPRINTS", "AA:BB, CC:DD");
		const response = assetlinks();
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual([
			{
				relation: ["delegate_permission/common.handle_all_urls"],
				target: {
					namespace: "android_app",
					package_name: "com.paramnet.app",
					sha256_cert_fingerprints: ["AA:BB", "CC:DD"],
				},
			},
		]);
	});

	it("is absent until a fingerprint is configured", () => {
		vi.stubEnv("ANDROID_SHA256_CERT_FINGERPRINTS", "");
		expect(assetlinks().status).toBe(404);
	});
});
