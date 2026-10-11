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

## ADR-010 — `formatTRY` / `parseTRY` Intl kullanmadan, elle
- **Tarih:** 2026-10-11
- **Bağlam:** Gösterim her yerde birebir `12.000,00 TL` olmalı. `Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" })` Node'da `₺12.000,00` üretir; Hermes'te Intl platform ICU'suna bağlıdır ve ayraç/boşluk karakterleri cihaza göre değişebilir. Intl ayrıca `number` ister, bu da kuruşu 100'e bölüp ondalığa geçmek demektir (BR-01).
- **Karar:** `formatTRY` kuruşun rakam dizisi üzerinde çalışır (son 2 hane kuruş, kalan 3'lü gruplanır, `.` binlik, `,` ondalık, normal boşluk + `TL`). Negatif değer yalnızca gösterim için `-` önekiyle biçimlenir (ör. plan farkı). `parseTRY` katıdır: `.` yalnızca geçerli 3'lü binlik grubu, `,` ondalık, en fazla 2 ondalık, baştaki sıfır yok, isteğe bağlı `TL` son eki; negatif, boş ve güvenli tam sayı aralığı dışı reddedilir. Sonuç `{ ok, value | error }` döner. Sıfır biçim düzeyinde geçerlidir; "tutar > 0" kuralı zod şemalarında (F1-04) uygulanır. `MinorAmount` düz `number` (branded değil).
- **Sonuç:** Node, Hermes ve Deno aynı çıktıyı verir; `parseTRY(formatTRY(x)) === x`. Yazım sırasındaki ara durumları (`12,`) `AmountInput` ele almalı.

## ADR-011 — İstanbul günü sabit UTC+03:00 ile hesaplanır
- **Tarih:** 2026-10-11
- **Bağlam:** BR-16 vade ve "bugün" hesaplarını Europe/Istanbul gününe bağlar. Hermes'te `Intl.DateTimeFormat` `timeZone` desteğine güvenmek istemiyoruz; yalnızca bunun için tarih kütüphanesi (date-fns-tz vb.) eklemek gereksiz.
- **Karar:** Türkiye 2016'dan beri yaz saati uygulamadan UTC+03:00'te; `todayInIstanbul` sabit +3 saat ofsetle hesaplar. Takvim tarihleri `"YYYY-MM-DD"` string'i (`IsoDate`) olarak taşınır; `addDays` ve `addMonthsClamped` saat dilimine dokunmaz. Tarih kütüphanesi eklenmedi.
- **Sonuç:** Bir Vitest testi 2026–2030 aralığında sonucu Node'un IANA `Europe/Istanbul` verisiyle karşılaştırır; Türkiye saat politikasını değiştirirse test kırılır ve tek sabit güncellenir. Geçmiş (2016 öncesi) anlar için doğru değildir; kullanım yalnızca "şimdi".

## ADR-012 — Ödeme planı üretimi ve doğrulaması
- **Tarih:** 2026-10-11
- **Bağlam:** Spec 5.2 ve BR-03 eşit taksit, yuvarlama, periyot ve eşit olmayan plan kurallarını verir; peşinat sınırları, taksit sayısı üst sınırı, "özel" periyodun anlamı ve vadesiz çok taksitli plan açıkta kalıyordu. Aynı mantık ileride plpgsql'de de olacak (skill ilke 8).
- **Karar:**
	- `generatePlan` (aylık, haftalık, iki haftalık) ve `validatePlan` (eşit olmayan plan). "Özel" periyot bir üretici değildir: kullanıcı satırları düzenler, `validatePlan` doğrular. Şemada periyot saklanmaz; plan yalnızca satırlardır.
	- Hata dönüşü throw değil result tipi (`{ ok, plan } | { ok: false, error, index? }`), `parseTRY` ile aynı desen. `index` `validatePlan`'da ilk hatalı satırdır. Kodlar: `invalid_principal`, `invalid_down_payment`, `down_payment_too_large`, `invalid_count`, `count_exceeds_remaining`, `invalid_due_date`, `due_date_required`, `empty_plan`, `non_positive_installment`, `sum_mismatch`, `dates_not_ascending`. Kontrol sırası: tutarlar → taksit sayısı → tarih; satırlarda tutar → tarih → sıra; toplam en sonda.
	- Peşinat 0 olabilir; peşinat ≥ anapara reddedilir (en az bir taksit > 0). Taksit sayısı 1–120. Kalan < taksit sayısı reddedilir (taksit 0 kuruşa düşmez, sayı sessizce azaltılmaz).
	- Vade yalnızca tek taksitli planda boş olabilir. Geçmiş tarihli ilk vade plan katmanında reddedilmez (eski borç kaydı meşru).
	- Satır şekli `terms.plan` ile aynı: `{ seq, due_date, amount_minor }` (snake_case); terms hash (F1-04) ve plpgsql vektörleri eşleyicisiz kullanır.
	- Ortak test vektörleri `packages/shared/test-vectors/plan.json`; beklenen değerler elle yazılmıştır, Vitest şimdi okur, pgTAP plan üreticisi aynı dosyayla doğrulanacak.
	- `fast-check` yalnızca `packages/shared` devDependency (özellik testleri; F1-03'te de kullanılacak).
- **Sonuç:** Hata kodları F1-04 zod şemalarına ve mobil `tr.ts` metinlerine eşlenecek; ad değişikliği iki yeri etkiler.

## ADR-013 — Ödeme dağıtımı ve türetilmiş taksit durumu
- **Tarih:** 2026-10-11
- **Karar:**
	- `allocatePayment(installments, amount)` seq sırasıyla FIFO dağıtır; yalnızca pozitif pay alan taksitleri `{ seq, amount_minor }` olarak döndürür. Kullanıcı girdisi hataları result tipiyle (`invalid_amount`, `amount_exceeds_outstanding` — skill hata koduyla aynı); veritabanından gelen bozuk taksit (`paid > amount` vb.) `RangeError` fırlatır.
	- `installmentStatus` `{ status: upcoming | due_today | overdue | paid, partial }` döndürür: spec 8.4'te `partial` diğer durumlarla birlikte gösterilen bir işarettir. Vadesiz taksit `upcoming`.
	- `outstanding` = anapara − `confirmed` ödemeler (payment, down_payment, discount); negatif olursa `RangeError` (BR-04 yukarıda bozulmuş demektir). `reportedTotal` onay bekleyen tutarı ayrıca verir.
	- Ortak vektörler `packages/shared/test-vectors/allocation.json`.
	- Belirli taksite yönlendirme (spec 5.5 gelişmiş seçenek) bu görevde yapılmadı; BACKLOG'a yazıldı.
