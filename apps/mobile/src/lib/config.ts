// EXPO_PUBLIC_* values are inlined at build time; see apps/mobile/.env.example.
export type ApiMode = "mock" | "supabase";

export type AppConfig =
	{ mode: "mock" } | { mode: "supabase"; supabaseUrl: string; supabaseKey: string };

export function readConfig(env: Record<string, string | undefined> = process.env): AppConfig {
	if (env.EXPO_PUBLIC_API_MODE !== "supabase") {
		return { mode: "mock" };
	}
	const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL ?? "";
	const supabaseKey = env.EXPO_PUBLIC_SUPABASE_KEY ?? "";
	if (supabaseUrl === "" || supabaseKey === "") {
		throw new Error(
			"EXPO_PUBLIC_API_MODE=supabase needs EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY",
		);
	}
	return { mode: "supabase", supabaseUrl, supabaseKey };
}

// Menü > "Yardım ve destek" writes to this address; without it the row is hidden (no address decided yet).
export function supportEmail(env?: Record<string, string | undefined>): string | null {
	// The full member expression: only that form is inlined into release bundles.
	const raw: unknown =
		env === undefined ? process.env.EXPO_PUBLIC_SUPPORT_EMAIL : env.EXPO_PUBLIC_SUPPORT_EMAIL;
	const value = typeof raw === "string" ? raw.trim() : "";
	return value === "" ? null : value;
}
