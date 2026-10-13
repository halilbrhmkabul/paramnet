# Tasarım Token'ları — "Orman Defteri"

Kaynak: kullanıcının tasarım kanvası (ParamNet, "30 · Tasarım Sistemi"), F3-10, ADR-043. Kod tarafında tek kaynak `apps/mobile/src/theme/tokens.ts`; bileşenlerde sabit renk, font ya da ölçü yazılmaz. Açık palet tasarımdan birebir alındı; koyu palet aynı orman tonlarından türetildi (tasarımda koyu tema yok). İki temanın kontrastı `theme.test.tsx` ile denetlenir.

İlke (tasarımdan): renk anlam taşır, süs değildir; her durum rengi bir etiket veya ikonla birlikte kullanılır.

## Renkler

| Token | Açık | Koyu | Kullanım |
|---|---|---|---|
| `bg` | `#F5F7F4` Zemin | `#0D1411` | Ekran arka planı |
| `surface` / `surfaceRaised` | `#FFFFFF` Yüzey | `#151E1A` / `#1B2621` | Kart, giriş alanı, sekme çubuğu / sheet |
| `surfaceSunken` | `#F1F4F0` | `#111915` | Tarih kutusu gibi gömük alanlar |
| `track` | `#E8ECE8` | `#24302A` | İlerleme çubuğu zemini, segment zemini |
| `border` / `borderStrong` / `divider` | `#E2E7E2` / `#D5DCD6` / `#EDF0EC` | `#26332C` / `#34433B` / `#1F2A24` | Kart kenarı / giriş ve ikincil buton / satır ayırıcı |
| `text` | `#13221B` Mürekkep | `#E6EEE9` | Birincil metin |
| `textMuted` | `#56645D` | `#9AABA1` | İkincil metin |
| `tabInactive` | `#5E6B64` | `#8A9A91` | Seçili olmayan sekme |
| `primary` / `onPrimary` | `#0F3A2E` Orman / `#FFFFFF` | `#7FD3AE` / `#0B1F17` | Birincil buton, seçili sekme |
| `primarySoft` | `#DDEFE4` Nane | `#1C3A2D` | Seçili sekme hapı, başarı halkası |
| `accent` | `#146A4E` Zümrüt | `#7FD3AE` | Bağlantı, ilerleme dolgusu |
| `receivable` | `#11613F` | `#6FCF9A` | Alacak tutarı |
| `payable` | `#13221B` | `#E6EEE9` | Borç tutarı (mürekkep; kırmızı yalnızca gecikme) |
| `success` / `successSoft` | `#11613F` / `#E1F1E7` | `#6FCF9A` / `#163526` | Onaylı, ödendi |
| `pending` / `pendingSoft` | `#24507D` / `#E3ECF6` | `#8FB6E3` / `#1B2A3B` | Talep, bilgi, yanıt bekleniyor |
| `warning` / `warningSoft` | `#7A4E00` / `#FBEFD5` | `#E3B65E` / `#352A12` | Yaklaşan, onay bekliyor |
| `overdue` / `overdueSoft` / `dangerBorder` | `#A1291F` / `#FBE4E1` / `#EDC1BB` | `#F08C82` / `#3A1D1A` / `#5C2C27` | Gecikmiş, itiraz, yıkıcı eylem |
| `neutral` / `neutralSoft` | `#46534C` / `#ECEFEC` | `#B3C0B8` / `#26302B` | Planlı, manuel kayıt, iptal |
| `amber` / `warningSurface` / `warningBorder` | `#D9A847` / `#FDF6E6` / `#EBD9AE` | `#C9A04A` / `#211B0E` / `#4A3A18` | Sıradaki taksit dilimi; amber kartlar (sıradaki taksit, bekleyenler, bildirilen ödeme) |
| `expense` / `expenseSoft` | `#8A3B2C` / `#F6ECE8` | `#F0A08F` / `#3A221D` | Gider (hızlı işlem) |
| `violet` / `violetSoft` | `#4E3F86` / `#ECE8F4` | `#B7AAF0` / `#272240` | Borç ver (hızlı işlem), kredi |
| `calPayment` / `calIncoming` / `calDone` | `#C98A12` / `#2F6CA8` / `#9AA69F` | `#E0A93A` / `#6FA3DA` / `#5E6B64` | Takvim noktaları ve renk çubukları |
| `brandMark` | `#7FD3AE` | `#0B1F17` | Logo kutusundaki "R" |
| `shadow` | `#10281E` | `#000000` | Seçili segmentin ince gölgesi |

