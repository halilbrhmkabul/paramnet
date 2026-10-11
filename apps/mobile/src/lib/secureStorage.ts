import * as SecureStore from "expo-secure-store";

// SecureStore warns above 2048 bytes per value and a Supabase session is about that size, so values
// are split into chunks (key.count + key.0..n). Keys may only contain [A-Za-z0-9._-].
export const CHUNK_SIZE = 1800;

function safe(key: string): string {
	return key.replace(/[^\w.-]/g, "_");
}

async function chunkCount(key: string): Promise<number> {
	const raw = await SecureStore.getItemAsync(`${key}.count`);
	const count = raw === null ? 0 : Number(raw);
	return Number.isSafeInteger(count) && count > 0 ? count : 0;
}

async function remove(key: string): Promise<void> {
	const count = await chunkCount(key);
	await Promise.all(
		Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${String(i)}`)),
	);
	await SecureStore.deleteItemAsync(`${key}.count`);
}

export const chunkedSecureStorage = {
	async getItem(name: string): Promise<string | null> {
		const key = safe(name);
		const count = await chunkCount(key);
		if (count === 0) {
			return null;
		}
		const parts = await Promise.all(
			Array.from({ length: count }, (_, i) =>
				SecureStore.getItemAsync(`${key}.${String(i)}`),
			),
		);
		// A missing chunk means a write was interrupted; treat it as signed out rather than corrupt JSON.
		return parts.some((part) => part === null) ? null : parts.join("");
	},

	async setItem(name: string, value: string): Promise<void> {
		const key = safe(name);
		await remove(key);
		const count = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
		for (let i = 0; i < count; i++) {
			await SecureStore.setItemAsync(
				`${key}.${String(i)}`,
				value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
			);
		}
		await SecureStore.setItemAsync(`${key}.count`, String(count));
	},

	async removeItem(name: string): Promise<void> {
		await remove(safe(name));
	},
};
