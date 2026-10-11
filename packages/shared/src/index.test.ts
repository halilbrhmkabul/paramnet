import { describe, expect, it } from "vitest";

import { APP_TIME_ZONE, DEFAULT_CURRENCY } from "./index";

describe("@paramnet/shared", () => {
	it("exposes the first-release currency (BR-02)", () => {
		expect(DEFAULT_CURRENCY).toBe("TRY");
	});

	it("exposes the business time zone (BR-16)", () => {
		expect(APP_TIME_ZONE).toBe("Europe/Istanbul");
	});
});