Rozet tonları (`Badge`): `success`, `pending`, `warning`, `overdue`, `neutral`, `primary`; her biri yumuşak zemin + koyu metin, hap biçiminde.

Anlaşma durumu: Kişisel → `neutral`, Onay bekliyor / Düzeltme → `pending`, Aktif / Kapandı → `success`, Değişiklik bekliyor → `warning`, İtirazlı → `overdue`, Reddedildi / İptal → `neutral`. Taksit: Planlı → `neutral`, Bugün → `warning`, Gecikti → `overdue`, Ödendi → `success`.

## Tipografi

Manrope (500–800) ve kimlikler için IBM Plex Mono 500; `@expo-google-fonts`, açılış ekranı fontlar yüklenene kadar kalır. Her ağırlık ayrı bir font ailesidir; `fontWeight` yazılmaz (Android özel fontta yok sayar). Tutarlarda `fontVariant: ['tabular-nums']`.

| Token | Font | Boyut / satır | Kullanım |
|---|---|---|---|
| `amountXL` | Manrope 800 | 34 / 40 | Detayda kalan tutar |
| `amountL` | Manrope 800 | 28 / 34 | Özet kartları |
| `title` | Manrope 800 | 26 / 32 | Sayfa başlığı |
| `headline` | Manrope 800 | 17 / 22 | Bölüm başlığı |
| `rowTitle` | Manrope 700 | 15 / 20 | Satır başlığı, segment |
| `body` | Manrope 500 | 16 / 22 | Gövde |
| `callout` | Manrope 500 | 15 / 20 | İkincil gövde |
| `label` | Manrope 700 | 13 / 18 | Form etiketi |
| `caption` | Manrope 600 | 13 / 18 | Açıklama, tarih |
| `badge` | Manrope 700 | 12 / 16 | Durum rozeti |
| `micro` | Manrope 700 | 11 / 14 | Sekme etiketi |
| `button` | Manrope 800 | 16 / 20 | Buton |
| `mono` | IBM Plex Mono 500 | 12 / 16 | Kimlik, kayıt no |

Yazı ölçeği (Dynamic Type) desteklenir; `maxFontSizeMultiplier` yalnızca tutar ve rozetlerde 1.4.

## Boşluk, köşe, boyut

- Boşluk ölçeği: `xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 24`, `xxl 32`; ekran kenarı 16, kart iç boşluğu 16.
- Köşe: `sm 14` (giriş alanı), `md 16` (buton), `lg 20` (kart), `xl 24` (büyük panel), `pill 999` (rozet, sekme hapı).
- Birincil buton 54; ikincil 48; ikon butonu 44×44; minimum dokunma alanı 44×44.
- Butonlar: birincil dolu (Orman); ikincil yüzey + `borderStrong` kenar; yıkıcı yüzey + `dangerBorder` kenar + `overdue` metin; hayalet `accent` metin.

## Hareket

- Varsayılan geçiş: platform native (Expo Router native stack).
- Mikro etkileşim süresi 150–250 ms; "Hareketi azalt" açıksa animasyonlar kapanır.
- Ödeme kaydı sonrası ilerleme çubuğu animasyonu ve hafif haptic (iOS `notificationSuccess`).

## İkonlar

- Tasarımın kendi çizgi ikonları, yol yol `src/components/Icon.tsx`'te (react-native-svg, ADR-048). Yeni ikon gerekirse tasarım dosyasındaki SVG yolu buraya eklenir; Ionicons ya da başka set kullanılmaz.
