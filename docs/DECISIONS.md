# Teknik Kararlar (ADR)

Biçim: her karar için tarih, bağlam, karar, sonuç. Yeni kararlar en alta eklenir; eski kararlar silinmez, gerekirse "yerini aldı: ADR-00X" notu düşülür.

---

## ADR-001 — Monorepo (pnpm workspaces)
- **Tarih:** 2026-10-11
- **Bağlam:** Mobil uygulama, web onay sayfası ve veritabanı aynı domain mantığını (plan üretimi, ödeme dağıtımı, terms_hash, zod şemaları) paylaşıyor.
- **Karar:** `apps/mobile`, `apps/web-confirm`, `packages/shared`, `supabase/` tek repoda. Spec 9.4'teki klasör yapısı `apps/mobile` altına taşınır.
- **Sonuç:** Domain mantığı tek yerde, iki istemci aynı sonucu üretir. Expo'nun monorepo gereksinimlerine (Metro yapılandırması, gerekirse hoisted node_modules) uyulmalı.

## ADR-002 — Önce sahte veriyle mobil prototip
- **Tarih:** 2026-10-11
- **Bağlam:** Faz 0'da kullanıcı görüşmeleri için tıklanabilir prototip gerekiyor; ayrıca backend ile UI'ı paralel risk almadan ilerletmek isteniyor.
- **Karar:** Domain çekirdeğinden sonra mobil ekranlar `src/api` arayüzünün sahte adaptörüyle yazılır; backend sonra eklenir ve yalnızca adaptör değiştirilir.
- **Sonuç:** Prototip görüşmelerde kullanılır; ekran kodu atılmaz. `src/api` arayüzü sahte ve gerçek adaptör için ortak olmalı.

## ADR-003 — Para kuruş cinsinden tam sayı
- **Tarih:** 2026-10-11
- **Karar:** Veritabanında `bigint`, TS'de tam sayı `number` (güvenli aralık kontrolüyle). Ondalık tip kullanılmaz.
- **Sonuç:** Yuvarlama hataları ortadan kalkar; biçimlendirme yalnızca gösterim katmanında.

## ADR-004 — Uygulama adı: Paramnet
- **Tarih:** 2026-10-11
- **Karar:** Uygulamanın adı Paramnet. Bundle/paket kimliği, derin bağlantı şeması (`paramnet://`, yalnızca geliştirme) ve mağaza adı buna göre belirlenir.
- **Açık iş:** TÜRKPATENT'te 9. ve 36. sınıflarda marka araştırması, alan adı ve mağaza adı uygunluğu (Faz 0). Benzer adlı yerleşik fintech markaları (ör. Param) nedeniyle karıştırılma riski değerlendirilmeli.
