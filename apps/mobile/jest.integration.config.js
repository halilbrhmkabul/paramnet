// Integration tests talk to a real local Supabase. jest-expo's setup replaces fetch with a stub, so
// these run in plain Node with the Expo Babel preset only.
/** @type {import('jest').Config} */
module.exports = {
	testEnvironment: "node",
	testMatch: ["<rootDir>/src/**/__tests__/**/*.integration.test.ts"],
	transform: { "\\.[jt]sx?$": ["babel-jest", { presets: ["babel-preset-expo"] }] },
	transformIgnorePatterns: ["/node_modules/(?!(.pnpm|@noble|@paramnet))"],
	moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
};
