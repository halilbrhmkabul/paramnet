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
			"**/.next/**",
			"**/test-results/**",
			"**/playwright-report/**",
			"apps/web-confirm/next-env.d.ts",
			"**/expo-env.d.ts",
			// `pnpm db:types` çıktısı; elle düzenlenmez.
			"packages/shared/src/db.types.ts",
			"apps/mobile/ios/**",
			"apps/mobile/android/**",
			".claude/**",
			// Deno edge function entry points (npm: imports, Deno globals); their logic lives in
			// supabase/functions/_shared and is linted/tested through packages/shared.
			"supabase/functions/*/index.ts",
			"supabase/functions/_shared/server.ts",
			"supabase/functions/_shared/sentry.ts",
			"supabase/functions/_shared/smsSender.ts",
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
