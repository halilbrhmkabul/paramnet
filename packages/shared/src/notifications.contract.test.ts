import fc from "fast-check";
import { describe, expect, it } from "vitest";

// The edge function's pure logic lives under supabase/functions/_shared (Deno cannot import this
// package); this test pins it to the same copy and money format as the app.
import {
	buildMessages,
	formatTRY as edgeFormatTRY,
	interpretTickets,
	render,
	type ClaimedNotification,
} from "../../../supabase/functions/_shared/notifications";
import { formatTRY } from "./money";

const payload = {
	agreement_id: "a1",
	name: "Yıldız Mobilya",
	amount_minor: 400000,
	due_date: "2026-11-10",
	seq: 2,
	count: 5,
};

describe("render (copy-tr.md notif.*)", () => {
	it.each([
		["dueSoon", "10 Kasım tarihinde Yıldız Mobilya için 4.000,00 TL ödemen var."],
		["dueToday", "Bugün ödeme günü: 4.000,00 TL (2/5. taksit)."],
		["overdue1", "Dünkü 4.000,00 TL ödeme henüz kaydedilmedi. Ödediysen kaydet."],
		["overdue7", "2. taksit 7 gündür açık görünüyor."],
	])("%s", (template, body) => {
		expect(render(template, payload)).toEqual({ title: "Yıldız Mobilya", body });
	});

	it("splitReminder names the bill", () => {
		expect(
			render("splitReminder", { ...payload, name: "Akşam yemeği", amount_minor: 90000 }),
		).toEqual({
			title: "Akşam yemeği",
			body: "Ortak hesapta 900,00 TL payın açık görünüyor. Ödediysen bildir.",
		});
	});

	it("single-installment plans do not say 1/1", () => {
		expect(render("dueToday", { ...payload, seq: 1, count: 1 })?.body).toBe(
			"Bugün ödeme günü: 4.000,00 TL.",
		);
		expect(render("overdue7", { ...payload, seq: 1, count: 1 })?.body).toBe(
			"Ödeme 7 gündür açık görünüyor.",
		);
	});

	it.each([
		["paymentReported", "Bora 1.000,00 TL ödeme yaptığını bildirdi. Aldın mı?"],
		["paymentConfirmed", "Bora 1.000,00 TL ödemeni onayladı. Kalan: 2.000,00 TL."],
		["paymentRecorded", "Bora 1.000,00 TL ödemeni kaydetti. Kalan: 2.000,00 TL."],
		[
			"paymentRejected",
			"Bora 1.000,00 TL ödemeyi almadığını belirtti. Bir sorun varsa birlikte bakabilirsiniz.",
		],
	])("%s (F2-07)", (template, body) => {
		expect(
			render(template, {
				agreement_id: "a1",
				name: "Bora",
				amount_minor: 100000,
				remaining_minor: 200000,
			}),
		).toEqual({
			title: "Paramnet",
			body,
		});
	});

	it.each([
		["amendmentProposed", "Bora planda bir değişiklik önerdi. Göz atar mısın?"],
		["amendmentAccepted", "Bora değişiklik önerini kabul etti. Yeni plan geçerli."],
		["amendmentRejected", "Bora değişiklik önerini kabul etmedi. Mevcut plan geçerli."],
	])("%s (F2-08)", (template, body) => {
		expect(render(template, { agreement_id: "a1", name: "Bora", amount_minor: 0 })).toEqual({
			title: "Paramnet",
			body,
		});
	});

	it.each([
		["disputeOpened", "Bora bu anlaşmaya itiraz etti. Gerekçesine göz atabilirsin."],
		["disputeResolved", "Bora itirazını geri çekti. Anlaşma yeniden yürürlükte."],
		["cancelRequested", "Bora anlaşmayı birlikte iptal etmek istiyor. Göz atar mısın?"],
		["cancelAccepted", "Bora iptal talebini kabul etti. Anlaşma iptal edildi."],
		["cancelRejected", "Bora iptal talebini kabul etmedi. Anlaşma sürüyor."],
	])("%s (F2-09)", (template, body) => {
		expect(render(template, { agreement_id: "a1", name: "Bora", amount_minor: 0 })).toEqual({
			title: "Paramnet",
			body,
		});
	});

	it("forgiven tells the debtor the discount and what is left (F2-09)", () => {
		expect(
			render("forgiven", {
				agreement_id: "a1",
				name: "Ayşe",
				amount_minor: 50000,
				remaining_minor: 150000,
			}),
		).toEqual({
			title: "Paramnet",
			body: "Ayşe borcundan 500,00 TL indirdi. Kalan: 1.500,00 TL.",
		});
		expect(
			render("forgiven", {
				agreement_id: "a1",
				name: "Ayşe",
				amount_minor: 50000,
				remaining_minor: 0,
			}),
		).toEqual({
			title: "Paramnet",
			body: "Ayşe kalan 500,00 TL borcunu sildi. Anlaşma kapandı.",
		});
	});

	it.each([
		[
			"shareReceived",
			"Ayşe seninle 1.000,00 TL tutarında bir ödeme planı paylaştı. Göz atar mısın?",
		],
		["shareAccepted", "Ayşe ödeme planını onayladı."],
		["shareCountered", "Ayşe planda bir düzeltme önerdi."],
		["shareRejected", "Ayşe bu planın kendisine ait olmadığını belirtti."],
		["counterAccepted", "Ayşe düzeltmeni kabul etti. Plan yürürlükte."],
		["shareWithdrawn", "Ayşe paylaştığı planı geri çekti."],
		[
			"inviteExpired",
			"Ayşe için paylaştığın bağlantının süresi doldu. İstersen yeniden paylaşabilirsin.",
		],
		["settled", "Ayşe ile planınız tamamlandı."],
		["paymentPending", "Ayşe 1.000,00 TL ödeme bildirdi. Onaylıyor musun?"],
	])("%s (F2-11)", (template, body) => {
		expect(
			render(template, { agreement_id: "a1", name: "Ayşe", amount_minor: 100000 }),
		).toEqual({
			title: "Paramnet",
			body,
		});
	});

	// Every template the database queues (supabase/migrations: notify(...) and the reminder jobs).
	it.each([
		"dueSoon",
		"dueToday",
		"overdue1",
		"overdue7",
		"paymentReported",
		"paymentConfirmed",
		"paymentRecorded",
		"paymentRejected",
		"paymentPending",
		"amendmentProposed",
		"amendmentAccepted",
		"amendmentRejected",
		"disputeOpened",
		"disputeResolved",
		"cancelRequested",
		"cancelAccepted",
		"cancelRejected",
		"forgiven",
		"shareReceived",
		"shareAccepted",
		"shareCountered",
		"shareRejected",
		"counterAccepted",
		"shareWithdrawn",
		"inviteExpired",
		"settled",
	])("%s has a text", (template) => {
		expect(render(template, { ...payload, name: "Bora" })).not.toBeNull();
	});

	it("unknown templates render nothing", () => {
		expect(render("nope", payload)).toBeNull();
	});

	it("formats money exactly like the app", () => {
		fc.assert(
			fc.property(fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }), (minor) => {
				expect(edgeFormatTRY(minor)).toBe(formatTRY(minor));
			}),
		);
	});
});

