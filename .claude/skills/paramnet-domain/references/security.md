# Güvenlik Modeli

Kaynak: `docs/PRODUCT_SPEC.md` Bölüm 11–12.

## Kimlik

- Telefon + SMS OTP (Supabase Auth). Şifre yok.
- Mobilde oturum token'ları `expo-secure-store`'da.
- İsteğe bağlı uygulama kilidi: `expo-local-authentication`.

## Davet ve web onay — zorunlu önlemler

| Tehdit | Önlem (uygulama zorunlu) |
|---|---|
| Link tahmini | 32 bayt (256-bit) kriptografik rastgele token, base64url. DB'de yalnızca `sha256(token)`. Düz token yalnızca `share_agreement` dönüşünde bir kez. |
| Link iletimi | Link yetki vermez. Karar için davetteki `target_phone_e164`'e giden OTP zorunlu. |
| OTP öncesi sızıntı | `invite-open` yalnızca oluşturanın `display_name`'ini döndürür. Tutar, plan, not OTP sonrası. |
| Link önizleme botları | GET istekleri hiçbir durumu değiştirmez. Kararlar POST + CSRF token ile. |
| OTP kaba kuvvet | Davet başına 5 deneme, OTP 5 dk geçerli; aşımda davet `locked`. |
| SMS pumping | Yalnızca `+90`; Turnstile doğrulaması; IP başına ve numara başına zaman pencereli limit (`rate_limits`); günlük SMS sayacı ve alarm eşiği. |
| İçerik değişimi | Karar `version` + `terms_hash` taşır; sunucu hash'i yeniden hesaplar. |
| Tekrar kullanım | Karar sonrası `consumed`; süre sonunda `expired`. |
| Oltalama | Tek sabit alan adı; sayfa şifre/kart bilgisi istemez. |
| Tarayıcı sızıntısı | HTTPS + HSTS, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, sıkı CSP, ayrı alt alan adı. |

Onay oturumu: OTP doğrulanınca kısa ömürlü (15 dk), davete ve numaraya bağlı, imzalı bir token (HttpOnly, Secure, SameSite=Strict çerez). `invite-decide` yalnızca bu oturumla çalışır.

## Anahtarlar ve ortam

- İstemcide yalnızca publishable/anon anahtar. Servis rolü anahtarı yalnızca edge function ortamında.
- Turnstile gizli anahtarı, SMS sağlayıcı anahtarları, Expo push erişim token'ı: edge function secret'ları.
- `.env*` commit edilmez; `.env.example` güncel tutulur.

## Storage

- `receipts` bucket'ı özel. Yol: `{agreement_id}/{payment_id}/{uuid}.{ext}`.
- Okuma: yalnızca anlaşma tarafları, kısa süreli imzalı URL.
- Yükleme: yalnızca image/jpeg, image/png, application/pdf; en fazla 5 MB; EXIF temizleme.

## Girdi doğrulama (her RPC)

- Tutar > 0 ve ≤ makul üst sınır (ör. ₺1.000.000.000,00 = 100_000_000_000 kuruş).
- Metin alanları uzunluk sınırı (başlık 80, not 500, gerekçe 500).
- Tarihler makul aralıkta (bugün −10 yıl, +30 yıl).
- Telefon E.164, ilk sürümde yalnızca +90.

## Kişisel veri

- Loglarda telefon maskeli (`+90******1234`), tutar yok, not yok.
- Analitik olaylarında ad, telefon, not yok; tutar yalnızca aralık olarak.
- Rehber sunucuya yüklenmez; yalnızca seçilen kişinin adı/numarası.
- Hesap silme: profil anonimleştirilir (`display_name = 'Silinmiş kullanıcı'`, telefon null), karşı tarafın gördüğü anlaşma ve olay kaydı korunur.

## Güvenlik kontrol listesi (Faz 2 ve 3 kapıları)

- [ ] Tüm tablolarda RLS açık ve istemci yazma politikası yok (pgTAP ile doğrulandı)
- [ ] Tüm `security definer` fonksiyonlarda `set search_path = public`
- [ ] Fonksiyonlarda `revoke all from public, anon`; yalnızca `authenticated`'a grant
- [ ] Davet akışında GET yan etkisiz
- [ ] Rate limit ve SMS bütçe alarmı test edildi
- [ ] Mobil pakette gizli anahtar yok (bundle taraması)
- [ ] `claude-security` taraması yapıldı, bulgular kapatıldı
