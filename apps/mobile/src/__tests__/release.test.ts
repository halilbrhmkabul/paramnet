import type { ExpoConfig } from "expo/config";

import appConfig from "../../app.config";
import appJsonFile from "../../app.json";
import easJson from "../../eas.json";
import { tr } from "@/i18n/tr";

// Store builds (F3-06): what Apple/Google read from the native config, and the EAS profiles.
const appJson = appJsonFile as unknown as { expo: ExpoConfig };
const eas = easJson as unknown as {
	cli: { appVersionSource: string };
	build: Record<string, Record<string, unknown>>;
	submit: { production: { android: { track: string } } };
};

function resolve(): ExpoConfig {
	return appConfig({
		config: appJson.expo,
		projectRoot: "",
		staticConfigPath: null,
		packageJsonPath: null,
	});
}

describe("store release configuration (F3-06)", () => {
	it("explains the contacts permission in Turkish and never asks to write contacts", () => {
		const config = resolve();
		expect(config.plugins).toContainEqual([
			"expo-contacts",
			{ contactsPermission: tr.permissions.contacts },
		]);
		expect(config.android?.blockedPermissions).toContain("android.permission.WRITE_CONTACTS");
	});

	it("declares no non-exempt encryption, so TestFlight does not ask on every build", () => {
		expect(resolve().ios?.config?.usesNonExemptEncryption).toBe(false);
	});

	it("can make development builds (remote push on Android needs one)", () => {
		expect(resolve().plugins).toContain("expo-dev-client");
	});

	it("has development, preview and production profiles with their own EAS environments", () => {
		expect(eas.cli.appVersionSource).toBe("remote");
		expect(eas.build.development).toMatchObject({
			developmentClient: true,
			distribution: "internal",
			environment: "development",
		});
		expect(eas.build.preview).toMatchObject({
			distribution: "internal",
			environment: "preview",
		});
		expect(eas.build.production).toMatchObject({
			autoIncrement: true,
			environment: "production",
		});
	});

	it("sends Android builds to the closed testing track", () => {
		expect(eas.submit.production.android.track).toBe("alpha");
	});

	it("keeps secrets out of eas.json (they live in EAS environment variables)", () => {
		expect(JSON.stringify(eas)).not.toMatch(/sb_secret|service_role|whsec_|SENTRY_AUTH_TOKEN/);
	});
});
