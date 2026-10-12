import storeConfig from "../../store.config.json";
import play from "../../store/play-listing.json";

// F3-07: store texts within the stores' limits, and nothing the product must not claim (spec 12).
const apple = storeConfig.apple.info["tr-TR"];

describe("App Store listing (EAS Metadata)", () => {
	it("fits Apple's limits", () => {
		expect(apple.title.length).toBeLessThanOrEqual(30);
		expect(apple.subtitle.length).toBeLessThanOrEqual(30);
		expect(apple.promoText.length).toBeLessThanOrEqual(170);
		expect(apple.description.length).toBeLessThanOrEqual(4000);
		expect(apple.keywords.join(",").length).toBeLessThanOrEqual(100);
	});

	it("keywords do not repeat words from the title (Apple counts each word once)", () => {
		const titleWords = apple.title.toLocaleLowerCase("tr-TR").split(/[\s:]+/);
		for (const keyword of apple.keywords) {
			expect(titleWords).not.toContain(keyword.toLocaleLowerCase("tr-TR"));
		}
	});

	it("is a finance app with no objectionable content", () => {
		expect(storeConfig.apple.categories[0]).toBe("FINANCE");
		expect(
			Object.values(storeConfig.apple.advisory).every((v) => v === "NONE" || v === false),
		).toBe(true);
	});
});

describe("Google Play listing", () => {
	it("fits Play's limits", () => {
		expect(play.title.length).toBeLessThanOrEqual(30);
		expect(play.shortDescription.length).toBeLessThanOrEqual(80);
		expect(play.fullDescription.length).toBeLessThanOrEqual(4000);
	});
});

describe("product boundaries in the copy (spec 12)", () => {
	const all = [
		apple.title,
		apple.subtitle,
		apple.promoText,
		apple.description,
		play.shortDescription,
		play.fullDescription,
	]
		.join("\n")
		.toLocaleLowerCase("tr-TR");

	it.each(["faiz hesaplar", "resmi belge", "e-senet", "kredi ver", "para transferi yap"])(
		"never claims %s",
		(claim) => {
			expect(all).not.toContain(claim);
		},
	);

	it("says the app does not move money", () => {
		expect(all).toContain("para tutmaz");
	});
});
