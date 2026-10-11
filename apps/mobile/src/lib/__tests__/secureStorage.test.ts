const mockStore = new Map<string, string>();

// Lazy references only: the factory runs before this module's own top-level code.
jest.mock("expo-secure-store", () => {
	return {
		getItemAsync: jest.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
		setItemAsync: jest.fn((key: string, value: string) => {
			if (value.length > 2048) {
				return Promise.reject(new Error("value too large"));
			}
			mockStore.set(key, value);
			return Promise.resolve();
		}),
		deleteItemAsync: jest.fn((key: string) => {
			mockStore.delete(key);
			return Promise.resolve();
		}),
	};
});

const store = mockStore;

// jest.setup already loaded secureStorage (via ApiProvider) with the default mock; load a fresh copy
// that sees this file's expo-secure-store mock.
let secure!: typeof import("../secureStorage");
jest.isolateModules(() => {
	secure = jest.requireActual<typeof import("../secureStorage")>("../secureStorage");
});
const { CHUNK_SIZE, chunkedSecureStorage } = secure;

beforeEach(() => {
	store.clear();
});

describe("chunkedSecureStorage", () => {
	it("round-trips a value larger than one SecureStore entry", async () => {
		const session = "x".repeat(CHUNK_SIZE * 2 + 17);
		await chunkedSecureStorage.setItem("sb-auth", session);
		expect(store.size).toBe(4);
		expect(await chunkedSecureStorage.getItem("sb-auth")).toBe(session);
	});

	it("removes stale chunks when a shorter value replaces a longer one", async () => {
		await chunkedSecureStorage.setItem("k", "a".repeat(CHUNK_SIZE * 3));
		await chunkedSecureStorage.setItem("k", "short");
		expect(await chunkedSecureStorage.getItem("k")).toBe("short");
		expect([...store.keys()].sort()).toEqual(["k.0", "k.count"]);
	});

	it("returns null for a missing or incomplete value and removes everything", async () => {
		expect(await chunkedSecureStorage.getItem("none")).toBeNull();
		await chunkedSecureStorage.setItem("k", "a".repeat(CHUNK_SIZE + 1));
		store.delete("k.1");
		expect(await chunkedSecureStorage.getItem("k")).toBeNull();
		await chunkedSecureStorage.removeItem("k");
		expect(store.size).toBe(0);
	});

	it("keeps keys valid for SecureStore", async () => {
		await chunkedSecureStorage.setItem("sb-127.0.0.1-auth-token", "v");
		for (const key of store.keys()) {
			expect(key).toMatch(/^[\w.-]+$/);
		}
	});
});
