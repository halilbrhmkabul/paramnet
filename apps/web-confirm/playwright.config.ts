import { defineConfig, devices } from "@playwright/test";

// Runs the production build against a local Supabase with the invite functions served
// (`pnpm supabase functions serve --env-file supabase/functions/.env.example`).
const supabaseUrl = process.env.PARAMNET_SUPABASE_URL ?? "http://127.0.0.1:54321";

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: false,
	workers: 1,
	timeout: 60_000,
	use: { baseURL: "http://127.0.0.1:3100", ...devices["Pixel 7"] },
	webServer: {
		command: "pnpm build && pnpm start",
		url: "http://127.0.0.1:3100/i/health-check",
		reuseExistingServer: !process.env.CI,
		timeout: 180_000,
		env: {
			FUNCTIONS_URL: `${supabaseUrl}/functions/v1`,
			SUPABASE_PUBLISHABLE_KEY: process.env.PARAMNET_SUPABASE_KEY ?? "",
			NEXT_TELEMETRY_DISABLED: "1",
		},
	},
});
