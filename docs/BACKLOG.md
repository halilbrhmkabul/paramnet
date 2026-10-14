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
- Dışa aktarmayı dosya olarak kaydetme (expo-file-system + expo-sharing), metin sürümü değişince yeniden onay isteme, uygulama kilidi ve anlaşma bazında bildirim tercihleri (S20) — F3-03 sırasında.
- EAS Workflows ile otomatik build/submit ve EAS Update (OTA) kanalları — F3-06 sırasında; önce hesaplar açılmalı.
- Tasarım kanvasındaki kapsam dışı modüller (ADR-043): Kartlarım/ekstre/kart ödemesi, banka kredileri, hesaplar ve cüzdan, gelir-gider girişi, tekrarlayan işlem, bütçe kategorileri, aylık rapor, hesap bölme (kare kod/davet). Faiz simülasyonu kesin kural gereği yapılmaz.
- Tasarımdaki yeni kavramlar için ürün kararı: ParamNet ID (PN-xxxxxx) ile kişi bulma, "para teslimi bekleniyor" durumu (kabulden sonra paranın verildiğinin iki tarafça işaretlenmesi), "Para iste" akışı, nazik hatırlatma gönderme butonu.
- Marka ikonu, Android adaptive ikon katmanları ve açılış görseli (tasarımdaki logodan 1024 px PNG).
- Yüz tanıma / parmak izi ile giriş (tasarım 02 "Yüz tanıma ile giriş"): PIN'in yerine cihazda kilit açma kolaylığı (ADR-046); buton F4-01b'de gizli — F4-01b sırasında.
- `pin-login`'e IP başına deneme sınırı (`private.take_rate_limit`) ve üretimde GoTrue `sign_in_sign_ups` sınırının yükseltilmesi; ayarlardan PIN değiştirme — F4-01b sırasında (ADR-049).
- Router test ortamı: aynı test dosyasında sekmeler bir kez açıldıktan sonra (auth)'dan sekmelere geçiş "Unmatched Route"a düşüyor; şimdilik bu tür testler ayrı dosyada (`restoreLegacy.test.tsx`) — F4-01b sırasında.
