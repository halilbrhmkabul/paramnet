# Yayın rehberi (EAS, TestFlight, Play kapalı test)

F3-06'da kod ve yapılandırma hazırlandı. Hesap gerektiren adımlar aşağıda. Ücretler:
- EAS bulut build'in ücretsiz kotası var (bkz. expo.dev/pricing).
- Apple Developer Program yıllık 99 $.
- Google Play geliştirici hesabı tek seferlik 25 $.

## 1. Bir kez: EAS projesi

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init
```

`eas init`, `app.json`'a `extra.eas.projectId` ekler. Bu değişikliği commit et; push bildirimleri de bu kimliğe bağlı (F1-18).

## 2. EAS ortam değişkenleri

Değerler eas.json'a yazılmaz. Expo panelinde (Project → Environment variables) ya da `eas env:create` ile girilir. Her profil (`development`, `preview`, `production`) kendi ortamını kullanır.

| Değişken | Değer | Görünürlük |
|---|---|---|
| `EXPO_PUBLIC_API_MODE` | `supabase` | Plain text |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Plain text |
| `EXPO_PUBLIC_SUPABASE_KEY` | Publishable key (asla secret/service role değil) | Plain text |
| `EXPO_PUBLIC_APP_DOMAIN` | Davet linki alan adı (karar verilince) | Plain text |
| `EXPO_PUBLIC_SENTRY_DSN` / `EXPO_PUBLIC_SENTRY_ENV` | Sentry (AB bölgesi) | Plain text |

`EXPO_PUBLIC_*` değerleri uygulamanın içine gömülür. Bu yüzden buraya gizli anahtar konmaz.

## 3. iOS → TestFlight

1. App Store Connect'te uygulamayı oluştur:
   - Bundle ID: `com.paramnet.app`
   - Ad: Paramnet
   - Birincil dil: Türkçe
2. Build ve gönderim:
   ```bash
   npx eas-cli@latest build -p ios --profile production --auto-submit
   ```
   - İlk seferde EAS, sertifika ve provisioning profilini oluşturmayı önerir; kabul et.
   - Şifreleme sorusu sorulmaz: `usesNonExemptEncryption: false`.
3. Build işlendikten sonra App Store Connect → TestFlight'ta test grubunu oluştur ve test edenleri ekle. Harici test edenler için Apple'ın beta incelemesi gerekir.

## 4. Android → Play kapalı test

1. Play Console'da uygulamayı oluştur (paket: `com.paramnet.app`).
2. Uygulama içeriği formlarını doldur. Bunlar F3-07'de hazırlanacak metinlerle yapılır:
   - gizlilik politikası URL'si;
   - veri güvenliği;
   - hedef kitle.
3. İlk AAB'yi Play'e bir kez elle yükle; API ile ilk yükleme yapılamaz:
   ```bash
   npx eas-cli@latest build -p android --profile production
   ```
   Çıkan `.aab` dosyasını Play Console → Test → Kapalı test (alpha) kanalına yükle.
4. Sonraki sürümler için:
   - Google Cloud'da bir servis hesabı oluştur ve Play Console'da ona yetki ver.
   - JSON anahtarını EAS'a ekle (`eas credentials -p android`). Anahtarı repoya koyma.
   - Sonra:
   ```bash
   npx eas-cli@latest build -p android --profile production --auto-submit
   ```
   `eas.json` gönderimi `alpha` kanalına taslak (`draft`) olarak yapar; yayına alma Play Console'dan yapılır.

## 5. Development build (gerçek push ve uygulama içi derin bağlantı testi)

Expo Go, Android'de uzak push almaz. Gerçek cihazda bildirim denemek için:

```bash
npx eas-cli@latest build --profile development -p android   # veya -p ios (cihazı önce kaydet: eas device:create)
pnpm --filter mobile start:dev-client
```

`pnpm mobile` Expo Go ile çalışmaya devam eder.

## Yayından önce

- `supabase/README.md` → "Üretim kontrol listesi"
- KVKK metinlerinin avukat onayı (`legal` ekranları "taslak" yazıyor)
- Netgsm alanlarının ilk gerçek hesapla doğrulanması (ADR-040)