describe("buildMessages / interpretTickets", () => {
	const rows: ClaimedNotification[] = [
		{
			id: 1,
			template: "dueToday",
			payload,
			attempts: 1,
			tokens: ["ExponentPushToken[a]", "ExponentPushToken[b]"],
		},
		{ id: 2, template: "overdue1", payload, attempts: 1, tokens: [] },
		{ id: 3, template: "dueSoon", payload, attempts: 2, tokens: ["ExponentPushToken[c]"] },
		{ id: 4, template: "nope", payload, attempts: 1, tokens: ["ExponentPushToken[d]"] },
	];

	it("one message per token, carrying the agreement and template for the deep link", () => {
		const { messages, owners } = buildMessages(rows);
		expect(messages).toHaveLength(3);
		expect(messages[0]).toEqual({
			to: "ExponentPushToken[a]",
			title: "Yıldız Mobilya",
			body: "Bugün ödeme günü: 4.000,00 TL (2/5. taksit).",
			data: { agreement_id: "a1", template: "dueToday" },
			sound: "default",
		});
		expect(owners).toEqual([1, 1, 3]);
	});

	it("maps tickets to row results", () => {
		const { owners } = buildMessages(rows);
		const results = interpretTickets(rows, owners, [
			{ status: "ok" },
			{ status: "error", details: { error: "DeviceNotRegistered" } },
			{ status: "error", details: { error: "MessageRateExceeded" } },
		]);
		expect(results).toEqual([
			{ id: 1, status: "sent", invalid_tokens: ["ExponentPushToken[b]"] },
			// Nobody to notify: done, not retried.
			{ id: 2, status: "sent", invalid_tokens: [] },
			{ id: 3, status: "retry", invalid_tokens: [] },
			// A template this function does not know is a bug; retrying would not help.
			{ id: 4, status: "failed", invalid_tokens: [] },
		]);
	});

	it("a missing ticket (request failed) means retry", () => {
		const { owners } = buildMessages(rows.slice(0, 1));
		expect(interpretTickets(rows.slice(0, 1), owners, [])).toEqual([
			{ id: 1, status: "retry", invalid_tokens: [] },
		]);
	});
});
