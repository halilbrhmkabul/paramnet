# Backlog (kapsam dışı fikirler)

Mevcut görev sırasında akla gelen yeni özellikler buraya yazılır, uygulanmaz. Faz kapılarında gözden geçirilir.

Biçim: `- [tarih] Fikir — kaynak (görev ID / kullanıcı) — not`

## Sonraki sürüm adayları (spec 15)
- Doğal dil ile hızlı kayıt (1.1)
- PDF çıktı, premium (1.1)
- Grup / ortak harcama, çoklu para birimi ve altın (1.2)
- Kişisel finans modülleri: gelir-gider, hesaplar, kredi kartı, kredi (2.0)
- Ekstre PDF okuma, nakit akışı tahmini, AI asistan (2.x)
- Lisanslı açık bankacılık sağlayıcısıyla iş ortaklığı (3.x)

## Yeni fikirler

- Ödemeyi belirli bir taksite yönlendirme (spec 5.5 gelişmiş seçenek; F1-03 sırasında, `allocatePayment` yalnızca FIFO).
- Ödeme dekontu yükleme (S12; Storage + imzalı URL, spec 11) ve ödeme sonrası haptic/ilerleme animasyonu (design-tokens "Hareket") — F1-09 sırasında.
- Hatırlatmaları anlaşma bazında kapatma/değiştirme (spec 5.9) — F1-18 sırasında; tercih tablosu + ayarlar ekranı gerekir.
- Expo push receipt kontrolü (ticket sonrası teslim raporu) — F1-18 sırasında; şimdilik yalnızca ticket hataları işleniyor.
- Edge function IP rate limit için güvenilir istemci IP kaynağı (web sunucusu–fonksiyon arası paylaşılan sır) — F2-04 sırasında; F3-05 ile birlikte.
- İptal talebini geri çekme (`withdraw_cancel`) ve iptal edilen anlaşmada bekleyen `reported` ödemeleri kapatma — F2-09 sırasında; state-machines.md'de olay tanımı yok.
- Sentry source map / sürüm yükleme: `@sentry/react-native/expo` config plugin + `getSentryExpoConfig` (EAS), web için `withSentryConfig`, `@sentry/cli` kurulum betiğine izin; web tarayıcı hataları için ayrı ve PII'siz bir karar — F3-01 sırasında.
- Kayıt öncesi anonim açılış olayı (spec 13.2 "uygulama açılışından ilk anlaşmaya" tam ölçümü) ve web panel; hazır huni/kohort ihtiyacı doğarsa PostHog — F3-02 sırasında.
