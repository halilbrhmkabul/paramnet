const expoPreset = require("jest-expo/jest-preset");

// @noble/hashes (via @paramnet/shared termsHash) ships ESM only, so Jest must transform it too.
const [nodeModulesPattern, ...otherIgnorePatterns] = expoPreset.transformIgnorePatterns;

/** @type {import('jest').Config} */
module.exports = {
	preset: "jest-expo",
	testMatch: ["<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}"],
	transformIgnorePatterns: [
		nodeModulesPattern.replace("(?!(.pnpm|", "(?!(.pnpm|@noble|"),
		...otherIgnorePatterns,
	],
};
