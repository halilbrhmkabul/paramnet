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

## ADR-014 — Zod şemaları ve terms_hash
- **Tarih:** 2026-10-11
- **Karar:**
	- Bağımlılıklar (`packages/shared` runtime): `zod@^4.6.5` (spec 9.1 formlar + RPC ortak doğrulama), `@noble/hashes@^2.4.0` (saf JS SHA-256; Hermes'te `crypto.subtle` yok, Node/Deno/Hermes aynı sonucu verir, bağımlılığı yok, denetlenmiş).
	- Postgres enum'ları `enums.ts`'de `as const` dizileri; tipler bunlardan türetilir.
	- Zod issue mesajları kullanıcı metni değil **kod**: `required`, `too_long`, `invalid_phone`, `invalid_amount`, `invalid_date`, `invalid_option`, `invalid_id`, `invalid_counterparty`, `invalid_seq`, `paid_exceeds_amount` ve plan hata kodları (ADR-012). Mobil `tr.ts` eşler.
	- Telefon: yalnızca Türkiye cep numarası (`+905XXXXXXXXX`); `0555…`, `90555…`, `555…`, boşluk/tire/parantezli girdiler normalize edilir. Kişi için telefon isteğe bağlı (boş string → `null`).
	- Metinler trim + NFC; isteğe bağlı metin boşsa `null`. Sınırlar: başlık ve ad 80, açıklama ve ödeme notu 500, terms notu 1000.
	- `termsSchema` strict (bilinmeyen anahtar yok; hash her şeyi kapsar), seq 1..n sıralı, BR-03 ve plan kuralları `validatePlan` ile.
	- `termsHash(terms)` = SHA-256(UTF-8(kanonik JSON)) küçük harf hex. Kanonik JSON: anahtarlar sıralı, boşluk yok, string kaçışı `JSON.stringify` ile aynı, yalnızca güvenli tam sayı; boolean/ondalık/undefined hata. plpgsql `jsonb::text` kullanamaz (boşluk ekler, anahtarları önce uzunluğa göre sıralar); string'i elle kurmalı. Vektörler `test-vectors/terms-hash.json` (kanonik string'ler elle yazıldı, hash'ler Python hashlib ile).
- **Açık soru:** Spec 5.2 "verildiği/alındığı tarih" alanı istiyor, şemada karşılığı yok. F1-12 migration'ından önce `agreements.started_on date` gibi bir sütun eklenip eklenmeyeceğine karar verilmeli; şimdilik giriş şemasında yok.

## ADR-015 — Mobil temel yapı
- **Tarih:** 2026-10-11
- **Karar:**
	- Bağımlılıklar: `@tanstack/react-query ~5.103.3` (spec 9.1; en yeni sürüm 2 haftadan genç olduğu için bir önceki), `expo-crypto` (Hermes'te `crypto.randomUUID` yok; idempotency anahtarı için, F1-07'de kullanılacak), `@expo/vector-icons` + `expo-font` (tek ikon seti, Expo Go'da çalışır; expo-doctor peer uyarısı). Zustand ilk yerel UI durumu gerektiğinde (F1-07) eklenecek.
	- Tema: `src/theme/tokens.ts` tek kaynak; `useAppTheme()` sistem açık/koyu temasını izler; navigasyon teması token'lardan.
	- API: `AgreementsApi` arayüzü görünüm modelleri döndürür (türetilmiş taksit durumu, kalan, işaretli kişi bakiyesi). Sahte adaptör tohum verisini **bugüne göre** üretir (gecikmiş, bugün, yaklaşan her zaman görünür), domain hesaplarını yalnızca `@paramnet/shared`'dan yapar, varsayılan 300 ms gecikme ekler, dönen nesneleri JSON kopyasıyla verir. Seçim `createApi()` içinde; Supabase adaptörü F1-17'de.
	- `AmountInput` yazılan metni yerel tutar, dışarıya yalnızca kuruş tam sayı verir; `.` binlik ayraç, ama sona tek `.` yazılırsa (TR dışı klavye) ondalık sayılır. Tam sayı kısmı 13 haneyle sınırlı (güvenli tam sayı).
	- Tarih gösterimi (`10 Kas 2026`, `10 Kasım 2026`) `packages/shared` `formatDateTR` ile, Intl'siz (ADR-010 ile aynı gerekçe).
	- Kök `index` şimdilik `(tabs)`'a yönlendirir; oturum kontrolü F1-06'da.
	- Testler: `src/testing/providers.tsx` (sabit saat 2026-10-11, gecikmesiz sahte adaptör, `gcTime: Infinity` — aksi halde React Query zamanlayıcısı Jest'i açık tutar). RNTL 14'te `fireEvent` beklenir (`await`).

## ADR-016 — Sahte auth ve yönlendirme
- **Tarih:** 2026-10-11
- **Karar:**
	- `AuthApi` arayüzü (`requestOtp`, `verifyOtp`, `updateProfile`, `signOut`); sahte adaptör kodu `123456` (yerel Supabase test koduyla aynı), kod 3 dk geçerli, 60 sn içinde yeniden istek `rate_limited`. Yalnızca TR cep numarası.
	- Oturum `zustand@~5.0.15` store'unda (spec 9.1: yerel UI durumu), yalnızca bellekte; uygulama yeniden açılınca karşılama ekranı. F1-16 Supabase oturumunu SecureStore ile kalıcı yapacak.
	- "Oturum açık" = kullanıcı var **ve** profil + bildirim adımları bitti. Kök Stack'te `Stack.Protected` ile `(tabs)`/`new` ve `(auth)` ayrılır; `(auth)` başlangıç rotası `welcome`. Adı olan dönen kullanıcı profil adımlarını atlar.
	- Bildirim izni `src/lib/notifications.ts` arkasında sahte ("granted"); F1-18'de expo-notifications.
	- Form doğrulama kodları `src/features/forms/fieldError.ts`'de Türkçeye çevrilir. Yeni bileşenler: `TextField`, `Checkbox`. Shared'a `displayNameSchema`.
	- Bekleyen davet varsa Talepler'e yönlendirme (spec 5.1 adım 6) davetler olmadan anlamsız; F2-10'da.

## ADR-017 — Yeni kayıt akışı
- **Tarih:** 2026-10-11
- **Karar:**
	- Bağımlılıklar: `react-hook-form ~7.89.0` + `@hookform/resolvers ~5.9.1` (CLAUDE.md formlar), `@react-native-community/datetimepicker` (Expo SDK uyumlu sürüm, `timeZoneName: Europe/Istanbul`; gün ↔ an dönüşümü İstanbul öğlesiyle), `expo-contacts` (yalnızca `Contact.presentPicker`; tüm rehber okunmaz, izin istenmez). En yeni react-hook-form bugün yayımlandığı için bir önceki sürüm.
	- Form kuralları `features/new/formModel.ts`'de: dört tür → `kind` + rol; plan `generatePlan` ile, plan hataları ilgili alana bağlanır. Borç kayıtlarının başlığı "Borç" (formda ürün alanı yalnızca taksitli türlerde). Tek seferlik borç vadesiz olabilir; taksitliye geçince ilk tarih otomatik dolar.
	- Taslak (tür, form değerleri, idempotency anahtarı, son kullanılan kişi) Zustand'da; anahtar taslak başında bir kez üretilir ve tekrar denemede aynısı gider. Kaydedince taslak sıfırlanır, `router.replace` modalı kapatıp anlaşma ekranını açar.
	- Kişi seçicide rehberden gelen numara kayıtlı bir kişiye aitse o kişi kullanılır; elle eklenen satıcı (Taksitle aldım) `merchant`.
	- Tek uygulama saati `src/lib/clock.ts`; sahte adaptör ve ekranlar aynı "bugün"ü kullanır, testler `jest.setup.tsx`'te 2026-10-11'e sabitler. Jest'te tarih seçici ve rehber seçici mock'lanır.
	- Mock seed ve yeni kayıt ID'leri UUID biçiminde (giriş şemaları `contact_id`'yi UUID olarak doğrular).

## ADR-018 — Anlaşma detayı ve ödeme ekleme
- **Tarih:** 2026-10-11
- **Karar:**
	- `recordPayment(agreementId, input, rowVersion, idempotencyKey)`: sahte adaptör sırayla idempotency → bulunamadı → şema → durum (yalnızca `personal`/`active`, BR-14) → `row_version` (`conflict`) → kalan borç aşımı kontrol eder; kişisel modda ödeme `confirmed`, FIFO dağıtılır, kalan 0 olunca `settled`.
	- Ödeme ekranında idempotency anahtarı ekran açılışında bir kez üretilir. Başarı veya hata sonrası tüm sorgular yenilenir (conflict'te güncel `row_version` gelsin diye).
	- Ödeme tarihi bugünden sonra olamaz (istemci kuralı; spec'te açık değil, sunucu RPC'sinde de uygulanacak).
	- Çevrimdışı tespiti `@react-native-community/netinfo` (Expo SDK sürümü); bilinmeyen durum çevrimiçi sayılır. Yazma butonları kapalı ve neden yazılı (mobil kural 2).
	- Taksit durumu `{ status, partial }` rozetle; ilerleme çubuğu `accessibilityRole="progressbar"` + yüzde.
	- Olay zamanları `formatDateTimeTR` (shared, sabit +03:00).
	- Kapsam dışı: dekont yükleme (Storage gerektirir) ve ödeme sonrası haptic — BACKLOG.

## ADR-019 — Çekirdek şema ve `started_on`
- **Tarih:** 2026-10-11
- **Karar:**
	- `agreements.started_on date null` eklendi (kullanıcı kararı): spec 5.2 formundaki "verildiği / alındığı tarih". Şartların (terms) parçası değil, `terms_hash`'e girmez. Giriş şemasında isteğe bağlı (yoksa `null`); mobil formda yalnızca borç türlerinde, varsayılan bugün; taksitli türlerde `null`.
	- Telefon sütunları `phone_tr` domain'i (`^\+905[0-9]{9}$`), ADR-014 ile aynı kural.
	- Tutarlılık kısıtları DB'de: `outstanding ≤ principal`, `status = settled ⇔ settled_at`, `status = cancelled ⇔ cancelled_at`, `counterparty_profile_id ≠ creator_id` (BR-12), `currency = 'TRY'` (BR-02), `paid ≤ amount`, `decided_by ⇔ decided_at`, metin uzunlukları zod sınırlarıyla aynı.
	- Yalnızca ekleme (BR-13): `agreement_events` güncellenemez/silinemez; `agreement_versions` silinemez ve yalnızca `status` değişebilir (tetikleyici, `P0001`). Hesap silme anonimleştirmesi F3-03'te ayrı bir yolla ele alınacak.
	- Tüm yabancı anahtarlar indeksli (pgTAP genel kontrolü); hatırlatma ve outbox için kısmi indeksler.
	- `invites` ve `rate_limits` Faz 2'de (F2-01) eklenecek; `invite_status` enum'u şimdiden var.
	- RLS her tabloda açık, politika yok; varsayılan Supabase tablo yetkileri F1-13'te daraltılacak.

## ADR-020 — RLS ve tablo yetkileri
- **Tarih:** 2026-10-11
- **Karar:**
	- Supabase'in varsayılan geniş yetkileri kaldırıldı: `anon` hiçbir tabloya erişemez; `authenticated` yalnızca SELECT alır (profiles, contacts, agreements, agreement_versions, installments, payments, payment_allocations, agreement_events, consents). `reminders`, `notification_outbox`, `push_tokens` istemciye tamamen kapalı. `alter default privileges` ile sonraki tablolar/fonksiyonlar da kapalı başlar; her migration ihtiyacını açıkça `grant` eder.
	- Görünürlük: oluşturan her zaman; karşı taraf yalnızca `status <> 'personal'` iken (BR: kişisel mod yalnızca oluşturana). Alt tablolar `private.can_view_agreement(uuid)` (security definer, `private` şeması Data API'de yok) ile; `auth.uid()` `(select …)` içinde.
	- `profiles` yalnızca kendisi. schema.md'deki "ortak anlaşması olanların adı (görünüm)" yerine karşı tarafın adı okuma RPC'lerinden (F1-15) gelir: security definer view açmaktan daha dar yüzey.
	- Not: `supabase migration new` stdin açıkken içerik bekler; betiklerde `< /dev/null` ile çağrılmalı.

## ADR-021 — Kişisel mod RPC'leri ve plpgsql domain mantığı
- **Tarih:** 2026-10-11
- **Karar:**
	- Plan üretimi/doğrulaması, ödeme dağıtımı ve terms hash plpgsql'de `private` şemasında (istemciye kapalı); TS ile aynı hata kodları. `scripts/db-vectors.mjs` (`pnpm db:vectors`) shared test vektörlerini pgTAP dosyasına çevirir; CI, üretilen dosya güncel değilse kırılır. TS'deki satır `index`'i SQL'de hata DETAIL'ında.
	- Hata sözleşmesi: oturum yoksa SQLSTATE `28000` / `not_authenticated`; diğer tüm iş hataları SQLSTATE `P0001`, mesaj = kod (`not_found`, `forbidden`, `invalid_transition`, `conflict`, `amount_exceeds_outstanding`, `validation_error`), ayrıntı DETAIL'da. İstemci mesajdaki koda göre eşler (`src/api/errors.ts`). Görme yetkisi olmayan kayıt için `not_found` (varlığı sızdırılmaz).
	- Girdiler katı: terms tam olarak `{principal_minor, down_payment_minor, plan, notes}` (BR-15), plan satırları `{seq, due_date, amount_minor}` ve seq 1..n; metinler istemcide (zod) kırpılmış + NFC gelmeli, sunucu yalnızca doğrular. Ödeme tarihi Europe/Istanbul bugününden sonra olamaz.
	- `create_agreement`: `agreements.idempotency_key` ile tekrar; başka kullanıcının anahtarı `conflict`. Yeni kişi aynı sahipte aynı numarayla varsa yeniden kullanılır; numara kayıtlı bir profile aitse `linked_profile_id` dolar; kendi numarasıyla kişi reddedilir (BR-12). Peşinat `confirmed` `down_payment` ödemesi, yöntemi `other`, tarihi `started_on` ya da bugün; taksitlere dağıtılmaz.
	- `update_personal_agreement`: yeni versiyon `accepted`, eskisi `superseded`; peşinat değiştirilemez (kayıtlı bir ödeme); onaylı ödemeler (peşinat hariç) ödeme tarihi sırasıyla yeni taksitlere FIFO dağıtılır, eski dağıtımlar geçmiş olarak kalır; yeni toplam ödenenin altına inemez; kalan 0 olursa `settled`.
	- Eşzamanlılık: anlaşma satırı `FOR UPDATE` ile kilitlenir; aynı `row_version` ile gelen ikinci yazma `conflict` alır.
	- plpgsql_check (`supabase db lint`) temiz tutulur: yardımcılar `STABLE`, hata atma satır içi `raise`.

## ADR-022 — Okuma RPC'leri
- **Tarih:** 2026-10-11
- **Karar:**
	- Okuma RPC'leri mobil görünüm modellerini (`apps/mobile/src/api/types.ts`) JSON olarak döndürür; Supabase adaptörü (F1-17) dönüştürme yapmadan kullanır. `get_contact_detail` ROADMAP'te yoktu, mobil `getContact` için eklendi.
	- Bakış açısı: `my_role` çağırana göre (karşı taraf için oluşturanın rolünün tersi). Karşı taraf adı oluşturan için kendi kişi kaydından, karşı taraf için oluşturanın profilinden (ADR-020'deki profil kısıtı bu yolla aşılır); bu durumda `contact_id` null.
	- Bakiyeye ve vadelere sayılan durumlar: `personal`, `active`, `amendment_pending`, `disputed`. `pending`/`countered` henüz kabul edilmemiş, `settled`/`cancelled`/`rejected` kapalı.
	- Takvim, ay içindeki ödenmiş taksitleri de döndürür (durumuyla); Ana Sayfa yalnızca ödenmemişleri.
	- Kişi sıralaması `tr-TR-x-icu` harmanlamasıyla.
	- `private.today()` testlerde `paramnet.today` ayarıyla sabitlenebilir; yalnızca oturum kullanıcısı `postgres` iken geçerli, API istekleri (`authenticator`) için etkisiz.
	- Olay türleri `created`, `payment_recorded`, `updated`, `cancelled`, `settled`; mobil geçmiş ekranı F1-17'de `updated`/`cancelled`'ı da gösterecek.

## ADR-023 — Gerçek auth (Supabase telefon OTP)
- **Tarih:** 2026-10-11
- **Karar:**
	- Bağımlılıklar: `@supabase/supabase-js 2.117.2` (sabit; daha yenisi 2 haftadan genç), `expo-secure-store` (SDK sürümü).
	- Adaptör seçimi `EXPO_PUBLIC_API_MODE` (`mock` varsayılan | `supabase`) + `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_KEY` (yalnızca publishable/anon anahtar). `.env.example` commit'li, `.env.local` değil. Expo Go'dan yerel Supabase'e Mac'in LAN IP'siyle erişilir.
	- Oturum SecureStore'da 1800 karakterlik parçalar halinde (`key.count` + `key.N`); bir parça eksikse oturum yok sayılır. Token yenileme yalnızca uygulama öndeyken (AppState).
	- Açılışta `AuthApi.restore()`; sonuç gelene kadar native splash açık kalır. Profili olmayan oturum profil adımından devam eder.
	- Profil `complete_profile(display_name, kvkk_version, terms_version)` security definer RPC'siyle; numara `auth.users`'tan alınır, istemciden değil. Onay sürümleri `src/lib/legal.ts` (`2026-10`).
	- GoTrue hata eşlemesi: `otp_expired` (yanlış ve süresi dolmuş kod aynı yanıt) → `otp_invalid`; `over_sms_send_rate_limit` → `rate_limited`. RPC hataları `P0001` + mesaj kodu → `ApiError`.
	- Test notu: `jest.setup` `ApiProvider` üzerinden `secureStorage`'ı önceden yüklediği için modül mock'u gereken testler `jest.isolateModules` kullanır.

## ADR-024 — Supabase anlaşma adaptörü
- **Tarih:** 2026-10-11
- **Karar:**
	- `createSupabaseAgreementsApi(client)` yalnızca RPC çağırır; dönüştürme yok (ADR-022). Tip uyumu: karşı taraf görünümünde `contact_id` null olabilir; olay türlerine `updated`, `cancelled` eklendi.
	- Ağ hataları (`TypeError`, postgrest-js'in "Network request failed" mesajı, `AuthRetryableFetchError`) `network` koduna, yani çevrimdışı mesajına eşlenir.
	- Çıkışta React Query önbelleği temizlenir (aynı cihazdaki sonraki hesap önceki verileri görmesin).
	- Entegrasyon testleri `*.integration.test.ts`, ayrı `jest.integration.config.js` ile düz Node ortamında (jest-expo `fetch`'i sahteler); yerel Supabase ve `PARAMNET_SUPABASE_URL/KEY` yoksa atlanır. Normal `pnpm test` bunları çalıştırmaz. CI'a tam Supabase yığınıyla eklenmesi F1-19 faz kapısında değerlendirilecek.

## ADR-025 — Hatırlatmalar ve push
- **Tarih:** 2026-10-11
- **Karar:**
	- Hatırlatma saatleri spec 5.9'dan; saat 10:00 Europe/Istanbul. `reminders` tablosu "gönderildi" kaydıdır (taksit + kişi + tür tekil); pg_cron 15 dakikada bir `private.enqueue_due_reminders(now())` çalıştırır. Bir slot kaçarsa aynı gün 22:00'ye kadar telafi edilir, sonra bırakılır (kayıttan önce geçmiş vadeler için toplu bildirim olmaz). Sessiz saatlerde (22:00–09:00) kuyruğa hiçbir şey girmez. Kapalı/iptal/itirazlı anlaşmalar ve ödenmiş taksitler hariç.
	- Kişisel modda yalnızca oluşturan bildirim alır (rolüne göre); paylaşılmış anlaşmada karşı taraf da.
	- Outbox yükü yalnızca şablon değişkenleri (ad, tutar kuruş, tarih, sıra); not ve serbest metin yok. Metinler edge function'da (copy-tr `notif.*`), uygulama adına; para biçimi uygulamayla aynı (Vitest sözleşme testi).
	- `dispatch-notifications` edge function'ı pg_cron + pg_net ile her dakika (yalnızca bekleyen varsa) çağrılır; URL ve servis anahtarı Vault'ta (`project_url`, `service_role_key`, kurulum `supabase/README.md`). Fonksiyon kendi anahtar kontrolünü yapar (`verify_jwt = false`). Satırlar 5 dakikalık kirayla alınır (çift gönderim yok), en az bir cihaz kabul ederse `sent`, geçici hatada üstel geri çekilme (en çok 5 deneme), `DeviceNotRegistered` token'ları silinir.
	- Mobil: `expo-notifications` + `expo-device`; token yalnızca gerçek cihazda ve EAS proje kimliği varken alınır (yoksa sessizce atlanır). Token oturum açıkken her açılışta yenilenir, çıkışta silinir. Bildirime dokunmak ilgili anlaşmayı açar; uygulama öndeyken banner gösterilir.
	- Edge function'ın saf mantığı `supabase/functions/_shared` altında (Deno API'si yok); `packages/shared` Vitest ile test eder. Giriş dosyaları (`*/index.ts`) ESLint dışında; yerelde `supabase functions serve` ile denenir. Deno yerelde kurulu değil.
	- Kapsam dışı (BACKLOG): anlaşma bazında hatırlatma kapatma, Expo push receipt kontrolü.
- **Ek (2026-10-11):** Expo Go'nun Android sürümünde (SDK 53+) `expo-notifications` içe aktarıldığı anda hata atıyor ve onu içe aktaran rotaları (`_layout`, bildirim ve ayarlar ekranları) düşürüyordu. Modül artık yalnızca `src/lib/notifications.ts` içinde, ilk ihtiyaçta `require` ile yükleniyor; Android'de Expo Go'da hiç yüklenmiyor ve bildirimler sessizce kapalı kalıyor (izin "denied", token yok). Testi `notificationsLoader.test.ts`.

## ADR-026 — Davet altyapısı
- **Tarih:** 2026-10-12
- **Karar:**
	- Token: `gen_random_bytes(32)` → base64url (43 karakter, `=` yok). Saklanan: `sha256(utf8(token))` (bytea, tekil). Düz token yalnızca `share_agreement` yanıtında; DB'de, olaylarda, loglarda yok.
	- `share_agreement(id, phone, row_version)`: yalnızca oluşturan, yalnızca `personal` iken; numara `normalizePhoneTR` ile aynı kuralla normalize edilir, kendi numarası reddedilir (BR-12). Kişinin numarası yoksa paylaşılan numara yazılır ve kayıtlı bir profile aitse bağlanır. Davet 7 gün geçerli; anlaşma `pending`, `pending_version = active_version`, olay `shared`.
	- `withdraw_share(id)` (skill imzası; row_version yok): `pending`/`countered` → `personal`, aktif davetler `revoked`, olay `share_withdrawn`.
	- `private.expire_invites(now)` saatlik pg_cron: süresi dolan aktif davet `expired`, bekleyen anlaşma `personal`, sistem olayı `invite_expired`.
	- Yanıt beklenirken (`pending`) ödeme, düzenleme, yeniden paylaşım yapılamaz (durum makinesinde tanımlı değil).
	- Düzeltme: F1-14'teki `lock_personal_agreement` `not (a or NULL)` yüzünden paylaşılmış ama kabul edilmemiş anlaşmada yabancıya `forbidden` dönüyordu; `private.is_party` null-güvenli kontrolüyle `not_found` döner (yeni migration'da `create or replace`).
- **Açık soru:** Mobil S11'de `pending` için birincil aksiyon "Hatırlat / Linki tekrar paylaş". Token saklanmadığı için tekrar paylaşım yeni token (eskisini `revoked`) demek; bu `pending → pending` geçişi durum makinesinde yok. Eklenmeli mi?

## ADR-027 — Karar RPC'leri
- **Tarih:** 2026-10-12
- **Karar:**
	- Sıra: F2-03, F2-02'den önce yapıldı; `invite-decide` aynı karar mantığını kullanacak.
	- Karar verebilen: anlaşmaya bağlı karşı taraf (`counterparty_profile_id`) ya da henüz bağlı değilse oturumdaki doğrulanmış numarası aktif davetin hedef numarasıyla aynı olan hesap (BR-11). Diğer herkese `not_found`, oluşturana `forbidden`.
	- Her karar `version` + `terms_hash` taşır; bekleyen versiyon ve sunucudaki hash ile eşleşmezse `conflict` (BR-06).
	- `accept`: karşı taraf profile bağlanır, versiyon yürürlüğe girer (`private.activate_version`): versiyon değiştiyse eski `superseded`, yeni taksitler üretilir, onaylı ödemeler (peşinat hariç) FIFO yeniden dağıtılır; kalan 0 ise `settled`. Paylaşım öncesi kişisel moddaki ödemeler korunur.
	- `counter`: yeni versiyon `proposed` (öneren adına), anlaşma `countered`, karşı taraf bağlanır (yanıtı uygulamada görebilsin). Peşinat değişmez, toplam ödenenin altına inemez. Karşı öneriye karşı öneri gelirse önceki öneri `rejected`.
	- `reject`: anlaşma `rejected`, reddeden hesap bağlanmaz ("Bu plan bana ait değil"). Oluşturan `make_personal` ile kişisel moda döner.
	- `decide_counter` yalnızca `accept` / `counter`; oluşturanın "hayır"ı `withdraw_share`.
	- Her kararda aktif davet `consumed` olur; olay kaydında karar verenin doğrulanmış numarası (`actor_phone_e164`).

## ADR-028 — Davet edge function'ları ve web OTP'si
- **Tarih:** 2026-10-12
- **Karar:**
	- Web onayı Supabase Auth'u kullanmaz (davetli hesap açmaz); davete özel OTP: kodu edge function CSPRNG ile üretir (test modunda test numaralarına `123456`), DB yalnızca `sha256(invite_id:code)` saklar, 5 dk geçerli, tek kullanımlık. 5 başarısız doğrulamada davet `locked`.
	- Doğrulama sonucu hata fırlatmak yerine `{ok, error}` döner: fırlatılan hata transaction'ı ve deneme sayacını geri alır, kilit hiç devreye girmezdi.
	- Numara sızdırmama: hedef dışı numaraya da "gönderildi" denir ama kod saklanmaz; o numarayla denemeler yine kilide sayılır. 60 sn yeniden gönderme beklemesi yalnızca hedef numaraya uygulanır (başkası davetliyi geciktiremesin); diğer denemeler `rate_limits` (IP 10/saat, numara 5/saat) ile sınırlı.
	- Onay oturumu: `{invite_id, phone, exp}` HMAC-SHA256 imzalı, 15 dk (`INVITE_SESSION_SECRET`). Çerezde saklamak ve CSRF web uygulamasının işi (F2-04). IP yalnızca anahtarlı hash olarak olay kaydına girer.
	- Web kararı aynı karar çekirdeğinden (`private.apply_decision`) geçer: kanal `web`, aktör yok, doğrulanmış numara kayıtlı bir hesaba aitse hesap hemen bağlanır, değilse F2-10'da.
	- Fonksiyonlar ince; kurallar servis rolüne açık RPC'lerde (`invite_open`, `invite_send_otp`, `invite_verify_otp`, `invite_details`, `invite_decide`). Deno-only yardımcılar `_shared/server.ts`; test edilebilir mantık `_shared/invite.ts`.
	- Turnstile: `TURNSTILE_SECRET_KEY` ile doğrulanır; yalnızca yerelde `TURNSTILE_DISABLED=1`. SMS: sağlayıcı F3-04'e kadar yok, `SMS_MODE=test` yalnızca test numaralarına izin verir; başka her yerde `sms_unavailable` (503).
	- Deno testleri yerine: pgTAP (kurallar) + Vitest (saf mantık) + gerçek yerel yığına karşı entegrasyon testi (CI `integration` işi fonksiyonları `functions serve` ile çalıştırır).
- **Bilinen sınır:** hesabı olmayan davetli web'den düzeltme önerir, oluşturan da karşı öneri yaparsa (pending), davetliye yeni bağlantı gerekir; bu, ADR-026'daki "pending iken yeniden paylaşım" sorusuna bağlı.

## ADR-029 — Web onay sayfası
- **Tarih:** 2026-10-12
- **Karar:**
	- `apps/web-confirm`: Next.js 16.3.6 (en yenisi 2 haftadan genç), React 19.2.3 (mobil ile aynı), `@paramnet/shared` kaynak olarak (`transpilePackages`). Tek rota `/i/[token]` (deep-links.md biçimi); kök 404.
	- Tarayıcı Supabase'e hiç bağlanmaz: tüm çağrılar sunucuda (`src/lib/functions.ts`, `server-only`) edge function'lara; publishable anahtar ve fonksiyon adresi sunucu ortam değişkeni (`FUNCTIONS_URL`, `SUPABASE_PUBLISHABLE_KEY`).
	- Durum geçişleri yalnızca POST (Server Actions): Next'in Origin kontrolüne ek olarak double-submit CSRF token (çerez `proxy.ts`'te, formda gizli alan, sabit süreli karşılaştırma). GET yalnızca okur (`invite-open`).
	- Çerezler: `pn_phone` (10 dk), `pn_session` (onay oturumu, 15 dk), `pn_result` (1 saat) — HttpOnly, SameSite=Strict, `path=/i/<token>`, üretimde Secure. Yenilemede plan `invite-details` fonksiyonuyla oturumdan tekrar alınır.
	- Güvenlik başlıkları (spec 11.2): istek başına nonce'lu CSP (`strict-dynamic`, yalnızca Turnstile dış kaynak, `frame-ancestors 'none'`, `form-action 'self'`), HSTS, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, `X-Frame-Options: DENY`, `no-store`.
	- Düzeltme önerisi web'de: satırların tarih ve tutarları düzenlenir, toplam ve peşinat sabit; `validatePlan` ile sunucuda kontrol, hatalar Türkçe.
	- Turnstile yalnızca `NEXT_PUBLIC_TURNSTILE_SITE_KEY` varken çizilir; yerel testlerde yok (fonksiyon tarafında `TURNSTILE_DISABLED=1`).
	- Playwright (Chromium, Pixel 7 görünümü) üretim derlemesiyle gerçek yerel yığına karşı; CI `integration` işinde.
- **Bilinen sınır (F3-05):** fonksiyonlar IP'yi `cf-connecting-ip` / `x-forwarded-for` başlığından alıyor; doğrudan çağıran biri başlığı değiştirerek IP penceresini aşabilir (numara penceresi ve kilit yine geçerli). Web sunucusu ile fonksiyonlar arasında paylaşılan bir başlık sırrı veya platformun güvenilir istemci IP'si kötüye kullanım testlerinde ele alınacak.

## ADR-030 — Derin bağlantılar
- **Tarih:** 2026-10-12
- **Karar:**
	- Link biçimi `https://<APP_DOMAIN>/i/<token>`; uygulamadaki ekran `/invite/<token>`. Eşleme `app/+native-intent.tsx` `redirectSystemPath` ile (geliştirmede `paramnet://i/<token>` de).
	- Alan adı ve imza bilgileri kodda sabit değil: mobilde `EXPO_PUBLIC_APP_DOMAIN` (`app.config.ts` app.json'ı genişletir), webde `APPLE_TEAM_ID` ve `ANDROID_SHA256_CERT_FINGERPRINTS`. Değer yoksa associated domains/intent filtresi eklenmez ve `.well-known` dosyaları 404 döner (yarım yapılandırma yayınlanmaz).
	- `invite/[token]` rotası oturum korumasının dışında; oturum yoksa token yalnızca bellekte tutulur (kalıcı saklanmaz), kullanıcı karşılama/giriş akışına gider, oturum açılınca aynı davet açılır.

## ADR-031 — Paylaşım ve gelen paylaşım ekranları
- **Tarih:** 2026-10-12
- **Karar:**
	- Uygulamada davet bağlantısı `resolve_invite(token)` ile çözülür: yalnızca doğrulanmış numarası davet hedefi olan hesap anlaşma kimliğini alır; diğerleri yalnızca paylaşanın adını ve "başka numaraya gönderilmiş" bilgisini görür. Uygulamada ikinci OTP istenmez (hesap numarası zaten doğrulanmış, deep-links.md).
	- Karar ekranı tek RPC'den (`get_pending_decision`): sıra kimdeyse (`actor`: counterparty → `decide_agreement`, creator → `decide_counter`) önerilen versiyon + hash, mevcut şartlar ve paylaşım öncesi ödemeler. Uygulamadaki düzeltme önerisi satır bazlı (tarih + tutar), toplam ve peşinat sabit (web ile aynı).
	- `list_requests()` Talepler'in "Paylaşımlar" bölümünü ve Ana Sayfa'daki bekleyen iş sayısını besler (`get_dashboard.pending_count` = onay bekleyen bildirilmiş ödemeler + bekleyen paylaşım kararları).
	- Görünüm modeline `is_creator` eklendi; S11 birincil aksiyonu durum + rol + oluşturan bilgisinden seçilir. `pending` iken oluşturana yeniden paylaşım yok (ADR-026 açık sorusu), yalnızca geri çekme.
	- Paylaşım bağlantısının kökü: `EXPO_PUBLIC_INVITE_BASE_URL` (yerelde web-confirm geliştirme sunucusu) yoksa `https://EXPO_PUBLIC_APP_DOMAIN`; ikisi de yoksa paylaşım yapılır ama bağlantı gösterilemez ve kullanıcıya söylenir. Sahte modda prototip bağlantısı.

## ADR-032 — Paylaşılmış anlaşmada ödemeler
- **Tarih:** 2026-10-12
- **Karar:**
	- `record_payment` tek RPC: kişisel modda sahip ve paylaşılmışta alacaklı `confirmed` (FIFO dağıtım, kalan 0 ise `settled`); borçlu `reported` (dağıtım ve bakiye değişmez, BR-08). Kayıt yalnızca `personal`, `active`, `amendment_pending` iken; `disputed` ve kapalı durumlarda `invalid_transition` (BR-14). Bildirilen tutar da kalan borcu aşamaz.
	- `decide_payment(payment_id, confirm|reject)`: yalnızca alacaklı, kendi bildirmediği `reported` ödeme; aynı karar tekrar gelirse ilk sonuç döner (`replayed`). Onay anında kalan yeniden kontrol edilir (iki bildirim aynı kalanı kapatmaya çalışırsa ikincisi reddedilir). `withdraw_payment`: yalnızca bildiren, yalnızca `reported` iken. Reddedilen/geri çekilen ödemeler silinmez.
	- Karşı tarafa outbox bildirimi: `paymentReported` (alacaklıya), `paymentRecorded` (alacaklı kaydettiğinde borçluya), `paymentConfirmed` / `paymentRejected` (bildirene). Yük: ad, tutar, kalan; not yok. Bağlı hesabı olmayan (yalnızca web'den onaylamış) karşı tarafa bildirim gitmez.
	- `list_requests` artık ödeme taleplerini de döndürür; `get_dashboard.pending_count` = `list_requests` uzunluğu (aynı kalemler, çift sayım yok). Detaydaki ödemelerde `by_me`.
	- "7 gün yanıtsız bildirilen ödeme" hatırlatması F2-11'de.

## ADR-033 — Değişiklik talepleri
- **Tarih:** 2026-10-12
- **Karar:**
	- Öneri tam şartlardır (`{principal, down_payment, plan, notes}`): BR-03 ve `terms_hash` her versiyonda aynı biçimde kalır. Spec'in "yeni plan kalan tutar üzerinden kurulur" kuralı, kabulde onaylı ödemelerin yeni taksitlere FIFO dağıtılmasıyla karşılanır; eski dağıtımlar eski versiyonun taksitlerinde geçmiş olarak kalır. Peşinat değişmez; yeni toplam ödenenin altına inemez.
	- Tek ekran (S15) erteleme, yeniden düzenleme ve tutar düzeltmeyi kapsar: satırların tarih/tutarı değişir, satır eklenir/çıkarılır, yeni toplam = peşinat + satırlar; toplam değişirse kullanıcıya gösterilir. İndirim/af ayrı akış (`forgive_remaining`, F2-09).
	- Tek açık talep (BR-07): `pending_version` doluyken yeni öneri yok. `active` → `amendment_pending`; `disputed` iken öneri durumu değiştirmez ve kabulü itirazı çözer (`active`). Red/geri çekmede `amendment_pending` → `active`, `disputed` aynen kalır. Geri çekilen öneri `superseded` (enum'da `withdrawn` yok).
	- Kararı yalnızca önermeyen taraf verir (`decide_amendment`, versiyon + hash); değişikliğe karşı öneri yok (yeni talep açılır). `amendment_pending` iken ödeme kaydı sürer (eski şartlar geçerli).
	- Bildirimler: `amendmentProposed` (diğer tarafa), `amendmentAccepted` / `amendmentRejected` (önerene).

## ADR-034 — İtiraz, karşılıklı iptal ve indirim
- **Tarih:** 2026-10-12
- **Karar:**
	- İtiraz `disputes` tablosunda tutulur: açan, gerekçe (zorunlu, ≤500), isteğe bağlı ödeme, durum (`open`, `resolved`, `amended`, `closed`). Anlaşma başına tek açık itiraz (kısmi tekil indeks). Tablo istemciye kapalıdır; okumalar `get_agreement_detail` ve `list_requests` üzerinden yapılır.
	- `open_dispute` `active` ve `amendment_pending` iken açılır. Açık öneri yerinde kalır; kabul edilirse itiraz `amended` olarak kapanır ve `dispute_resolved` olayı (`via: amendment`) yazılır. Geri çekmeyi yalnızca açan yapar. Geri çekilince anlaşma `active` olur, açık öneri varsa `amendment_pending`. İtirazlıyken ödeme ve indirim yapılmaz (BR-14); hatırlatma filtresi zaten `disputed` durumunu dışarıda bırakır.
	- Karşılıklı iptal ayrı bir durum değil, anlaşmadaki talep sütunlarıdır (`cancel_requested_by/at`); geçmiş olaylardadır.
		- Talep `active`, `amendment_pending` ve `disputed` iken açılabilir: birlikte iptal, itirazdan çıkış yollarından biridir (spec 5.7 "taraflar uzlaşır").
		- Kararı talep etmeyen taraf verir. Kabul açık itirazı `closed`, açık öneriyi `superseded` yapar ve `cancel_accepted` ile `cancelled` olaylarını yazar.
		- Tekrar eden kabul ilk sonucu döner (BR-09). Talebi geri çekmek bu sürümde yok (BACKLOG).
	- `forgive_remaining(id, amount?)` yalnızca alacaklı içindir (kişisel modda sahip alacaklıysa da). Onaylı `discount` ödemesi olarak kaydedilir; FIFO dağıtılır ve kalan 0 olursa `settled` olur. Tutar boşsa kalanın tamamı alınır. İdempotency anahtarı zorunludur. Borçlunun onayı gerekmez, yalnızca `forgiven` bildirimi gider (spec 5.6). Mobil form kalanla dolu gelir; tutar kalana eşitse sunucuya `null` gider.
	- Talepler'de karşı tarafın açık itirazı ve iptal talebi ayrı bölümlerde listelenir (dashboard sayacı `list_requests` uzunluğundan gelir).

## ADR-035 — Bekleyen davetleri hesaba bağlama
- **Tarih:** 2026-10-13
- **Karar:**
	- Spec 10.4'teki `link-pending-invites` ayrı bir edge function değil, `complete_profile` içinde çağrılan `private.link_pending_invites(uid, phone)` fonksiyonudur. Numara OTP ile doğrulanmış `auth.users` kaydından gelir; servis anahtarı veya ek gizli bilgi gerekmez. Kayıt ile bağlama aynı transaction'da olur, böylece arada bir pencere kalmaz. Fonksiyon idempotenttir; ad değiştirmek için tekrar çağrılması zararsızdır.
	- Bağlanan kayıtlar:
		- Bu numaraya gönderilmiş, kullanılmış davetle web'de onaylanmış veya düzeltme önerilmiş anlaşmaların `counterparty_profile_id` alanı. Web, olmayan bir hesabı bağlayamıyordu.
		- Başka kullanıcıların bu numarayla kaydettiği kişilerin `linked_profile_id` alanı.
	- Bağlanmayanlar:
		- Reddedilen anlaşma ("Bu plan bana ait değil"): web kararındaki gibi bağsız kalır.
		- Açık davetler: zaten numarayla eşleşir (`decision_actor`) ve karar anında bağlanır.
	- Olay kaydı yazılmaz; bu bir durum geçişi değildir.
	- `complete_profile` dönüşüne `pending_requests` (`list_requests` uzunluğu) eklendi. Mobil uygulama sayı 0'dan büyükse kayıt bitince Talepler sekmesini açar (spec 5.1 adım 6). Bekleyen bir davet linki varsa o önceliklidir. Bayrak yalnızca bellekte tutulur.

## ADR-036 — Olay bildirimleri
- **Tarih:** 2026-10-13
- **Karar:**
	- Paylaşım akışı olayları birçok yerden yazılır: uygulama ve web kararları, üç farklı kapanış yolu, süre dolumu işi. Bu yüzden bildirim, `agreement_events` üzerindeki `AFTER INSERT` trigger'ında (`private.notify_agreement_event`) tek yerde üretilir. Kural şu: oluşturanın yaptığı işlemi karşı taraf, diğer her şeyi (uygulama, web, sistem) oluşturan duyar.
	- `settled` olayında, anlaşma paylaşılmışsa iki tarafa da tebrik gider (spec 5.8); kişisel kayıtta bildirim gitmez.
	- Ödeme, değişiklik ve itiraz bildirimleri kendi RPC'lerinde kalır, çünkü tutar ve kalan gibi işleme özgü bilgiler taşırlar.
	- Karar vermemiş karşı tarafın hesabı, davetin gönderildiği numaraya kayıtlı profildir. Hesap yoksa push gitmez; kişi SMS/WhatsApp ile paylaşılan linkle gelir.
	- Ad, alıcının tanıdığı addır: oluşturan için kendi rehberindeki kişi adı, karşı taraf için oluşturanın profil adı (`private.event_payload`).
	- Bildirilen ödeme hatırlatması (spec 5.9) alacaklıya bildirimden 7 gün sonra saat 10:00'da (İstanbul) bir kez gider. Sessiz saatler ve 12 saatlik pencere taksit hatırlatmalarıyla aynıdır. Tekrarı önlemek için `reminders.payment_id` sütunu ve tekil indeks eklendi.
	- Push `data` alanı şablon adını da taşır. Uygulama `shareReceived`, `shareCountered` ve `amendmentProposed` için karar ekranını, `shareWithdrawn` için Talepler'i, diğerleri için anlaşma detayını açar.

## ADR-037 — Hata izleme (Sentry)
- **Tarih:** 2026-10-13
- **Karar:**
	- Bağımlılıklar:
		- mobilde `@sentry/react-native` (`expo install` ile SDK 57 uyumlu `~7.11.0`);
		- web'de `@sentry/nextjs` `11.7.0`;
		- edge'de `npm:@sentry/deno@11.7.0`.
		- Gerekçe: spec 8 "Hata izleme: Sentry (mobil + web + edge)".
		- `@sentry/cli`'nin kurulum betiği (`allowBuilds: false`) şimdilik çalışmıyor; source map yükleme EAS/CI aşamasına kaldı.
	- Kişisel veri: CLAUDE.md'deki kurala göre hiçbir olay telefon, ad, not veya tutar taşımaz.
		- Tek bir saf temizleyici (`scrubTelemetryEvent`) üç ortamda `beforeSend` ve `beforeBreadcrumb` olarak çalışır.
		- Desen maskeleri: telefon, TL tutarı, e-posta, uzun token/JWT. UUID'ler hata ayıklama için korunur.
		- Kişisel/finansal anahtarların değeri `[Filtered]` olur. Kullanıcı yalnızca id'ye, istek yalnızca URL ve yönteme indirilir.
		- Serbest metindeki adlar desenle yakalanamaz; bu yüzden kodda kullanıcı verisi hata mesajına yazılmaz.
	- SDK'lar en dar ayarla açılır:
		- Mobil: `sendDefaultPii: false`, ekran görüntüsü, görünüm hiyerarşisi ve izleme kapalı.
		- Sentry 11'de (web, edge) `dataCollection` ile kullanıcı, çerez, başlık, gövde, sorgu, veritabanı verisi ve yerel değişkenler kapalı.
	- Web onay sayfası telefon ve OTP topladığı için tarayıcıda Sentry yok: yalnızca sunucu hataları (`instrumentation.ts` + `onRequestError`). CSP `connect-src 'self'` olarak kalır.
	- Edge'de `withSentry` yakalanmamış hataları raporlar ve `no-store` 500 döner. `rpcError` yalnızca iş kodu olmayan (P0001 dışı) hataları raporlar. Edge runtime tam Deno olmadığı için varsayılan entegrasyonlar kapalı.
	- DSN yoksa (yerel geliştirme, testler) hiçbiri başlamaz. Değişkenler: `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_DSN` (web sunucusu ve edge), `*_ENV` / `SENTRY_ENVIRONMENT`. Proje AB bölgesinde açılmalıdır (KVKK yurt dışı aktarım, spec 12).

## ADR-038 — Ürün analitiği kendi veritabanımızda
- **Tarih:** 2026-10-13
- **Karar:** Spec 8 "PostHog (AB bölgesi) veya kendi olay tablosu" seçeneklerinden kendi tablomuz seçildi (kullanıcı kararı). Gerekçe:
	- Yeni hizmet, hesap ve ücret yok.
	- Yurt dışı aktarımı için ek bir sağlayıcı yok.
	- Veri ana veriyle aynı yerde kalıyor ve barındırma Türkiye'ye taşınırsa onunla birlikte taşınıyor.
	- Pilot için hazır huni/kohort araçları gerekmiyor. İleride gerekirse PostHog eklenebilir.
- Spec 13.3 olaylarının kaynağı:
	- `agreement_created`: `agreements`. Türü, taksit sayısı ve modu satırdan.
	- `agreement_shared` / `agreement_decided` / `amendment_*` / `dispute_opened` / `agreement_settled`: `agreement_events`. Kanal (app/web) olay satırında.
	- `payment_recorded` / `payment_decided`: `payments` (kimin bildirdiği, durumu).
	- `signup_completed`: `profiles.created_at`. `reminder_sent`: `reminders` (`status = sent`).
	- `app_opened`, `reminder_opened`, `invite_opened`, `invite_otp_verified`: yeni `analytics_events` tablosu.
- Kişisel veri:
	- Olaylarda yalnızca beyaz listedeki ad ve alanlar var: şablon adı (`^[A-Za-z0-9]{1,40}$`) ve kanal.
	- `user_id` takma adlı hesap kimliği; hesap silinince `null` olur (F3-03).
	- Web olayları hesaba değil davete bağlıdır.
- `invite_open` artık davet başına bir analitik satırı yazar (`stable` değil). Davete dokunmadığı için spec 11.2 korunur. İlk açılış bir önizleme botuna ait olabilir; sayı, yaklaşık bir değer olarak okunmalıdır.
- Metrikler `get_metrics(days)` ile hesaplanır, yalnızca servis rolüne açıktır. Oranlar iki ondalık, payda 0 ise `null`. "Haftalık aktif anlaşma" ödeme, onay, değişiklik, itiraz, iptal, indirim ve kapanış olaylarından sayılır.
	- D7 için kaydın 7–14. günlerinde, D30 için 30–37. günlerinde açılış aranır. Yeterince eski kayıt yoksa değer `null`.
	- "İlk kayıt süresi" kayıt anından ölçülür; spec açılıştan ölçer. Açılıştan ölçmek için kayıt öncesi anonim bir olay gerekir; bu, BACKLOG'da.

## ADR-039 — Hesap silme ve veri dışa aktarma
- **Tarih:** 2026-10-13
- **Karar:**
	- Silme iki adımdır:
		1. `delete-account` edge function'ı oturumdaki kullanıcının JWT'sinden kimliği alır (`verify_jwt = true`).
		2. Servis rolüyle `delete_account_data(uid)` çağrılır, ardından GoTrue soft delete yapılır (`auth.admin.deleteUser(id, true)`).
		- Soft delete auth satırını korur, böylece `profiles` ve geçmişin yabancı anahtarları bozulmaz. Numara serbest kalır: aynı numarayla kayıt yeni bir hesaptır.
	- Silinen ve anonimleşen veriler (security.md):
		- Karşı tarafı hesaba bağlı olmayan anlaşmalar yalnızca bu kişinin verisidir; tamamen silinir.
		- Rehber silinir. Korunan anlaşmanın arkasındaki kişi kaydının adı ve numarası silinir.
		- Profil "Silinmiş kullanıcı" olur, numarası silinir (`deleted_at`).
		- Kişinin ödeme notları, ekleri, öneri ve itiraz gerekçeleri silinir.
		- Olay kaydındaki numara, IP ve cihaz izleri silinir.
		- Push token, hatırlatma, bildirim kuyruğu, onay kayıtları ve sayaçlar silinir.
		- Analitik olaylar anonimleşir.
	- Korunanlar: karşı tarafın taraf olduğu anlaşmalar; tutar, tarih, durum, sürümler ve olay sırası. Karşı taraf kendi rehberindeki adı görmeye devam eder; uygulamayı kullanan taraf ise "Silinmiş kullanıcı"yı görür. Başkalarının bu kişi için kaydettiği kişi kayıtları onların verisidir; yalnızca hesap bağlantısı kalkar.
	- BR-13 istisnası: append-only tetikleyicileri yalnızca `paramnet.erasure` transaction ayarı açıkken silme ve güncellemeye izin verir. Sürümlerdeki onaylanmış şartlar (`terms`, `terms_hash`) silmede de değişmez; yalnızca gerekçe boşaltılabilir.
	- Dışa aktarma (KVKK m.11): `export_my_data()` uygulamanın okuduğu biçimde tüm veriyi döndürür. Mobil uygulama bunu sistem paylaşım sayfasıyla JSON metni olarak verir; yeni bağımlılık yok. Dosya olarak kaydetme BACKLOG'da.
	- KVKK aydınlatma metni ve kullanım koşulları `tr.ts`'te taslak olarak duruyor; ekranda "taslak" uyarısı var. Metinler değişince `KVKK_VERSION` / `TERMS_VERSION` artırılır.

## ADR-040 — SMS katmanı ve Send SMS Hook
- **Tarih:** 2026-10-13
- **Karar:**
	- Giriş kodu Supabase Auth Send SMS Hook (HTTP) ile `send-sms-hook` edge function'ına gelir. İstek Standard Webhooks imzasıyla doğrulanır (`npm:standardwebhooks@1.0.0`, Supabase'in önerdiği kütüphane); sır `SEND_SMS_HOOK_SECRET`. Web onayındaki OTP de aynı gönderim katmanını kullanır. Böylece tek sağlayıcı, tek bütçe ve tek log politikası olur.
	- Sağlayıcı değiştirilebilir (spec 8): saf `_shared/sms.ts` her sağlayıcı için istek kurar ve yanıtı çözer; `smsSender.ts` `SMS_MODE`'a göre seçer.
		- İlk adaptör Netgsm (Türkiye'de yaygın, OTP'ye özel uç noktası var). Uç nokta, alan adları ve yanıt kodları sağlayıcının entegrasyon rehberine göre yazıldı, ama herkese açık kaynaklarda tam teyit edilemedi.
		- Bu yüzden ilk gerçek hesapla, canlıdan önce doğrulanacak; değişiklik yalnızca `sms.ts`'teki adaptörü ve testlerini etkiler.
		- Başka sağlayıcı (ör. İleti Merkezi) aynı arayüzle eklenir.
	- Modlar:
		- `test`: SMS yok; yalnızca yerel test numaraları.
		- `log`: kod fonksiyon log'una yazılır. Yalnızca yerel yığında (`SUPABASE_URL` yerel değilse reddedilir), böylece üretimde kod log'a düşemez.
		- `netgsm`: gerçek gönderim.
	- Loglarda numara maskeli (`+90******1234`). Sağlayıcı hataları Sentry'ye yalnızca hata koduyla gider. 80 (limit) ve 100 (sistem) yeniden denenebilir sayılır; tekrar denemeyi Auth/kullanıcı yapar, fonksiyon kendisi denemez.
	- CLI, telefonla girişi yalnızca bir sağlayıcı bloğu etkinse açtığından, yerel `config.toml`'da Twilio yer tutucusu kalıyor. Hook etkinken Auth onu hiç çağırmaz.
	- Yerel hook sırrı yalnızca bu makine için üretilmiş bir değerdir (`config.toml` ve `.env.example`'da aynı). Üretimde Dashboard yeni bir sır üretir.

## ADR-041 — SMS bütçesi ve bağımlılık denetimi
- **Tarih:** 2026-10-13
- **Karar:**
	- Her SMS göndermeden önce `take_sms_budget(channel, phone, daily_limit)` (yalnızca servis rolü) çağrılır.
		- Numara başına saatte 5 SMS. Auth ve davet ortak; SMS pumping ve tek numaraya taciz için. Anahtar numaranın SHA-256'sı.
		- İstanbul gününe göre günlük toplam sayaç (`sms_usage`). Sınırı geçen istek reddedilir.
		- Alarm Sentry'ye günde iki kez gider: sınırın %80'inde ve ilk retteki (`sms-budget` etiketi).
		- Bütçe yanıtı alınamazsa gönderim yapılmaz (kapalı kalır).
		- `test` modunda SMS gitmediği için bütçe sorulmaz.
	- Sınıra takılan davet isteği 429 alır. Auth hook'un 429'u istemciye GoTrue tarafından genel hata (500) olarak iletilir; uygulama genel hata mesajı gösterir.
	- `pnpm audit --audit-level high` CI'da çalışır. Yaması olmayan veya uyumsuz bulgular `pnpm-workspace.yaml` `auditConfig.ignoreGhsas`'ta gerekçeleriyle tutulur ve Expo/Metro güncellendiğinde yeniden değerlendirilir.
		- node-forge, braces, sprintf-js, uuid: yalnızca derleme/test araçları.
		- decode-uri-component uygulamada (expo-router/query-string); düzeltmesi yalnızca ESM olduğu için bozar. Bu yüzden `+native-intent` 512 karakterden uzun linkleri router'a vermez.

## ADR-042 — EAS build ve mağaza yapılandırması
- **Tarih:** 2026-10-13
- **Karar:**
	- Üç profil: `development` (dev client, dahili dağıtım), `preview` (dahili dağıtım, mağaza dışı deneme) ve `production` (mağaza). Her profil EAS ortamını adıyla kullanır (`environment`).
		- Tüm `EXPO_PUBLIC_*` değerleri EAS ortam değişkenlerindedir; `eas.json`'da değer ya da sır yoktur (test bunu denetler).
		- Sürüm numaraları EAS'ta tutulur (`appVersionSource: remote`); production build numarasını kendisi artırır.
	- Android gönderimi `alpha` (kapalı test) kanalına `draft` olarak yapılır; yayına alma kararı Play Console'da kalır. İlk AAB'nin Play'e elle yüklenmesi gerekir.
	- `expo-dev-client` eklendi. Gerekçe: Android'de uzak push ve uygulama derin bağlantıları development build ister. Varsayılan geliştirme akışı Expo Go olarak kalır (`expo start --go`).
	- iOS export compliance: uygulama yalnızca standart HTTPS/TLS kullanır → `usesNonExemptEncryption: false`.
	- Rehber yalnızca okunur. Türkçe izin metni `src/i18n/permissions.json`'da: `app.config.ts` başka TS dosyası içe aktaramadığı için JSON, `tr.ts` aynı dosyayı kullanır. Android'de `WRITE_CONTACTS` engellenir.
	- EAS Update ve EAS Workflows kurulmadı (BACKLOG). Sentry source map yükleme de EAS hesabı açılınca eklenecek (F3-01 BACKLOG maddesi).

## ADR-043 — Tasarım ("Orman Defteri") ve kapsam
- **Tarih:** 2026-10-13
- **Karar:**
	- Kullanıcının tasarım kanvası (43 ekran) görsel dilin kaynağıdır: renkler, Manrope ve IBM Plex Mono, bileşen ölçüleri. Kanvastaki "30 · Tasarım Sistemi" `tokens.ts` ve `design-tokens.md` ile birebir eşlenir.
	- Kapsam spec'te kalır (kullanıcı kararı). Tasarımdaki kişisel finans modülleri spec 15'e göre sonraki sürümlerin işi; BACKLOG'a yazıldı:
		- kartlar, ekstre ve kart ödemesi;
		- banka kredileri ve hesaplar/cüzdan;
		- gelir-gider, tekrarlayan işlem, bütçe, aylık rapor;
		- hesap bölme.
	- "Faiz Simülasyonu" ekranı uygulanmaz: kesin kural ("Faiz yok", BR-15).
	- Tasarımdaki ama veri modelinde olmayan kavramlar bu sürümde yok; ayrı karar ister (BACKLOG):
		- ParamNet ID (PN-xxxxxx);
		- kabulden sonra "para teslimi bekleniyor" durumu;
		- karşı taraftan "Para iste";
		- ödemelerin bir banka hesabının bakiyesine yazılması.
	- Koyu tema tasarımda yok; spec ve mobil skill'i gereği aynı tonlardan türetildi ve kontrastı testle doğrulandı.
	- Sekmeler: Ana · Borçlarım · (+) · Talepler · Takvim (F3-11). Kişiler ayrı sekme olmaktan çıkar.
	- Marka ikonu ve açılış görseli tasarımdaki logodan üretilecek (1024 px PNG); şimdilik yalnızca arka plan renkleri markada.
