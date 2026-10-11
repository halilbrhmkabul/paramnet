# Tasarım Token'ları

Başlangıç değerleridir; marka kimliği netleşince yalnızca bu dosya ve `src/theme/tokens.ts` değişir. Bileşenlerde sabit renk/ölçü yazılmaz.

## Renkler

| Token | Açık | Koyu | Kullanım |
|---|---|---|---|
| `bg` | `#FFFFFF` | `#0B0F14` | Ekran arka planı |
| `surface` | `#F6F7F9` | `#151A21` | Kart, liste arka planı |
| `surfaceRaised` | `#FFFFFF` | `#1C222B` | Modal, sheet |
| `border` | `#E5E7EB` | `#262C35` | Ayırıcı, kenarlık |
| `text` | `#111827` | `#F3F4F6` | Birincil metin |
| `textMuted` | `#6B7280` | `#9CA3AF` | İkincil metin |
| `primary` | `#1F4E79` | `#6FA8DC` | Birincil buton, bağlantı |
| `onPrimary` | `#FFFFFF` | `#0B0F14` | Birincil buton metni |
| `receivable` | `#15803D` | `#4ADE80` | Alacak (bana borçlu) |
| `payable` | `#C2410C` | `#FB923C` | Borç (borçluyum) |
| `overdue` | `#B91C1C` | `#F87171` | Gecikme |
| `pending` | `#6B7280` | `#9CA3AF` | Onay bekleyen |
| `warning` | `#B45309` | `#FBBF24` | İtiraz, değişiklik bekliyor |
| `success` | `#15803D` | `#4ADE80` | Kapandı, onaylandı |

Durum etiketi eşlemesi: Kişisel → `textMuted`, Onay bekliyor → `pending`, Aktif → `primary`, Değişiklik bekliyor / İtirazlı → `warning`, Kapandı → `success`, İptal → `textMuted`. Renk her zaman etiket metniyle birlikte.

Kontrast: metin/arka plan en az WCAG AA (4.5:1). Yeni renk eklerken iki temada da kontrol et.

## Tipografi

Sistem fontu (iOS SF Pro, Android Roboto). Tüm tutarlarda `fontVariant: ['tabular-nums']`.

| Token | Boyut / satır | Ağırlık | Kullanım |
|---|---|---|---|
| `amountXL` | 34 / 40 | 700 | Anlaşma detayında kalan tutar |
| `amountL` | 24 / 30 | 700 | Ana sayfa özet kartları |
| `title` | 22 / 28 | 700 | Ekran başlığı |
| `headline` | 17 / 22 | 600 | Kart başlığı, liste birincil |
| `body` | 16 / 22 | 400 | Gövde |
| `callout` | 15 / 20 | 400 | Form etiketleri |
| `caption` | 13 / 18 | 400 | Yardımcı metin, tarih |
| `micro` | 11 / 14 | 600 | Rozet, durum etiketi (büyük harf değil) |

Yazı ölçeği (Dynamic Type) desteklenir; `maxFontSizeMultiplier` yalnızca tutar ve rozetlerde 1.4.

## Boşluk, köşe, boyut

- Boşluk ölçeği (4 tabanlı): `xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 24`, `xxl 32`.
- Ekran yatay kenar boşluğu: 16.
- Köşe: `sm 8` (input, rozet), `md 12` (kart), `lg 16` (sheet, modal).
- Minimum dokunma alanı: 44×44.
- Birincil buton yüksekliği: 52; ikincil: 44.
- Kart iç boşluğu: 16.

## Hareket

- Varsayılan geçiş: platform native (Expo Router native stack).
- Mikro etkileşim süresi 150–250 ms; "Hareketi azalt" açıksa animasyonlar kapanır.
- Ödeme kaydı sonrası ilerleme çubuğu animasyonu ve hafif haptic (iOS `notificationSuccess`).

## İkonlar

- iOS'ta SF Symbols, Android'de Material Symbols karşılığı (expo-native-ui önerisine göre) veya tek bir ikon seti; karışık set kullanma.
