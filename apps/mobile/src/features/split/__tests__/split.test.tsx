import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { MOCK_INVITE_CODE } from "@/api/splits/mockSplits";
import { tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { signInForTest } from "@/testing/session";

beforeEach(() => {
	signInForTest();
});

describe("Hesabı böl (40, 41)", () => {
	it("splits a bill equally and opens the QR code", async () => {
		await renderRouter(appRoutes, { initialUrl: "/add" });
		await fireEvent.press(screen.getByTestId("action.split"));
		await waitFor(() => {
			expect(screen.getByTestId("split.create.screen")).toBeTruthy();
		});

		await fireEvent.press(screen.getByTestId("split.create.button"));
		expect(screen.getByTestId("split.error")).toHaveTextContent(tr.split.needTitle);
		await fireEvent.changeText(screen.getByTestId("split.title.input"), "Akşam yemeği");
		await fireEvent.changeText(screen.getByTestId("split.amount.input"), "3600");
		await fireEvent.press(screen.getByTestId("split.create.button"));
		expect(screen.getByTestId("split.error")).toHaveTextContent(tr.split.needPeople);

		// A seat for the link, and a ParamNet user.
		await fireEvent.press(screen.getByTestId("split.add.link"));
		await fireEvent.changeText(screen.getByTestId("split.name.input"), "Can");
		await fireEvent.press(screen.getByTestId("split.name.add"));
		await fireEvent.press(screen.getByTestId("split.add.id"));
		await fireEvent.changeText(screen.getByTestId("split.id.input"), "pn-ek4x8r");
		await waitFor(() => {
			expect(screen.getByTestId("split.id.found")).toHaveTextContent("Emre Kılıç", {
				exact: false,
			});
		});
		await fireEvent.press(screen.getByTestId("split.id.add"));

		expect(screen.getByTestId("split.share.me")).toHaveTextContent("1.200,00 TL");
		expect(screen.getByTestId("split.share.Can")).toHaveTextContent("1.200,00 TL");
		expect(screen.getByTestId("split.receivable")).toHaveTextContent("2.400,00 TL");

		// Amounts that do not add up stop the split.
		await fireEvent.press(screen.getByTestId("split.mode.amount"));
		await fireEvent.changeText(screen.getByTestId("split.share.me.input"), "1000");
		expect(screen.getByTestId("split.note")).toHaveTextContent("fark var", { exact: false });
		await fireEvent.press(screen.getByTestId("split.create.button"));
		expect(screen.getByTestId("split.error")).toHaveTextContent(tr.split.needShares);
		await fireEvent.press(screen.getByTestId("split.mode.equal"));

		await fireEvent.press(screen.getByTestId("split.create.button"));
		await waitFor(() => {
			expect(screen.getByTestId("splitInvite.qr")).toBeTruthy();
		});
		expect(screen.getByTestId("splitInvite.count")).toHaveTextContent("2 / 3 kişi");
		await fireEvent.press(screen.getByTestId("splitInvite.tab.link"));
		expect(screen.getByTestId("splitInvite.link")).toHaveTextContent("split/join/", {
			exact: false,
		});
	});

	it("the payer approves a link join", async () => {
		await renderRouter(appRoutes, { initialUrl: "/split/split-dinner/invite" });
		await waitFor(() => {
			expect(screen.getByTestId("splitInvite.approve.sm-can")).toBeTruthy();
		});
		expect(screen.getByTestId("split.member.sm-can.badge")).toHaveTextContent(
			tr.split.badges.requested,
		);
		await fireEvent.press(screen.getByTestId("splitInvite.approve.sm-can"));
		await waitFor(() => {
			expect(screen.getByTestId("split.member.sm-can.badge")).toHaveTextContent(
				tr.split.badges.invited,
			);
		});
		expect(screen.queryByTestId("splitInvite.approve.sm-can")).toBeNull();
	});
});

describe("Ortak hesap (42)", () => {
	it("confirms a reported payment and the collected amount grows", async () => {
		await renderRouter(appRoutes, { initialUrl: "/split/split-dinner" });
		await waitFor(() => {
			expect(screen.getByTestId("split.collected")).toHaveTextContent(
				"1.800,00 TL / 3.600,00 TL",
			);
		});
		expect(screen.getByTestId("split.member.sm-mehmet.badge")).toHaveTextContent(
			tr.split.badges.reported,
		);
		expect(screen.getByText(tr.split.privacy)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("split.confirm.sm-mehmet"));
		await waitFor(() => {
			expect(screen.getByTestId("split.collected")).toHaveTextContent(
				"2.700,00 TL / 3.600,00 TL",
			);
		});
		expect(screen.getByTestId("split.member.sm-mehmet.badge")).toHaveTextContent(
			tr.split.badges.paid,
		);
		expect(screen.getByTestId("split.activity")).toHaveTextContent(
			"Mehmet Yılmaz ödemesi onaylandı",
			{ exact: false },
		);
	});
});

describe("Davet edilen kişinin ekranı (43)", () => {
	it("joins by link, accepts the share and reports the payment", async () => {
		await renderRouter(appRoutes, { initialUrl: `/split/join/${MOCK_INVITE_CODE}` });
		await waitFor(() => {
			expect(screen.getByTestId("splitJoin.banner")).toHaveTextContent(MOCK_INVITE_CODE, {
				exact: false,
			});
		});
		expect(screen.getByText("Piknik alışverişi")).toBeTruthy();
		await fireEvent.press(screen.getByTestId("splitJoin.join"));

		await waitFor(() => {
			expect(screen.getByTestId("split.hero")).toHaveTextContent(
				tr.split.hero.invited.kicker,
				{ exact: false },
			);
		});
		expect(screen.getByTestId("split.hero.amount")).toHaveTextContent("600,00 TL");
		await fireEvent.press(screen.getByTestId("split.accept"));
		await waitFor(() => {
			expect(screen.getByTestId("split.hero")).toHaveTextContent(
				tr.split.hero.accepted.kicker,
				{ exact: false },
			);
		});
		await fireEvent.press(screen.getByTestId("split.report"));
		await waitFor(() => {
			expect(screen.getByTestId("split.hero")).toHaveTextContent(
				tr.split.hero.reported.kicker,
				{ exact: false },
			);
		});
	});

	it("an unknown code says so", async () => {
		await renderRouter(appRoutes, { initialUrl: "/split/join/XXX-0000" });
		await waitFor(() => {
			expect(screen.getByText(tr.split.notFound)).toBeTruthy();
		});
	});
});
