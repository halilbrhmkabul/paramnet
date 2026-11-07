# Güvenlik Modeli

Kaynak: `docs/PRODUCT_SPEC.md` Bölüm 11–12.

## Kimlik

- Telefon + 6 haneli PIN (ADR-046). Kayıtta numara SMS koduyla doğrulanır, ardından PIN iki kez girilerek belirlenir. "Şifremi unuttum": SMS kodu → yeni PIN. PIN'i olmayan eski hesaplar SMS ile girdikten sonra PIN belirler.
- PIN, Supabase Auth'ta hesabın parolası olarak tutulur; ama PIN'in kendisi değil, sunucudaki `PIN_PEPPER` sırrıyla türetilmiş HMAC değeri (ADR-049). Bu yüzden Auth'a doğrudan parola girişi işe yaramaz; tek yol `pin-login` edge function'ıdır.
- Hesap kilidi sunucuda: `pin-login` her başarısız denemeyi `pin_login_attempts`'e yazar (numara yalnızca hash'iyle); 15 dakika içinde 5 hata numarayı 15 dakika kilitler. Kayıtlı olmayan numara da aynı yanıtı alır. Başarılı giriş ve yeni PIN sayacı sıfırlar.
- Zayıf PIN reddedilir: tüm haneleri aynı olan ve art arda gelen (123456, 654321) PIN'ler; kural uygulamada ve `pin-set`'te aynı.
- Mobilde oturum token'ları `expo-secure-store`'da.
- İsteğe bağlı uygulama kilidi: `expo-local-authentication`.

## Anahtarlar ve ortam

- İstemcide yalnızca publishable/anon anahtar. Servis rolü anahtarı yalnızca edge function ortamında.
- SMS sağlayıcı anahtarları ve Expo push erişim token'ı: edge function secret'ları.
- `.env*` commit edilmez; `.env.example` güncel tutulur.

## Storage

- `receipts` bucket'ı özel. Yol: `{agreement_id}/{payment_id}/{uuid}.{ext}`.
- Okuma: yalnızca kaydın sahibi, kısa süreli imzalı URL.
- Yükleme: yalnızca image/jpeg, image/png, application/pdf; en fazla 5 MB; EXIF temizleme.

## Girdi doğrulama (her RPC)

- Tutar > 0 ve ≤ makul üst sınır (ör. 1.000.000.000,00 TL = 100_000_000_000 kuruş).
- Metin alanları uzunluk sınırı (başlık 80, not 500, gerekçe 500).
- Tarihler makul aralıkta (bugün −10 yıl, +30 yıl).
- Telefon E.164, ilk sürümde yalnızca +90.

## Kişisel veri

- Loglarda telefon maskeli (`+90******1234`), tutar yok, not yok.
- Analitik olaylarında ad, telefon, not yok; tutar yalnızca aralık olarak.
- Rehber sunucuya yüklenmez; yalnızca seçilen kişinin adı alınır, telefon numarası saklanmaz.
- Hesap silme: kullanıcının tüm kayıtları, grupları ve olayları silinir.

## Güvenlik kontrol listesi (faz kapıları)

- [ ] Tüm tablolarda RLS açık ve istemci yazma politikası yok (pgTAP ile doğrulandı)
- [ ] Tüm `security definer` fonksiyonlarda `set search_path = public`
- [ ] Fonksiyonlarda `revoke all from public, anon`; yalnızca `authenticated`'a grant
- [ ] Hiçbir sorgu başka kullanıcının verisini döndürmüyor (pgTAP ile doğrulandı)
- [ ] Rate limit ve SMS bütçe alarmı test edildi
- [ ] Mobil pakette gizli anahtar yok (bundle taraması)
- [ ] `claude-security` taraması yapıldı, bulgular kapatıldı
