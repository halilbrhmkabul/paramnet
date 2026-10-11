import expoConfig from "eslint-config-expo/flat.js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: [
			"**/node_modules/**",
			"**/dist/**",
			"**/coverage/**",
			"**/.expo/**",
			"**/expo-env.d.ts",
			// `pnpm db:types` çıktısı; elle düzenlenmez.
			"packages/shared/src/db.types.ts",
			"apps/mobile/ios/**",
			"apps/mobile/android/**",
			".claude/**",
			"docs/**",
		],
	},
	{
		files: ["apps/mobile/**/*.{js,jsx,ts,tsx}"],
		extends: [expoConfig],
		settings: {
			"import/resolver": {
				typescript: { project: "apps/mobile/tsconfig.json" },
			},
		},
	},
	{
		files: ["**/*.{ts,tsx}"],
		extends: [tseslint.configs.strictTypeChecked],
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			"@typescript-eslint/no-explicit-any": "error",
		},
	},
	{
		files: ["**/*.{js,cjs,mjs}"],
		languageOptions: {
			globals: globals.node,
		},
	},
	prettier,
);
