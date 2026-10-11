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
