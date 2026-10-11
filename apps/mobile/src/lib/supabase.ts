import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

import { chunkedSecureStorage } from "./secureStorage";

let client: SupabaseClient | null = null;

// Only the publishable (anon) key ever reaches the app; the service role key never does (CLAUDE.md).
export function getSupabase(url: string, key: string): SupabaseClient {
	if (client !== null) {
		return client;
	}
	client = createClient(url, key, {
		auth: {
			storage: chunkedSecureStorage,
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: false,
		},
	});
	const created = client;
	// Refresh tokens only while the app is in the foreground (Supabase React Native guidance).
	AppState.addEventListener("change", (state) => {
		if (state === "active") {
			void created.auth.startAutoRefresh();
		} else {
			void created.auth.stopAutoRefresh();
		}
	});
	return client;
}
