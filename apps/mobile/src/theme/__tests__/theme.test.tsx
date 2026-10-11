import { render, screen } from "@testing-library/react-native";
import * as ReactNative from "react-native";

import { AmountText } from "@/components/AmountText";
import { palette } from "@/theme/tokens";
import { themeFor } from "@/theme/useAppTheme";

describe("theme", () => {
	it("maps each scheme to its token palette", () => {
		expect(themeFor("light").colors.bg).toBe(palette.light.bg);
		expect(themeFor("dark").colors.text).toBe(palette.dark.text);
	});

	it("components follow the system dark mode", async () => {
		jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
		await render(<AmountText minor={100} testID="amount" />);
		expect(screen.getByTestId("amount")).toHaveStyle({ color: palette.dark.text });
	});
});
