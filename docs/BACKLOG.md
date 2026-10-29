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
- Tasarımdaki yeni kavramlar için ürün kararı: "para teslimi bekleniyor" durumu (kabulden sonra paranın verildiğinin iki tarafça işaretlenmesi), "Para iste" akışı, nazik hatırlatma gönderme butonu.
- Marka ikonu, Android adaptive ikon katmanları ve açılış görseli (tasarımdaki logodan 1024 px PNG).
- Yüz tanıma / parmak izi ile giriş (tasarım 02 "Yüz tanıma ile giriş"): PIN'in yerine cihazda kilit açma kolaylığı (ADR-046); buton F4-01b'de gizli — F4-01b sırasında.
- `pin-login`'e IP başına deneme sınırı (`private.take_rate_limit`) ve üretimde GoTrue `sign_in_sign_ups` sınırının yükseltilmesi; ayarlardan PIN değiştirme — F4-01b sırasında (ADR-049).
- Router test ortamı: aynı test dosyasında sekmeler bir kez açıldıktan sonra (auth)'dan sekmelere geçiş "Unmatched Route"a düşüyor; şimdilik bu tür testler ayrı dosyada (`restoreLegacy.test.tsx`) — F4-01b sırasında.
- ParamNet ID: kullanıcı engelleme, ID'yi QR kodla paylaşma, ID ile kişi ekleme (paylaşmadan rehbere kaydetme) — F4-02 sırasında (ADR-050).
- Profil: e-posta alanı (tasarım 35), anlaşma bazında hatırlatma kapatma (spec 5.9) — F4-02 sırasında (ADR-051).
- Karşı tarafın fotoğrafını anlaşma, Borçlarım ve Talepler satırlarında gösterme (`counterparty.avatar_path` hazır) — F4-02b sırasında.
- Bildirim kutusunun açıkken canlı güncellenmesi (Realtime ya da push gelince yenileme) ve uygulama simgesinde okunmamış sayısı — F4-02b sırasında.
- Destek e-posta adresinin belirlenmesi (`EXPO_PUBLIC_SUPPORT_EMAIL`) ya da uygulama içi Yardım ekranı — F4-02b sırasında (ADR-052).
- Hesaplar ve işlemler: borç ödemelerinin ve kart harcamalarının bir hesabın bakiyesine yazılması, fiş/belge ekleme, kategoriye bölme, özel kategoriler, işlem geçmişinde "Planlı & bekleyen" (anlaşma taksitleri, ekstreler; F4-10) — F4-03 sırasında (ADR-053).
- Ana Sayfa'da "Son işlemler" listesi (tasarım 03) ve açılışta tutarları gizleme tercihi; işlem akışları için Maestro senaryosu — F4-03b sırasında.
- Rapor dışa aktarma (PDF/CSV), sabit gider işareti ve "sabitler dışında harcama" özeti, özel bütçe dönemleri; tekrarlayan transfer — F4-04 sırasında (ADR-054).
- Kartlar: banka ekstresi PDF okuma, kart bazlı harcama kategorisi raporu, son ödeme hatırlatması (push), kart taksitlerini erken kapatma — F4-05 sırasında (ADR-055).
- Elden taksit: kişisel kaydın planını düzenleme ekranı (`update_personal_agreement` hazır; 25'teki kalem), ödeme yöntemini kayda yazıp "Ödeme yöntemi" satırını gösterme, anlaşma bazında hatırlatma, taksit sayısında basılı tutunca hızlı artırma — F4-09 sırasında (ADR-059).
- Para iste: teslim onayından önce talebi Borçlarım toplamlarının dışında tutma, teslim adımları için push bildirimi, rehberden ID ile kişi seçimi — F4-08 sırasında (ADR-058).

- Ana Sayfa "Son İşlemler"de anlaşma ödemeleri (ör. "Ayşe Demir · Alacak tahsilatı"), takvimde ödenmemiş eski kart ekstrelerinin günleri, projeksiyonda ada göre uyarı cümlesi — F4-10 sırasında (ADR-060).
- Tasarımdaki para biçimi `₺12.000,00` (CLAUDE.md'deki `12.000,00 TL` kuralının yerine) ve Ionicons yerine tasarımın SVG ikonları — F4-01c (PR #50) hiç birleşmedi ve kapatıldı. Görsel farklar F4-12 kapısında tasarımla karşılaştırılır.
