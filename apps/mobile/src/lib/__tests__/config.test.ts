import { readConfig } from "../config";

describe("readConfig", () => {
	it("defaults to the mock adapters", () => {
		expect(readConfig({})).toEqual({ mode: "mock" });
		expect(readConfig({ EXPO_PUBLIC_API_MODE: "other" })).toEqual({ mode: "mock" });
	});

	it("reads the Supabase URL and publishable key", () => {
		expect(
			readConfig({
				EXPO_PUBLIC_API_MODE: "supabase",
				EXPO_PUBLIC_SUPABASE_URL: "http://192.168.1.10:54321",
				EXPO_PUBLIC_SUPABASE_KEY: "sb_publishable_x",
			}),
		).toEqual({
			mode: "supabase",
			supabaseUrl: "http://192.168.1.10:54321",
			supabaseKey: "sb_publishable_x",
		});
	});

	it("fails loudly when Supabase mode lacks its settings", () => {
		expect(() => readConfig({ EXPO_PUBLIC_API_MODE: "supabase" })).toThrow(
			/EXPO_PUBLIC_SUPABASE_URL/,
		);
	});
});
