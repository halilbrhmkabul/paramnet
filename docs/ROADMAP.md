# Yol Haritası ve Görev Listesi

Durum işaretleri: `[ ]` yapılmadı · `[~]` devam ediyor · `[x]` tamamlandı · `[!]` engellendi (notu yaz)

Kural: Görevler sırayla yapılır. Her görev tek oturum, tek plan, tek commit. Faz kapısı geçilmeden sonraki faza başlanmaz.

Sıralama mantığı: Önce saf domain mantığı, sonra **sahte (mock) veriyle çalışan mobil prototip**, ardından gerçek backend. Prototip hem kullanıcı görüşmelerinde (Faz 0 doğrulaması) kullanılır hem de backend bağlandığında aynen kalır; yalnızca `src/api` katmanının sahte adaptörü gerçeğiyle değiştirilir.

---

## Faz S — Kurulum

### [x] S-01 Monorepo iskeleti ve araçlar
- pnpm workspaces: `apps/mobile`, `packages/shared`, `supabase/` (web-confirm Faz 2'de).
- `apps/mobile`: Expo (güncel SDK) + TypeScript strict + Expo Router. Expo monorepo rehberine uy (expo skill).
- Uygulama kimliği: ad `Paramnet`, slug `paramnet`, şema `paramnet`. iOS bundle ID / Android paket adı (ör. `com.<şirket>.paramnet`) kullanıcıya sorulur; karar DECISIONS.md'ye yazılır.
- Kök: TypeScript, ESLint, Prettier (`useTabs: true`), `.editorconfig` (indent_style = tab), Vitest.
- `.gitignore`, `.env.example` (`EXPO_PUBLIC_API_MODE=mock`, `EXPO_PUBLIC_APP_DOMAIN=`, Supabase URL/anon key yer tutucuları).
- **Kabul:** `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test` kökten çalışıyor; mobil uygulama simülatörde/Expo Go'da boş ekranla açılıyor. CLAUDE.md "Komutlar" tablosu güncellendi.
- **Skill:** expo, react-native-best-practices
- **Not (2026-10-11):** Expo SDK 57, RN 0.86, TS 6.0, ESLint 9. Bundle ID `com.paramnet.app` (ADR-005), test araçları ADR-006, monorepo ayrıntıları ADR-007. Expo Go'da açılış kullanıcı tarafından telefonda doğrulandı (SDK 57 destekleniyor).

### [x] S-02 CI
- GitHub Actions: install → typecheck → lint → test (packages/shared + mobile). Veritabanı testleri S-03 sonrası eklenir.
- **Kabul:** PR açıldığında iş akışı yeşil.
- **Not (2026-10-11):** `.github/workflows/ci.yml`; `format:check` adımı da eklendi (ADR-008).

### [x] S-03 Yerel Supabase
- `supabase init`, `config.toml` (auth: telefon girişi açık, yerel test OTP numaraları tanımlı), pgTAP etkin, `supabase test db` çalışıyor (örnek test).
- DB tip üretimi script'i (`supabase gen types` → `packages/shared/src/db.types.ts`).
- **Kabul:** `supabase start` ve `supabase test db` başarılı; tip üretimi çalışıyor. Komutlar CLAUDE.md'de.
- **Skill:** supabase, supabase-postgres-best-practices
- **Önkoşul:** Docker çalışıyor olmalı.
- **Not (2026-10-11):** Supabase CLI 2.120.0 kök devDependency. Test telefonları ve sahte Twilio sağlayıcısı `config.toml`'da; pgTAP RLS koruma testi; CI'a `db` işi eklendi (ADR-009).

---

## Faz 1A — Domain çekirdeği

### [x] F1-01 Para ve tarih yardımcıları (`packages/shared`)
- `money.ts`: kuruş tipi, toplama/çıkarma, `formatTRY(12000_00) → "12.000,00 TL"`, `parseTRY("12.000,50")`.
- `dates.ts`: Europe/Istanbul gün hesabı, `addMonthsClamped` (31 Ocak + 1 ay → 28/29 Şubat).
- **Kabul:** Vitest birim testleri; sınır durumları (0, negatif reddi, büyük tutarlar, ay sonu, artık yıl).
- **Spec:** BR-01, BR-16
- **Not (2026-10-11):** `formatTRY`/`parseTRY` elle (ADR-010), `todayInIstanbul` sabit +03:00 (ADR-011). Ek olarak `addDays`, `isIsoDate`, `addMinor`/`subtractMinor`. Tarih kütüphanesi eklenmedi.

### [x] F1-02 Ödeme planı üretimi
- `generatePlan({ principal, downPayment, count, period, firstDueDate })` → taksit listesi. Eşit bölme, yuvarlama farkı son taksite. Tek seferlik ve vadesiz destek. Özel (eşit olmayan) plan doğrulaması.
- **Kabul:** Özellik tabanlı testler (fast-check): taksit toplamı + peşinat = anapara her zaman; tüm tutarlar > 0; tarihler artan.
- **Spec:** 5.2 "Ödeme planı oluşturma kuralları", BR-03
- **Not (2026-10-11):** `generatePlan` + `validatePlan` (eşit olmayan plan), result tipi ve hata kodları, en fazla 120 taksit (ADR-012). Ortak test vektörleri `packages/shared/test-vectors/plan.json` (plpgsql tarafı da kullanacak). fast-check 4.10 devDependency.

### [x] F1-03 Ödeme dağıtımı ve türetilmiş durumlar
- `allocatePayment(installments, amount)` FIFO; kısmi; fazlası sonraki taksitlere; kalan borçtan fazlası hata.
- `installmentStatus(installment, today)` → upcoming / due_today / overdue / partial / paid.
- `outstanding(agreement, payments)`.
- **Kabul:** Özellik testleri: dağıtım toplamı = ödeme; kalan hiç negatif değil.
- **Spec:** 5.5 "Ödemenin taksitlere dağıtımı", 8.4, BR-04
- **Not (2026-10-11):** `allocatePayment` result tipi (`invalid_amount`, `amount_exceeds_outstanding`), `installmentStatus` → `{ status, partial }`, `outstanding` + `reportedTotal` (ADR-013). Ortak vektörler `test-vectors/allocation.json`. Taksite yönlendirme yapılmadı (BACKLOG).

### [x] F1-04 Zod şemaları ve domain tipleri
- Agreement, Version terms, Installment, Payment, Contact girdileri için zod şemaları (form ve RPC ortak kullanacak).
- `termsHash(terms)`: kanonik JSON + SHA-256 (istemci ve sunucu aynı sonucu üretmeli; test vektörleri dosyası oluştur).
- **Kabul:** Testler; test vektörleri `packages/shared/test-vectors/terms-hash.json`.
- **Not (2026-10-11):** `enums.ts` (DB enum'ları), `schemas.ts` (terms, contact, create agreement, payment, installment; hata mesajları kod), `termsHash` = SHA-256(kanonik JSON) hex (ADR-014). zod 4.6, @noble/hashes 2.4. Açık soru: spec 5.2'deki "verildiği tarih" alanının şemada karşılığı yok (F1-12 öncesi karar).

---

## Faz 1B — Mobil prototip (sahte veri)

### [x] F1-05 Mobil temel yapı
- Expo Router: `(auth)` ve `(tabs)` grupları, 4 sekme + ortada "+" butonu.
- Tema: `paramnet-mobile/references/design-tokens.md`'deki token'lar, açık/koyu tema.
- `src/i18n/tr.ts` (copy-tr.md'den), `src/api/` katmanı: **arayüz + sahte adaptör** (bellek içi örnek veri), TanStack Query hook'ları.
- Ortak bileşenler: Button, AmountText, AmountInput, Card, StatusBadge, EmptyState, ErrorState, ListItem.
- **Kabul:** Uygulama açılıyor, sekmeler arası geçiş, açık/koyu tema; bileşenlerin RNTL testleri.
- **Skill:** paramnet-mobile, expo (expo-router, expo-native-ui), platform-design-skills
- **Not (2026-10-11):** Rotalar `(auth)`, `(tabs)` (4 sekme + ortada "+" → `new` modal), sekme ekranları iskelet; Talepler Faz 1 boş durumu. `src/theme` (token + `useAppTheme`), `src/i18n/tr.ts` + `fill`, `src/api` (arayüz, bugüne göre tohumlanan sahte adaptör, TanStack Query hook'ları, `errors.ts`), bileşenler + `LoadingState`, `Screen`, `ScreenTitle`. Shared'a `formatDateTR`, `monthOf`, `daysOfMonth`, `isoWeekday`. iOS/Android bundle ve expo-doctor 21/21 (ADR-015).

### [x] F1-06 Kayıt ve giriş ekranları (S01–S04) — sahte auth
- Karşılama, telefon, OTP (sahte doğrulama), profil + bildirim izni ekranı.
- **Kabul:** Akış baştan sona tıklanabiliyor; hata durumları (yanlış kod, süre dolumu) görünüyor.
- **Not (2026-10-11):** Karşılama (3 kart, atlanabilir) → telefon (+90 sabit, TR cep) → OTP (`123456`, 3 dk geçerlilik, 60 sn yeniden gönderme, hatalı/süresi dolmuş) → profil (ad + KVKK) → bildirim izni (sahte). `Stack.Protected` ile yönlendirme, oturum Zustand'da bellekte (ADR-016). Bekleyen davet varsa Talepler'e yönlendirme Faz 2'ye (F2-10) kaldı.

### [x] F1-07 Yeni kayıt akışı (S08–S10)
- Tür seçimi (4 seçenek), dinamik form, kişi seçici (rehber + elle), plan önizleme ve satır düzenleme.
- **Kabul:** Mobilya örneği (28.000 / 8.000 peşinat / 5 taksit) önizlemede doğru; form doğrulama mesajları Türkçe.
- **Not (2026-10-11):** S08 dört kart → S09 türe göre form (react-hook-form + `validateForm`, plan hataları ilgili alana) + kişi seçici (kayıtlı kişiler, son kullanılan önde, rehberden seçme, elle ekleme) → S10 plan önizleme (satır satır tutar/tarih düzenleme, fark mesajı, "Eşit dağıt") → kaydet → geçici anlaşma ekranı. Sahte adaptör `createAgreement` (idempotent, şemayla doğrular). "Verildiği tarih" alanı şemada olmadığı için formda yok (ADR-014 açık soru). (ADR-017)

### [x] F1-08 Ana Sayfa, Kişiler, Kişi detay (S05–S07)
- Özet kartları, yaklaşan vadeler, bekleyen işler bandı; kişi bazında net bakiye.
- **Kabul:** Sahte veriyle doğru toplamlar; boş durumlar.
- **Not (2026-10-11):** Ana Sayfa: selamlama, 4 özet kartı, gecikenler, yaklaşan 5 vade, bekleyen işler bandı (Faz 1'de 0 olduğundan görünmez), boş durumda 3 hızlı şablon; Kişiler: arama, işaretli net bakiye; Kişi detay: net bakiye, kayıtlar, bu kişiyle yeni kayıt. Ortak `DueItemRow`, `AgreementRow`. Testlerde kök layout'a hazır adaptör `provideTestApi` ile verilir.

### [ ] F1-09 Anlaşma detay, ödeme ekle, geçmiş (S11, S12, S17)
- Durum etiketi, ilerleme, taksitler, ödemeler, zaman çizelgesi; ödeme ekleme ve dağıtım önizlemesi.
- **Kabul:** Ödeme eklenince bakiye ve taksit durumları anında güncelleniyor (sahte adaptör).

### [ ] F1-10 Takvim (S18) ve Profil (S20 iskelet)
- **Kabul:** Ay görünümü, gün seçimi, gecikenler işaretli.

### [ ] F1-11 Prototip kapısı (Faz 0 doğrulaması için)
- Paylaş butonu ve web onay ekranının görsel taslağı (sahte; gerçek link yok).
- Development build veya Expo Go ile telefonda çalışan sürüm.
- **Kabul:** Kullanıcı görüşmelerinde gösterilebilir prototip. Görüşme sonuçlarına göre ROADMAP güncellenir.

---

## Faz 1C — Gerçek backend (kişisel mod)

### [ ] F1-12 Şema migration'ı
- Enum'lar, tablolar (profiles, contacts, agreements, agreement_versions, installments, payments, payment_allocations, agreement_events, reminders, notification_outbox, push_tokens, consents), indeksler, kısıtlar.
- **Kabul:** pgTAP: tablolar, kısıtlar (tutar > 0, UNIQUE idempotency_key vb.).
- **Skill:** paramnet-domain, supabase-postgres-best-practices

### [ ] F1-13 RLS politikaları
- Okuma: taraf olan görür; kişisel mod yalnızca oluşturan; contacts yalnızca sahibi. Yazma: istemciye tamamen kapalı.
- **Kabul:** pgTAP: iki kullanıcıyla izinli/izinsiz okuma, doğrudan insert/update reddi.

### [ ] F1-14 Kişisel mod RPC'leri
- `create_agreement`, `update_personal_agreement`, `record_payment` (kişisel), `cancel_agreement` (kişisel), otomatik `settled`.
- `FOR UPDATE`, `row_version`, idempotency, olay kaydı. Plan ve dağıtım mantığı `packages/shared` test vektörleriyle aynı sonucu vermeli.
- **Kabul:** pgTAP: her geçiş, idempotent tekrar, eşzamanlı ödeme, kalan borçtan fazla ödeme reddi.

### [ ] F1-15 Okuma RPC'leri
- `get_dashboard`, `get_calendar(month)`, `get_agreement_detail(id)`, `list_contacts_with_balance`.
- **Kabul:** pgTAP + performans için indeks kontrolü.

### [ ] F1-16 Gerçek auth
- Supabase telefon OTP (yerelde test numaraları), oturumun SecureStore'da saklanması, profil oluşturma, KVKK onayı kaydı (`consents`).
- **Kabul:** Simülatörde gerçek yerel auth ile giriş/çıkış.

### [ ] F1-17 Sahte adaptörü gerçeğiyle değiştir
- `src/api` gerçek Supabase RPC adaptörü; hata eşleme (409 conflict → yeniden çek), çevrimdışı davranış (yazma butonları devre dışı).
- **Kabul:** F1-06…F1-10 akışları gerçek yerel backend ile çalışıyor.

### [ ] F1-18 Push ve hatırlatmalar
- Push token kaydı, `notification_outbox`, `dispatch-notifications` edge function, `schedule-reminders` pg_cron işi, sessiz saatler.
- **Kabul:** Yerelde zamanı ileri alınmış bir vade için bildirim cihaza düşüyor.

### [ ] F1-19 Faz 1 kapısı
- Maestro: kayıt → anlaşma → ödeme → kapanış akışı.
- **Kabul (spec 15):** Kişisel modda anlaşma oluştur, öde, kapat; hatırlatma telefona düşüyor. Tüm testler yeşil.
- **Skill:** maestro-mobile-testing — yüklü değil; spec 18.7 Faz 2'de kurulumu öngörüyor, bu görevden önce kurulmalı.

---

## Faz 2 — Karşılıklı akış

### [ ] F2-01 Davet altyapısı
- `invites` tablosu, `share_agreement` (256-bit token, yalnızca hash saklanır, düz token bir kez döner), `withdraw_share`, `expire-invites` cron.
- **Kabul:** pgTAP: token hash, süre sonu, geri çekme, kendine paylaşım reddi (BR-12).

### [ ] F2-02 Davet edge function'ları
- `invite-open`, `invite-otp-send` (rate limit, yalnızca +90), `invite-otp-verify` (5 deneme, 5 dk), `invite-decide`.
- **Kabul:** Deno testleri; GET hiçbir durum değiştirmiyor; yanlış numara onaylayamıyor.
- **Skill:** paramnet-domain (references/security.md)

### [ ] F2-03 Karar RPC'leri
- `decide_agreement` (accept / counter / reject), versiyon + terms_hash kontrolü, karşı tarafın profile bağlanması.
- **Kabul:** pgTAP: eski versiyonu onaylama reddi; tüm geçişler.

### [ ] F2-04 Web onay sayfası (`apps/web-confirm`, W01–W04)
- Next.js tek rota, Turnstile, CSRF, güvenlik başlıkları (HSTS, no-referrer, noindex, CSP).
- **Kabul:** Playwright: tüm senaryolar; link önizleme botu simülasyonu daveti tüketmiyor.

### [ ] F2-05 Derin bağlantılar
- Universal Links (AASA) ve App Links (assetlinks.json), `app/invite/[token].tsx`.
- **Kabul:** Uygulama yüklüyken link uygulamayı açıyor; değilse web sayfası.
- **Skill:** expo (expo-app-clip — AASA bölümü), paramnet-mobile (deep-links.md)

### [ ] F2-06 Paylaşım ve gelen paylaşım ekranları (S13, S14)

### [ ] F2-07 Ödeme bildirimi ve doğrulama
- `record_payment` (borçlu → reported), `decide_payment`, `withdraw_payment`; Talepler ekranı (S19).

### [ ] F2-08 Değişiklik talepleri (S15)
- `propose_amendment`, `decide_amendment`, taksitlerin yeniden üretilmesi, geçmiş ödemelerin korunması.

### [ ] F2-09 İtiraz ve karşılıklı iptal (S16)
- `open_dispute`, `resolve_dispute`, `request_cancel`, `decide_cancel`, `forgive_remaining`.

### [ ] F2-10 Bekleyen davetleri hesaba bağlama
- `link-pending-invites` (yeni kayıtta numaraya bekleyen davetler).

### [ ] F2-11 Bildirim şablonları
- Tüm olay bildirimleri, copy-tr.md tonunda.

### [ ] F2-12 Faz 2 kapısı
- Güvenlik taraması (claude-security), iki cihazla (biri uygulamasız) uçtan uca senaryolar, Maestro + Playwright.
- **Kabul (spec 15):** İki taraf aynı bakiyeyi görüyor; spec 16 "Kritik test senaryoları"nın tamamı geçiyor.

---

## Faz 3 — Pilot ve yayın

### [ ] F3-01 Gözlemlenebilirlik: Sentry (mobil, web, edge)
### [ ] F3-02 Analitik olayları (spec 13.3) ve basit metrik paneli
### [ ] F3-03 KVKK: aydınlatma metni ekranları, hesap silme, veri dışa aktarma
### [ ] F3-04 Yerli SMS sağlayıcı: Send SMS Hook
### [ ] F3-05 Kötüye kullanım testleri: OTP, rate limit, SMS bütçe alarmı; bağımlılık denetimi (supply-chain-risk-auditor, insecure-defaults)
### [ ] F3-06 EAS: build profilleri, TestFlight ve Play kapalı test (eas-app-stores, eas-workflows)
### [ ] F3-07 Mağaza materyalleri: metinler, ekran görüntüleri, gizlilik bildirimleri (aso-skills)
### [ ] F3-08 Pilot (30–50 kişi), metrik takibi, hata düzeltme
### [ ] F3-09 Faz 3 kapısı: mağaza yayını
