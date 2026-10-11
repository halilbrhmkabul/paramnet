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
