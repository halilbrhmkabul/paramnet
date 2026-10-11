import { randomUUID } from "expo-crypto";

// Hermes has no crypto.randomUUID; expo-crypto provides a v4 UUID on both platforms.
export function newIdempotencyKey(): string {
	return randomUUID();
}
