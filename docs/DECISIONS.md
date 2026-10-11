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

## ADR-005 — Uygulama kimliği: `com.paramnet.app`
- **Tarih:** 2026-10-11
- **Bağlam:** S-01 iOS bundle ID ve Android paket adı ister; mağaza yayınından sonra değiştirilemez.
- **Karar:** iOS `bundleIdentifier` ve Android `package` = `com.paramnet.app`. Ad `Paramnet`, slug `paramnet`, şema `paramnet`.
- **Sonuç:** ADR-004'teki marka/alan adı araştırması olumsuz çıkarsa mağaza yayınından önce değiştirilmeli.

## ADR-006 — Test araçları: shared Vitest, mobile Jest (jest-expo)
- **Tarih:** 2026-10-11
- **Bağlam:** Spec 16 domain için Vitest, mobil bileşen için RNTL öngörüyor; RN/Expo dönüşümleri Jest ekosisteminde destekleniyor.
- **Karar:** `packages/shared` → Vitest. `apps/mobile` → Jest + `jest-expo` preset + `@testing-library/react-native` 14 (+ `test-renderer ~1.2`, React 19.2 uyumu için). Testler `apps/mobile/src/**/__tests__/` altında (`app/` yalnızca rotalar). Ekran testleri `expo-router/testing-library`'deki `renderRouter` ile layout içinde render edilir. `pnpm test` kökten ikisini birden çalıştırır.
- **Sonuç:** Not: `renderRouter` sonucunun `getPathname`/`toHavePathname` eki RNTL 14'ün async `render`'ıyla çalışmıyor (expo-router 57.0.25); yol kontrolü gerekirse ayrıca çözülecek.

## ADR-007 — Monorepo ayrıntıları
- **Tarih:** 2026-10-11
- **Karar:**
	- Rotalar `apps/mobile/app/` (paramnet-mobile skill yapısı), diğer kod `apps/mobile/src/`; `@/*` → `src/*`. Expo şablonunun `src/app` varsayılanı kullanılmadı.
	- `@paramnet/shared` build adımı olmayan kaynak paketidir (`exports` → `src/index.ts`); Metro, Jest ve Vitest TS kaynağını doğrudan okur.
	- pnpm varsayılan (isolated) node-linker; `node-linker=hoisted` gerekmedi (expo-doctor 21/21, iOS bundle başarılı).
	- pnpm'in otomatik kurduğu opsiyonel peer'lar en yeni sürümü seçip SDK ile çakıştığı için Expo şablonunun pinlediği paketler (react-dom, react-native-web, reanimated, worklets, gesture-handler) ve `@react-native/metro-config` (RN sürümüne eşit) açıkça bağımlılıkta tutulur.
	- Araç sürümleri Expo SDK 57 ile uyumlu tutulur: TypeScript ~6.0 (7 değil), ESLint 9 (eslint-config-expo eklentileri 10'u desteklemiyor).
	- `unrs-resolver` kurulum script'i reddedildi (`allowBuilds`); native binary optional bağımlılıkla geliyor.
	- Yalnızca iOS ve Android hedeflenir (`platforms`); web hedefi yok.

## ADR-008 — CI: GitHub Actions
- **Tarih:** 2026-10-11
- **Karar:** `.github/workflows/ci.yml`, her PR'da ve `main`'e push'ta tek iş: `pnpm install --frozen-lockfile` → `typecheck` → `lint` → `format:check` → `test`. Node sürümü `.nvmrc`'den, pnpm sürümü `packageManager` alanından okunur (tek kaynak). Yetki `contents: read`; aynı ref'te eski çalışma iptal edilir.
- **Sonuç:** `format:check` görev tanımında yoktu, düşük maliyetli olduğu için eklendi. Veritabanı testleri (`supabase test db`) S-03 sonrası ayrı adım olarak eklenecek.

## ADR-009 — Yerel Supabase ve veritabanı testleri
- **Tarih:** 2026-10-11
- **Karar:**
	- Supabase CLI kökte sabit sürümlü devDependency (`supabase@2.120.0`, `allowBuilds` ile binary indirmesine izin). Global kurulum yok; yerel ve CI aynı sürümü kullanır.
	- `config.toml`: e-posta kaydı kapalı, telefon kaydı ve doğrulaması açık. `[auth.sms.test_otp]`: `905550000001/2/3` → `123456`. Auth, test numaraları için bile etkin bir SMS sağlayıcısı istediğinden yerelde Twilio sahte değerlerle açık (gerçek anahtar yok; test dışı numaralar hata verir). Üretimde Send SMS Hook (spec 9). Yerelde `[analytics]` kapalı.
	- pgTAP testleri `supabase/tests/database/`. `000_smoke` public şemada RLS'siz tablo kalmadığını kalıcı olarak denetler.
	- Tipler `pnpm db:types` ile yalnızca `public` şemasından `packages/shared/src/db.types.ts`'e üretilir, prettier'dan geçirilip commit'lenir; ESLint dışında tutulur.
	- CI'da ayrı `db` işi: `supabase db start` (yalnızca Postgres) + `supabase test db`.
- **Sonuç:** Tiplerin şemayla güncel olup olmadığı CI'da denetlenmiyor; gerekirse F1-12'de eklenir.
