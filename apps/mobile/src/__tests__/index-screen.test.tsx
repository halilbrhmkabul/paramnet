import { renderRouter, screen } from "expo-router/testing-library";

import RootLayout from "../../app/_layout";
import IndexScreen from "../../app/index";
import { tr } from "@/i18n/tr";

describe("IndexScreen", () => {
	it("renders the app name from the Turkish copy inside the root layout", async () => {
		await renderRouter({ _layout: RootLayout, index: IndexScreen });

		expect(screen.getByTestId("home.appName.text")).toHaveTextContent(tr.common.appName);
	});
});
