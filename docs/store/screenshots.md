# Mağaza ekran görüntüleri planı (F3-07)

Görüntüler son tasarım uygulandıktan sonra, gerçek cihazda veya simülatörde, demo verisiyle çekilir. `EXPO_PUBLIC_API_MODE=mock`; seed: Ahmet Yılmaz, Zeynep Arslan. Gerçek kişi adı ve numarası kullanılmaz.

Boyutlar:
- **App Store:** 6.9" iPhone (1320×2868) zorunlu; diğer boyutlar ondan ölçeklenir. iPad yok (`supportsTablet: false`).
- **Google Play:** telefon, en az 1080 px kısa kenar (ör. 1080×2400), 2–8 görüntü.
- **Play öne çıkan görsel:** 1024×500.

| # | Ekran (rota) | Gösterilecek durum | Üst yazı (TR) |
|---|---|---|---|
| 1 | Ana sayfa `(tabs)/index` | Alacak/borç özeti, yaklaşan vadeler | Kim kime ne kadar borçlu, tek bakışta |
| 2 | Yeni kayıt `new` | Taksit planı önizlemesi (5 taksit) | Taksit planını saniyeler içinde kur |
| 3 | Anlaşma detayı `agreement/[id]` | İlerleme çubuğu, taksit listesi | Kalan tutar hep güncel |
| 4 | Web onay sayfası (web-confirm) | Planı onayla ekranı | Karşı taraf uygulama indirmeden onaylasın |
| 5 | Talepler `(tabs)/requests` | Bildirilen ödeme onay bekliyor | Ödemeyi iki taraf birlikte doğrular |
| 6 | Takvim `(tabs)/calendar` | Bu ayın vadeleri | Hatırlatmayı Paramnet yapar |

Açık ve koyu temadan biri seçilir; tüm görüntüler aynı temada olmalı. Durum çubuğunda saat 09:41, tam pil ve operatör adı yok (simülatör: `xcrun simctl status_bar booted override ...`).
