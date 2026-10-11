# Derin Bağlantılar (Davet Linki)

Kaynak: `docs/PRODUCT_SPEC.md` Bölüm 5.4, 11.2. Faz 2.

## Link biçimi

```
https://<APP_DOMAIN>/i/<token>
```

- `<APP_DOMAIN>` henüz belirlenmedi; `EXPO_PUBLIC_APP_DOMAIN` ortam değişkeninden okunur. Kod ve testlerde sabit yazılmaz.
- `<token>`: 32 bayt rastgele, base64url (43 karakter). Linkte anlaşma ID'si, tutar, isim **yer almaz**.
- Uygulama özel şeması (`paramnet://`) yalnızca geliştirme içindir; paylaşılan linkler her zaman https.

## Davranış

| Durum | Sonuç |
|---|---|
| Uygulama yüklü (iOS Universal Link / Android App Link doğrulanmış) | `app/invite/[token].tsx` açılır |
| Uygulama yüklü değil | Tarayıcıda `apps/web-confirm` onay sayfası (W01) |
| Uygulama yüklü, oturum yok | Önce `(auth)` akışı, sonra aynı token'la invite ekranına dönüş (token güvenli şekilde geçici saklanır) |
| Token geçersiz / süresi dolmuş / tüketilmiş | Açıklayıcı boş durum: "Bu bağlantı artık geçerli değil." |

## Uygulama tarafı (`app/invite/[token].tsx`)

1. Token'ı `invite-open`'a gönder → oluşturanın adı ve davet durumu.
2. Kullanıcının oturumundaki doğrulanmış numara davetteki hedef numarayla eşleşmiyorsa: "Bu plan başka bir numaraya gönderilmiş." (detay gösterme).
3. Eşleşiyorsa detay + karar (S14). Uygulama içinde OTP tekrar istenmez; oturum numarası zaten doğrulanmış.
4. Karar `decide_agreement` RPC ile, `version` + `terms_hash` gönderilir.

## Yapılandırma

- **iOS:** `app.json` → `ios.associatedDomains: ["applinks:<APP_DOMAIN>"]`. `https://<APP_DOMAIN>/.well-known/apple-app-site-association` dosyası `apps/web-confirm` tarafından `application/json` olarak, yönlendirmesiz sunulur; `paths`/`components` yalnızca `/i/*`.
- **Android:** `app.json` → `android.intentFilters` (`autoVerify: true`, `https`, host `<APP_DOMAIN>`, `pathPrefix: /i/`). `https://<APP_DOMAIN>/.well-known/assetlinks.json` yayın imzalama sertifikasının SHA-256 parmak iziyle.
- AASA ayrıntıları için `expo` skill'indeki `expo-app-clip` (associated domains bölümü) kullanılır.

## Test

- Geliştirmede: `npx uri-scheme open "https://<APP_DOMAIN>/i/<token>" --ios` / `--android` veya Maestro `openLink`.
- Kontrol listesi: yüklü uygulama açılıyor; yüklü değilken web açılıyor; geçersiz token boş durumu; oturumsuz akıştan sonra davete dönüş.
