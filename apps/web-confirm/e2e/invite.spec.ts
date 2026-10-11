import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// W01–W04 end to end (F2-04). Ayşe shares in the app; the invitee (no account) answers on the web.
const url = process.env.PARAMNET_SUPABASE_URL ?? "";
const key = process.env.PARAMNET_SUPABASE_KEY ?? "";

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let signedIn: Promise<void> | null = null;

// One sign-in for the whole file: GoTrue limits how often a number may request a code.
function signInOnce(): Promise<void> {
	signedIn ??= (async () => {
		await client.auth.signInWithOtp({ phone: "+905550000001" });
		const signed = await client.auth.verifyOtp({
			phone: "+905550000001",
			token: "123456",
			type: "sms",
		});
		expect(signed.error).toBeNull();
		await client.rpc("complete_profile", {
			p_display_name: "Ayşe",
			p_kvkk_version: "2026-10",
			p_terms_version: "2026-10",
		});
	})();
	return signedIn;
}

async function sharedInvite(title: string): Promise<string> {
	await signInOnce();
	const created = await client.rpc("create_agreement", {
		input: {
			kind: "loan",
			creator_role: "creditor",
			title,
			description: null,
			started_on: null,
			counterparty: {
				contact: {
					display_name: `${title} ${String(Date.now())}`,
					phone_e164: null,
					kind: "person",
				},
			},
			terms: {
				principal_minor: 300000,
				down_payment_minor: 0,
				notes: "Elden verildi",
				plan: [
					{ seq: 1, due_date: "2030-11-10", amount_minor: 150000 },
					{ seq: 2, due_date: "2030-12-10", amount_minor: 150000 },
				],
			},
		},
		idem_key: crypto.randomUUID(),
	});
	expect(created.error).toBeNull();
	const shared = await client.rpc("share_agreement", {
		p_id: (created.data as { agreement_id: string }).agreement_id,
		p_phone: "+905550000002",
		p_row_version: 1,
	});
	expect(shared.error).toBeNull();
	return (shared.data as { token: string }).token;
}

async function verify(page: Page, token: string, phone: string): Promise<void> {
	await page.goto(`/i/${token}`);
	await page.getByTestId("phone-input").fill(phone);
	await page.getByTestId("send-code").click();
	await expect(page.getByTestId("code")).toBeVisible();
	await page.getByTestId("code-input").fill("123456");
	await page.getByTestId("verify").click();
}

test.skip(
	url === "" || key === "",
	"needs PARAMNET_SUPABASE_URL / PARAMNET_SUPABASE_KEY and a local Supabase",
);

test("W01 shows only who shared it, and the security headers", async ({ page }) => {
	const token = await sharedInvite("Başlıklar");
	const response = await page.goto(`/i/${token}`);
	await expect(page.getByTestId("open")).toContainText("Ayşe seninle bir ödeme planı paylaştı");
	// Before the number is verified: no amount, plan or note (spec 5.4).
	await expect(page.locator("body")).not.toContainText("1.500,00");
	await expect(page.locator("body")).not.toContainText("Elden");
	const headers = response?.headers() ?? {};
	expect(headers["referrer-policy"]).toBe("no-referrer");
	expect(headers["x-robots-tag"]).toContain("noindex");
	expect(headers["strict-transport-security"]).toContain("max-age=");
	expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
	expect(headers["x-frame-options"]).toBe("DENY");
});

test("link preview bots (plain GETs) do not consume the invite", async ({ page, request }) => {
	const token = await sharedInvite("Önizleme");
	for (let i = 0; i < 3; i++) {
		const bot = await request.get(`/i/${token}`, {
			headers: { "user-agent": "WhatsApp/2.23" },
		});
		expect(bot.status()).toBe(200);
	}
	await page.goto(`/i/${token}`);
	await expect(page.getByTestId("open")).toBeVisible();
});

test("a different number cannot get in", async ({ page }) => {
	const token = await sharedInvite("Yanlış numara");
	await verify(page, token, "0555 000 00 03");
	await expect(page.getByTestId("error")).toHaveText("Kod hatalı. Tekrar dener misin?");
	await expect(page.getByTestId("decision")).toHaveCount(0);
});

test("the right number sees the plan and accepts; the link is then used up", async ({ page }) => {
	const token = await sharedInvite("Onay");
	await verify(page, token, "0555 000 00 02");
	await expect(page.getByTestId("decision")).toBeVisible();
	await expect(page.getByTestId("role")).toHaveText("Borçlusun");
	await expect(page.getByTestId("total")).toHaveText("3.000,00 TL");
	await expect(page.getByTestId("plan-row-1")).toContainText("10 Kasım 2030");
	await expect(page.locator("body")).toContainText("Elden verildi");
	await page.getByTestId("accept").click();
	await expect(page.getByTestId("result")).toContainText("Teşekkürler, planı onayladın.");

	await page.context().clearCookies();
	await page.goto(`/i/${token}`);
	await expect(page.getByTestId("invalid")).toContainText("Bu bağlantı artık geçerli değil.");
});

test("counter offer keeps the total and is checked before sending", async ({ page }) => {
	const token = await sharedInvite("Düzeltme");
	await verify(page, token, "+905550000002");
	await page.getByTestId("counter").click();
	await expect(page.getByTestId("counter-form")).toBeVisible();
	await page.locator('input[name="amount.1"]').fill("1.000");
	await page.getByTestId("counter-send").click();
	await expect(page.getByTestId("error")).toHaveText(
		"Taksitlerin toplamı kalan tutara eşit olmalı.",
	);
	await page.locator('input[name="amount.1"]').fill("1.000");
	await page.locator('input[name="amount.2"]').fill("2.000");
	await page.locator('input[name="due_date.2"]').fill("2031-01-10");
	await page.getByTestId("counter-send").click();
	await expect(page.getByTestId("result")).toContainText("Önerin iletildi.");
});

test("reject", async ({ page }) => {
	const token = await sharedInvite("Red");
	await verify(page, token, "+905550000002");
	await page.getByTestId("reject").click();
	await expect(page.getByTestId("result")).toContainText("bu planın sana ait olmadığını ilettik");
});

test("an unknown link explains itself", async ({ page }) => {
	await page.goto("/i/bilinmeyen-baglanti");
	await expect(page.getByTestId("invalid")).toContainText("Bu bağlantı artık geçerli değil.");
});
