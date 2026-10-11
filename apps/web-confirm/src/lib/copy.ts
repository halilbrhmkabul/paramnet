// Web confirmation texts (copy-tr.md tone: help both sides, never accuse; "sen" form).
export const copy = {
	appName: "Paramnet",
	title: "{name} seninle bir ödeme planı paylaştı",
	intro: "Planın ayrıntılarını görmek için telefon numaranı doğrula.",
	phoneLabel: "Telefon numaran",
	phonePlaceholder: "5XX XXX XX XX",
	sendCode: "Kod gönder",
	safety: "Bu sayfa senden şifre veya kart bilgisi istemez.",
	codeTitle: "Kodu gir",
	codeHelper: "{phone} numarasına gönderdiğimiz 6 haneli kodu yaz.",
	codeLabel: "Doğrulama kodu",
	verify: "Doğrula",
	changeNumber: "Numarayı değiştir",
	youOwe: "Borçlusun",
	owesYou: "Sana borçlu",
	total: "Toplam",
	downPayment: "Peşinat",
	remaining: "Kalan",
	plan: "Ödeme planı",
	notes: "Not",
	noDueDate: "Vadesiz",
	installment: "{seq}. taksit",
	earlierPayments: "Daha önce kaydedilen ödemeler",
	earlierPaymentsNote: "Bunları paylaşan kişi kaydetti; senin onayınla plana dahil olur.",
	accept: "Onaylıyorum",
	counter: "Düzeltme öner",
	reject: "Bu plan bana ait değil",
	counterTitle: "Düzeltme öner",
	counterHelper: "Tarihleri ve tutarları değiştirebilirsin; toplam aynı kalmalı.",
	counterSend: "Öneriyi gönder",
	cancel: "Vazgeç",
	dueDate: "Tarih",
	amount: "Tutar",
	acceptedTitle: "Teşekkürler, planı onayladın.",
	counteredTitle: "Önerin iletildi.",
	rejectedTitle: "Tamam, bu planın sana ait olmadığını ilettik.",
	appCta: "Ödeme günlerinde hatırlatma almak için uygulamayı indir.",
	appStore: "App Store",
	playStore: "Google Play",
	invalidTitle: "Bu bağlantı artık geçerli değil.",
	invalidBody: "Planı paylaşan kişiden yeni bir bağlantı isteyebilirsin.",
	lockedBody: "Çok fazla hatalı deneme yapıldı; bu bağlantı kilitlendi.",
	errors: {
		otp_invalid: "Kod hatalı. Tekrar dener misin?",
		locked: "Çok fazla hatalı deneme yapıldı. Planı paylaşan kişiden yeni bir bağlantı iste.",
		rate_limited: "Biraz bekleyip tekrar dener misin?",
		invalid_phone: "Bu bir Türkiye cep numarası gibi görünmüyor.",
		sms_unavailable: "Şu an kod gönderemiyoruz. Biraz sonra tekrar dener misin?",
		turnstile_failed:
			"Güvenlik doğrulaması tamamlanamadı. Sayfayı yenileyip tekrar dener misin?",
		session_expired: "Doğrulamanın süresi doldu. Numaranı yeniden doğrular mısın?",
		conflict: "Plan bu arada değişti. Güncel hâline bak.",
		invite_unavailable: "Bu bağlantı artık geçerli değil.",
		csrf: "Sayfanın süresi doldu. Yenileyip tekrar dener misin?",
		sum_mismatch: "Taksitlerin toplamı kalan tutara eşit olmalı.",
		dates_not_ascending: "Tarihler sırayla ilerlemeli.",
		due_date_required: "Her taksit için bir tarih seç.",
		invalid_amount: "Tutarları 1.000,00 biçiminde yazar mısın?",
		non_positive_installment: "Her taksit 0'dan büyük olmalı.",
		generic: "Bir sorun çıktı, tekrar dener misin?",
	},
} as const;

export type ErrorCode = keyof typeof copy.errors;

export function errorText(code: string | undefined): string | undefined {
	if (code === undefined || code === "") {
		return undefined;
	}
	return code in copy.errors ? copy.errors[code as ErrorCode] : copy.errors.generic;
}

export function fill(template: string, values: Record<string, string>): string {
	return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
