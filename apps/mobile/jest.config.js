// eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest loads this file as CommonJS.
const expoPreset = require("jest-expo/jest-preset");

// @noble/hashes (via @paramnet/shared termsHash) ships ESM only, so Jest must transform it too.
const [nodeModulesPattern, ...otherIgnorePatterns] = expoPreset.transformIgnorePatterns;

/** @type {import('jest').Config} */
module.exports = {
	preset: "jest-expo",
	testMatch: ["<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}"],
	// Run with `pnpm --filter mobile test:integration` against a local Supabase.
	testPathIgnorePatterns: ["/node_modules/", "\\.integration\\.test\\.ts$"],
	setupFilesAfterEnv: ["<rootDir>/jest.setup.tsx"],
	transformIgnorePatterns: [
		nodeModulesPattern.replace("(?!(.pnpm|", "(?!(.pnpm|@noble|"),
		...otherIgnorePatterns,
	],
};
