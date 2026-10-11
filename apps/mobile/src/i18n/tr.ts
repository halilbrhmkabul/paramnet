// Every user-facing string lives here (paramnet-mobile copy-tr.md). Placeholders use {name}.
export const tr = {
	common: {
		appName: "Paramnet",
		retry: "Tekrar dene",
		loading: "Yükleniyor",
		save: "Kaydet",
		cancel: "Vazgeç",
		continue: "Devam",
		close: "Kapat",
		edit: "Düzenle",
		seeAll: "Tümünü gör",
		saved: "Kaydedildi",
	},
	tabs: {
		home: "Ana Sayfa",
		contacts: "Kişiler",
		new: "Yeni kayıt",
		calendar: "Takvim",
		requests: "Talepler",
	},
	welcome: {
		title: "Verdiğin, aldığın ve taksitle ödediğin her şey tek yerde.",
		subtitle: "Planı kaydet, istersen karşı tarafla paylaş, ödemeleri birlikte takip edin.",
		cta: "Başla",
		next: "İleri",
		skip: "Geç",
		cards: [
			{
				title: "Hepsini kaydet",
				body: "Verdiğin ve aldığın borçları, taksitli alışverişlerini tek listede tut.",
			},
			{
				title: "Ödeme günlerini unutma",
				body: "Ödeme günü gelince Paramnet hatırlatır; kimse istemek zorunda kalmaz.",
			},
			{
				title: "İstersen birlikte takip edin",
				body: "Planı karşı tarafla paylaş, ödemeleri ikiniz de aynı şekilde görün.",
			},
		],
		cardPosition: "{current} / {total}",
	},
	phone: {
		title: "Telefon numaran",
		helper: "Sana bir doğrulama kodu göndereceğiz.",
		label: "Cep telefonu",
		prefix: "+90",
		placeholder: "5XX XXX XX XX",
		errorInvalid: "Bu bir Türkiye cep numarası gibi görünmüyor.",
		legal: "Devam ederek Kullanım Koşulları'nı kabul etmiş ve KVKK Aydınlatma Metni'ni okumuş olursun.",
	},
	otp: {
		title: "Kodu gir",
		helper: "{phone} numarasına gönderdiğimiz 6 haneli kodu yaz.",
		label: "Doğrulama kodu",
		resend: "Kodu tekrar gönder",
		resendIn: "Kodu tekrar gönder ({seconds} sn)",
		resent: "Yeni kod gönderildi.",
		errorInvalid: "Kod hatalı. Tekrar dener misin?",
		errorExpired: "Kodun süresi doldu. Yeni kod iste.",
		changeNumber: "Numarayı değiştir",
	},
	profile: {
		name: "Adın nasıl görünsün?",
		nameLabel: "Görünen ad",
		nameHelper: "Planı paylaştığın kişiler seni bu adla görür.",
		consent: "KVKK Aydınlatma Metni'ni okudum, kabul ediyorum.",
		notificationsTitle: "Hatırlatmalar",
		notificationsReason: "Ödeme günlerini hatırlatabilmemiz için bildirim izni gerekiyor.",
		notificationsAllow: "Bildirimlere izin ver",
		notificationsLater: "Şimdi değil",
	},
	home: {
		receivable: "Alacağın",
		payable: "Borcun",
		dueThisMonth: "Bu ay ödenecek",
		collectThisMonth: "Bu ay tahsil edilecek",
		overdue: "Gecikenler",
		emptyTitle: "İlk kaydını ekle",
		emptyBody: "Bir borcu veya taksitli alışverişi kaydet, ödeme günlerini biz hatırlatalım.",
	},
	new: {
		title: "Ne kaydetmek istiyorsun?",
		lent: "Borç verdim",
		borrowed: "Borç aldım",
		boughtInstallment: "Taksitle aldım",
		soldInstallment: "Taksitle sattım",
	},
	plan: {
		total: "Toplam",
		downPayment: "Peşinat",
		remaining: "Kalan",
		mismatch: "Taksitlerin toplamı kalan tutara eşit olmalı. Fark: {amount}",
	},
	agreement: {
		personalBadge: "Yalnızca sen görüyorsun",
		owesYou: "Sana borçlu",
		youOwe: "Borçlusun",
		status: {
			personal: "Kişisel",
			pending: "Onay bekliyor",
			countered: "Düzeltme önerildi",
			active: "Aktif",
			amendment_pending: "Değişiklik bekliyor",
			disputed: "İtirazlı",
			rejected: "Kabul edilmedi",
			settled: "Kapandı",
			cancelled: "İptal edildi",
		},
	},
	installment: {
		status: {
			upcoming: "Yaklaşıyor",
			due_today: "Bugün",
			overdue: "Gecikti",
			paid: "Ödendi",
		},
		partial: "Kısmen ödendi",
	},
	payment: {
		received: "Ödeme aldım",
		made: "Ödeme yaptım",
		awaiting: "{amount} onay bekliyor",
		notReceived: "Bu ödemeyi almadım",
	},
	share: {
		title: "Planı paylaş",
		message:
			"{name} seninle Paramnet'te bir ödeme planı paylaştı. Birlikte takip etmek için: {link}",
	},
	requests: {
		emptyTitle: "Bekleyen talep yok",
		emptyBody: "Bir planı paylaştığında onaylar ve ödeme bildirimleri burada görünür.",
	},
	invite: {
		title: "{name} seninle bir ödeme planı paylaştı",
		accept: "Onaylıyorum",
		counter: "Düzeltme öner",
		reject: "Bu plan bana ait değil",
	},
	amountInput: {
		placeholder: "0,00",
		currency: "TL",
	},
	form: {
		required: "Bu alanı doldurur musun?",
		tooLong: "Bu alan çok uzun.",
	},
	error: {
		generic: "Bir sorun çıktı, tekrar dener misin?",
		offline: "İnternet bağlantısı yok. Kayıt eklemek için bağlantı gerekiyor.",
		conflict: "Bu kayıt az önce güncellendi. Son hâline bak.",
		exceedsOutstanding: "Bu tutar kalan borçtan fazla.",
		notFound: "Bu kayıt bulunamadı.",
		forbidden: "Bu işlem için yetkin yok.",
		invalidTransition: "Bu kayıt şu an bu işleme uygun değil.",
		validation: "Bilgileri kontrol eder misin?",
		rateLimited: "Biraz bekleyip tekrar dener misin?",
	},
	settled: {
		title: "Tebrikler, bu plan tamamlandı!",
	},
} as const;

export function fill(template: string, values: Record<string, string>): string {
	return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
