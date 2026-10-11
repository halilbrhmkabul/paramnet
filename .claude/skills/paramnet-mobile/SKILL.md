---
name: paramnet-mobile
description: Paramnet (borç ve taksit uygulaması) mobil (Expo / React Native) kuralları. Ekran, bileşen, navigasyon (Expo Router), form, tutar girişi/gösterimi, tema/renk/tipografi, Türkçe arayüz metni, bildirim, derin bağlantı (davet linki), erişilebilirlik, testID veya Maestro/RNTL testi yazarken ya da değiştirirken MUTLAKA kullan. Use for any screen, UI component, copy, deep link or mobile test work in apps/mobile.
---

# paramnet-mobile

Bu skill `apps/mobile` için proje kurallarıdır. Genel Expo/React Native bilgisi için `expo` ve `react-native-best-practices` skill'lerini, platform tasarım kuralları için `ios-design-guidelines` ve `android-design-guidelines` skill'lerini kullan. Bu skill onların üstüne projeye özgü kararları ekler; çelişkide bu skill ve `docs/PRODUCT_SPEC.md` kazanır.

## Ne zaman hangi referans

| İş | Oku |
|---|---|
| Hangi ekran, rota, bileşenler, durumlar | `references/screens.md` |
| Renk, tipografi, boşluk, köşe, durum renkleri | `references/design-tokens.md` |
| Kullanıcıya görünen her metin, ton | `references/copy-tr.md` |
| Davet linki, Universal/App Links, invite rotası | `references/deep-links.md` |
| testID, RNTL, Maestro akışları | `references/testing.md` |

## Klasör ve katman kuralları

```
apps/mobile/
	app/                    ← yalnızca rotalar (Expo Router); iş mantığı yok
		(auth)/ (tabs)/ agreement/[id]/ new/ invite/[token].tsx
	src/
		api/                  ← AgreementsApi arayüzü + adaptörler (mock, supabase) + TanStack Query hook'ları
		components/           ← tasarım sistemi bileşenleri (yalnızca token kullanır)
		features/             ← agreement, payment, invite, reminders, contacts (ekran parçaları + hook'lar)
		i18n/tr.ts            ← tüm metinler
		theme/                ← token'lar, useTheme
		lib/                  ← supabase istemcisi, push, sentry, analytics, secure-store
	.maestro/               ← E2E akışları
```

- Ekranlar (`app/`) yalnızca `src/features` ve `src/api` hook'larını kullanır. Supabase istemcisini doğrudan import etmez.
- Domain hesapları (plan, dağıtım, para biçimi, taksit durumu) **yalnızca** `packages/shared`'dan gelir; mobilde yeniden yazılmaz.
- Sunucu verisi TanStack Query'de; Zustand yalnızca yerel UI durumu (ör. form taslağı, filtre).
- `src/api` arayüzü sahte (mock) ve gerçek (supabase) adaptör için ortaktır; ekranlar hangisinin çalıştığını bilmez. Seçim `EXPO_PUBLIC_API_MODE=mock|supabase`.

## Ekran kuralları

1. **Tek birincil aksiyon** her ekranda (ör. anlaşma detayında duruma göre: Ödeme ekle / Paylaş / Onayla).
2. **Dört durum zorunlu:** yükleniyor (skeleton), boş (açıklama + buton), hata (Türkçe mesaj + Tekrar dene), veri. Çevrimdışıyken yazma butonları devre dışı ve nedeni yazılı.
3. **Tutar:** giriş `AmountInput` (sayısal klavye, kuruş tam sayı tutar, Türk biçimi), gösterim `AmountText` (`12.000,00 TL`, tabular rakamlar). Elle biçimlendirme yasak.
4. **Tarih:** gösterim `10 Kas 2026` / uzun `10 Kasım 2026`; `packages/shared` tarih yardımcıları; Europe/Istanbul.
5. **Durum renkleri** yalnızca token'lardan ve her zaman metin etiketiyle birlikte (renk tek başına anlam taşımaz).
6. **Erişilebilirlik:** her etkileşimli öğede `accessibilityRole`, `accessibilityLabel` (Türkçe) ve `testID`; minimum dokunma alanı 44×44 pt; Dynamic Type/yazı ölçeği bozulmadan çalışır; koyu tema.
7. **Metin:** tüm metinler `src/i18n/tr.ts`'den; tonu `copy-tr.md`. Bileşen içinde sabit Türkçe metin yasak.
8. **Mutasyonlar:** her yazma çağrısında istemcide `idempotency_key` (uuid) üretilir ve tekrar denemede aynısı kullanılır. 409 conflict → sorguyu yenile, kullanıcıya "Kayıt güncellendi, tekrar bak" de.
9. **Hata eşleme:** sunucu hata kodları `src/api/errors.ts`'de Türkçe mesajlara eşlenir.
10. **Performans:** uzun listelerde FlashList; `expo-image`; gereksiz yeniden render'ı önle (react-native-best-practices).

## İş akışı: yeni ekran yazmak

1. `references/screens.md`'den ekranı, rotasını ve bileşenlerini oku. Spec Bölüm 5 ve 6'daki ilgili akışı oku.
2. Planı sun: rota dosyası, feature bileşenleri, kullanılacak hook'lar, dört durumun tasarımı, testID listesi.
3. Önce RNTL testi: render, boş/hata durumları, birincil aksiyon.
4. Ekranı yaz (yalnızca token, `tr.ts`, `packages/shared`).
5. Gerekiyorsa `.maestro/` akışını ekle/güncelle.
6. Açık ve koyu temada, iOS ve Android'de görsel kontrol için kullanıcıya ne bakması gerektiğini yaz.

## İş akışı: yeni bileşen

- `src/components/` altında; prop'lar tipli; varyantlar token'larla; RNTL testi; `testID` prop'u dışarı açık.
- Var olan bir bileşenle aynı işi yapıyorsa yeni bileşen yazma, var olanı genişlet.
