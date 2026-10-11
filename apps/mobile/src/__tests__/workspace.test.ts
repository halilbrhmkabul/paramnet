import { APP_TIME_ZONE, DEFAULT_CURRENCY } from "@paramnet/shared";

// Guards the monorepo wiring: the mobile toolchain must resolve the shared package from source.
describe("@paramnet/shared resolution", () => {
	it("imports shared constants", () => {
		expect(DEFAULT_CURRENCY).toBe("TRY");
		expect(APP_TIME_ZONE).toBe("Europe/Istanbul");
	});
});
