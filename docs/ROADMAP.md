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

### [x] F1-09 Anlaşma detay, ödeme ekle, geçmiş (S11, S12, S17)
- Durum etiketi, ilerleme, taksitler, ödemeler, zaman çizelgesi; ödeme ekleme ve dağıtım önizlemesi.
- **Kabul:** Ödeme eklenince bakiye ve taksit durumları anında güncelleniyor (sahte adaptör).
- **Not (2026-10-11):** Detay: üst kart (karşı taraf, rol, kalan, ilerleme, toplam, durum, "Yalnızca sen görüyorsun"), birincil aksiyon Ödeme ekle (çevrimdışı kapalı + neden), taksitler, ödemeler, kapandı mesajı; ödeme: tutar, tarih (gelecek olamaz), yöntem, not, FIFO dağıtım önizlemesi, kalan borç aşımı; geçmiş: olay zaman çizelgesi. Sahte `recordPayment` (idempotent, row_version, BR-14). Dekont ve haptic BACKLOG'da (ADR-018).

### [x] F1-10 Takvim (S18) ve Profil (S20 iskelet)
- **Kabul:** Ay görünümü, gün seçimi, gecikenler işaretli.
- **Not (2026-10-11):** Takvim: pazartesiyle başlayan ay ızgarası, önceki/sonraki ay, vade noktası (en acil durumun rengi + erişilebilir etiket "…, gecikmiş var"), bugün seçili, gün listesi. Profil: Ana Sayfa avatarından açılır; ad, numara, gelecek maddeler "Yakında", çıkış. Kök Stack'te detay rotalarının korunması düzeltildi (ödeme, geçmiş, kişi, ayarlar artık `Stack.Protected` içinde).

### [ ] F1-11 Prototip kapısı (Faz 0 doğrulaması için)
- Paylaş butonu ve web onay ekranının görsel taslağı (sahte; gerçek link yok).
- Development build veya Expo Go ile telefonda çalışan sürüm.
- **Kabul:** Kullanıcı görüşmelerinde gösterilebilir prototip. Görüşme sonuçlarına göre ROADMAP güncellenir.
- **Durum (2026-10-11):** Kod tarafı bitti, kapı açık. Kişisel anlaşmada ikincil "Paylaş" → S13 taslağı (numara kontrolü, mesaj önizlemesi, sistem paylaşım menüsü, yer tutucu link) → "Karşı taraf ne görecek?" W01/W03 taslağı (doğrulama öncesi tutar yok, sonrası plan + 3 karar butonu, pasif). iOS/Android bundle ve expo-doctor 21/21 geçti.
- **Karar (2026-10-11, kullanıcı):** Kapı ertelendi; görüşmeler beklenirken Faz 1C'ye geçildi. Görüşme sonuçları gelince ROADMAP güncellenir.
- **Kapıyı kapatmak için (kullanıcı):** `pnpm mobile` ile Expo Go'da telefonda baştan sona dene (kayıt `123456`, yeni kayıt, ödeme, takvim, paylaş taslağı); görüşmeleri yap; sonuçlara göre ROADMAP'i güncelle ve bu görevi `[x]` yap.

---

## Faz 1C — Gerçek backend (kişisel mod)

### [x] F1-12 Şema migration'ı
- Enum'lar, tablolar (profiles, contacts, agreements, agreement_versions, installments, payments, payment_allocations, agreement_events, reminders, notification_outbox, push_tokens, consents), indeksler, kısıtlar.
- **Kabul:** pgTAP: tablolar, kısıtlar (tutar > 0, UNIQUE idempotency_key vb.).
- **Skill:** paramnet-domain, supabase-postgres-best-practices
- **Not (2026-10-11):** `20261011194806_core_schema.sql`: 10 enum, `phone_tr` domain, 12 tablo, tüm FK'ler indeksli, kısıtlar (tutar > 0, kalan ≤ anapara, durum ↔ zaman damgası, BR-12, TRY), yalnızca-ekleme tetikleyicileri (olaylar; versiyonda yalnızca durum değişir), RLS açık + politika yok. `agreements.started_on` eklendi (ADR-019). pgTAP 49 test; `db lint` temiz; `db.types.ts` yenilendi.

### [x] F1-13 RLS politikaları
- Okuma: taraf olan görür; kişisel mod yalnızca oluşturan; contacts yalnızca sahibi. Yazma: istemciye tamamen kapalı.
- **Kabul:** pgTAP: iki kullanıcıyla izinli/izinsiz okuma, doğrudan insert/update reddi.
- **Not (2026-10-11):** Tablolarda `anon`'a hiçbir yetki, `authenticated`'a yalnızca SELECT (outbox, reminders, push_tokens hiç); varsayılan yetkiler kapalı. Politikalar: anlaşma = oluşturan veya (karşı taraf ve kişisel değil); alt tablolar `private.can_view_agreement`; kişi, profil, onay = yalnızca sahibi. Başkalarının adı okuma RPC'lerinden (ADR-020). pgTAP 34 test (A/B/C kullanıcıları, anon, yazma reddi).

### [x] F1-14 Kişisel mod RPC'leri
- `create_agreement`, `update_personal_agreement`, `record_payment` (kişisel), `cancel_agreement` (kişisel), otomatik `settled`.
- `FOR UPDATE`, `row_version`, idempotency, olay kaydı. Plan ve dağıtım mantığı `packages/shared` test vektörleriyle aynı sonucu vermeli.
- **Kabul:** pgTAP: her geçiş, idempotent tekrar, eşzamanlı ödeme, kalan borçtan fazla ödeme reddi.
- **Not (2026-10-11):** `private.generate_plan/validate_plan/allocate_payment/canonical_json/terms_hash` plpgsql'de; `pnpm db:vectors` shared JSON vektörlerinden `030_domain_vectors.test.sql` üretir (56 kontrol, CI güncelliğini denetler). RPC'ler: `create_agreement` (idempotent, kişi oluşturma/yeniden kullanma, profil bağlama, peşinat), `record_payment` (FOR UPDATE, row_version, FIFO dağıtım, otomatik settled), `update_personal_agreement` (yeni versiyon, peşinat sabit, ödemeler yeniden dağıtılır), `cancel_agreement`. pgTAP 54 test; eşzamanlılık tek oturumda eski row_version ile simüle edildi. `db lint` temiz (ADR-021).

### [x] F1-15 Okuma RPC'leri
- `get_dashboard`, `get_calendar(month)`, `get_agreement_detail(id)`, `list_contacts_with_balance`.
- **Kabul:** pgTAP + performans için indeks kontrolü.
- **Not (2026-10-11):** `get_dashboard`, `get_calendar`, `get_agreement_detail`, `list_contacts_with_balance` + `get_contact_detail` (mobil `getContact` için). Mobil görünüm modelleriyle birebir JSON; rol ve karşı taraf çağıranın bakış açısından. pgTAP 35 test, mobil sahte adaptörün demo verisiyle aynı sayılar; okuma indeksleri doğrulandı (ADR-022).

### [x] F1-16 Gerçek auth
- Supabase telefon OTP (yerelde test numaraları), oturumun SecureStore'da saklanması, profil oluşturma, KVKK onayı kaydı (`consents`).
- **Kabul:** Simülatörde gerçek yerel auth ile giriş/çıkış.
- **Not (2026-10-11):** `EXPO_PUBLIC_API_MODE=supabase` ile Supabase telefon OTP; oturum SecureStore'da parçalı (`chunkedSecureStorage`), açılışta geri yüklenir (splash açık kalır); `complete_profile` RPC profil + KVKK/koşullar onayı (`consents`). OTP/RPC protokolü yerel Supabase'e karşı Node ile doğrulandı; adaptör birim testli. **Cihazda doğrulanmadı:** `.env.local` ile Expo Go'da `+905550000001` / `123456` giriş-çıkış elle denenmeli (ADR-023).

### [x] F1-17 Sahte adaptörü gerçeğiyle değiştir
- `src/api` gerçek Supabase RPC adaptörü; hata eşleme (409 conflict → yeniden çek), çevrimdışı davranış (yazma butonları devre dışı).
- **Kabul:** F1-06…F1-10 akışları gerçek yerel backend ile çalışıyor.
- **Not (2026-10-11):** `createSupabaseAgreementsApi` RPC'leri çağırır (okuma RPC'leri görünüm modelini döndürür); `EXPO_PUBLIC_API_MODE=supabase` ile seçilir. Hata eşleme (P0001 kodları, ağ hatası → çevrimdışı mesajı; conflict sonrası sorgular yenilenir). Çıkışta sorgu önbelleği temizlenir. Entegrasyon testi (`pnpm --filter mobile test:integration`, yerel Supabase) giriş, profil, kayıt, idempotent tekrar, ödeme, conflict, kalan aşımı, kişi, takvim, yetkisiz okuma akışını gerçek backend'le doğruladı. **Cihazda doğrulanmadı:** ekran akışlarını `.env.local` (supabase modu) ile Expo Go'da elle dene (ADR-024).

### [x] F1-18 Push ve hatırlatmalar
- Push token kaydı, `notification_outbox`, `dispatch-notifications` edge function, `schedule-reminders` pg_cron işi, sessiz saatler.
- **Kabul:** Yerelde zamanı ileri alınmış bir vade için bildirim cihaza düşüyor.
- **Not (2026-10-11):** `enqueue_due_reminders` (spec 5.9: −3 gün borçlu, vade günü iki taraf, +1 gün borçlu, +7 gün iki taraf; 10:00 İstanbul; sessiz saatler; tekrar yok; geçmiş hatırlatmalar sonradan gitmez), `notification_outbox` + servis rolüne açık `claim/finish_notifications`, `register/unregister_push_token`, pg_cron işleri, `dispatch-notifications` edge function (Expo Push, DeviceNotRegistered temizliği, üstel geri çekilme). pgTAP 29 + Vitest 10. Yerelde edge runtime + sahte Expo sunucusuyla ve pg_cron/pg_net/Vault yoluyla uçtan uca doğrulandı. Mobil: izin, token kaydı/silme, bildirime dokununca anlaşma. **Cihaza push doğrulanmadı:** EAS proje kimliği (F3-06) ve iOS'ta Expo Go / Android'de development build gerekir. Anlaşma bazında hatırlatma kapatma BACKLOG'da (ADR-025).

### [ ] F1-19 Faz 1 kapısı
- Maestro: kayıt → anlaşma → ödeme → kapanış akışı.
- **Kabul (spec 15):** Kişisel modda anlaşma oluştur, öde, kapat; hatırlatma telefona düşüyor. Tüm testler yeşil.
- **Skill:** maestro-mobile-testing — yüklü değil; spec 18.7 Faz 2'de kurulumu öngörüyor, bu görevden önce kurulmalı.
- **Durum (2026-10-12):** Kapı açık; kullanıcı kararıyla ertelendi, Faz 2'ye geçildi. Hazır olanlar: `apps/mobile/.maestro/` (onboarding, create-loan, create-installment, record-payment, subflows/login; **hiçbir cihazda çalıştırılmadı**), `pnpm --filter mobile e2e`; CI'da `integration` işi tam yerel Supabase yığınıyla mobil adaptör entegrasyon testini çalıştırıyor.
- **Kapıyı kapatmak için (kullanıcı):** Maestro CLI + simülatör/emülatör veya development build (EAS, `eas init` → `extra.eas.projectId`); akışları çalıştır ve düzelt; Vault sırlarıyla zamanı ileri alınmış bir vade için bildirimin telefona düştüğünü gör (supabase/README.md).

---

## Faz 2 — Karşılıklı akış

### [x] F2-01 Davet altyapısı
- `invites` tablosu, `share_agreement` (256-bit token, yalnızca hash saklanır, düz token bir kez döner), `withdraw_share`, `expire-invites` cron.
- **Kabul:** pgTAP: token hash, süre sonu, geri çekme, kendine paylaşım reddi (BR-12).
- **Not (2026-10-12):** `invites` (istemciye kapalı), `share_agreement` (32 bayt token base64url, yalnızca sha256 saklanır, düz token bir kez döner; TR cep, kendine paylaşım yok; kişiye numara yazılır ve profile bağlanır), `withdraw_share` (pending/countered → personal), `expire_invites` + saatlik cron (7 gün → personal). Ek düzeltme: F1-14 kilit fonksiyonundaki NULL karşılaştırması (yabancı `forbidden` yerine `not_found` alır). pgTAP 32 test. **Açık soru:** pending iken "linki tekrar paylaş" yeni token gerektirir; durum makinesinde pending → pending geçişi yok (ADR-026).

### [x] F2-02 Davet edge function'ları
- `invite-open`, `invite-otp-send` (rate limit, yalnızca +90), `invite-otp-verify` (5 deneme, 5 dk), `invite-decide`.
- **Kabul:** Deno testleri; GET hiçbir durum değiştirmiyor; yanlış numara onaylayamıyor.
- **Skill:** paramnet-domain (references/security.md)
- **Not (2026-10-12):** `invite-open` (yalnızca GET, yan etkisiz, yalnızca oluşturanın adı), `invite-otp-send` (Turnstile, IP/numara pencereleri, hedef numaraya 60 sn bekleme; başka numaraya aynı yanıt ama kod yok), `invite-otp-verify` (5 dk kod, 5 hatada `locked`, 15 dk HMAC imzalı onay oturumu + plan ayrıntısı), `invite-decide` (web kanalı, numara + IP hash + user agent kanıtı). Kurallar servis rolüne açık RPC'lerde (pgTAP 34), saf mantık `_shared/invite.ts` (Vitest), akış gerçek yerel yığına karşı entegrasyon testiyle (CI `integration` işinde de). Deno testleri yerine bu üçlü (Deno kurulu değil). Gerçek SMS F3-04'e kadar yok: yalnızca test numaraları (ADR-028).

### [x] F2-03 Karar RPC'leri
- `decide_agreement` (accept / counter / reject), versiyon + terms_hash kontrolü, karşı tarafın profile bağlanması.
- **Kabul:** pgTAP: eski versiyonu onaylama reddi; tüm geçişler.
- **Not (2026-10-12):** F2-02'den önce yapıldı (invite-decide bu RPC'lere dayanır). `decide_agreement` (accept / counter / reject; karar veren: bağlı karşı taraf veya doğrulanmış numarası davet hedefiyle eşleşen hesap), `decide_counter` (accept / counter), `make_personal`; versiyon + terms_hash kontrolü (BR-06), kabulde profile bağlanma, yeni versiyonda ödemelerin yeniden dağıtılması. pgTAP 37 test (ADR-027).

### [x] F2-04 Web onay sayfası (`apps/web-confirm`, W01–W04)
- Next.js tek rota, Turnstile, CSRF, güvenlik başlıkları (HSTS, no-referrer, noindex, CSP).
- **Kabul:** Playwright: tüm senaryolar; link önizleme botu simülasyonu daveti tüketmiyor.
- **Not (2026-10-12):** Next.js 16 (App Router) tek rota `/i/[token]`: W01 (yalnızca ad, numara, Turnstile), W02 (kod), W03 (plan, önceki ödemeler, Onayla / Düzeltme öner (satır düzenleme, toplam sabit) / Bu plan bana ait değil), W04 (sonuç + uygulama çağrısı). Sunucu tarafı Server Actions + double-submit CSRF; onay oturumu ve adım çerezleri HttpOnly, SameSite=Strict, davet yoluna sınırlı. Başlıklar: nonce'lu CSP, HSTS, no-referrer, noindex, DENY. Yenilemede ayrıntı için `invite-details` fonksiyonu eklendi. Playwright 7 senaryo (gerçek yerel yığın; önizleme botu GET'leri daveti tüketmiyor) CI `integration` işinde (ADR-029).

### [x] F2-05 Derin bağlantılar
- Universal Links (AASA) ve App Links (assetlinks.json), `app/invite/[token].tsx`.
- **Kabul:** Uygulama yüklüyken link uygulamayı açıyor; değilse web sayfası.
- **Skill:** expo (expo-app-clip — AASA bölümü), paramnet-mobile (deep-links.md)
- **Not (2026-10-12):** Web: `/.well-known/apple-app-site-association` (yalnızca `/i/*`) ve `assetlinks.json`, ortam değişkenlerinden (`APPLE_TEAM_ID`, `ANDROID_SHA256_CERT_FINGERPRINTS`), yoksa 404. Mobil: `app.config.ts` (`EXPO_PUBLIC_APP_DOMAIN` varsa associatedDomains + autoVerify intent filtresi), `+native-intent` `/i/<token>` → `/invite/<token>`, oturumsuz açılışta token bellekte tutulur ve girişten sonra davete dönülür. **Doğrulanmadı:** alan adı, Apple Team ID, imza parmak izi yok; cihazda link → uygulama açılışı elle denenmeli. Davet ekranının içeriği F2-06'da.

### [x] F2-06 Paylaşım ve gelen paylaşım ekranları (S13, S14)
- **Not (2026-10-12):** S13 gerçek paylaşım (`share_agreement`, bağlantı `EXPO_PUBLIC_INVITE_BASE_URL` / `EXPO_PUBLIC_APP_DOMAIN` ile, sistem paylaşım menüsü); S14 karar ekranı (`get_pending_decision`: önerilen ve mevcut şartlar, önceki ödemeler; Onayla / satır düzenleyerek Düzeltme öner / Reddet; oluşturan için Öneriyi kabul et / Düzeltme / Paylaşımı geri çek); uygulamadaki davet bağlantısı `resolve_invite` (başka numaraya ayrıntı yok); Talepler "Paylaşımlar" (`list_requests`) ve Ana Sayfa bandı; anlaşma detayında pending/countered/rejected aksiyonları (`is_creator`). Sahte adaptörde gelen paylaşım demosu (Zeynep Arslan). pgTAP 23 + RNTL (ADR-031).

### [x] F2-07 Ödeme bildirimi ve doğrulama
- `record_payment` (borçlu → reported), `decide_payment`, `withdraw_payment`; Talepler ekranı (S19).
- **Not (2026-10-12):** `record_payment` paylaşılmış anlaşmada: alacaklı → `confirmed` (borçluya bilgi), borçlu → `reported` (bakiyeden düşmez, alacaklıya onay isteği); `disputed`/kapalıda yok. `decide_payment` (confirm / reject, tekrar eden karar idempotent, onay anında kalan kontrolü), `withdraw_payment`; olaylar ve outbox bildirimleri (şablonlar `_shared/notifications.ts`). Talepler "Ödemeler" bölümü, Ana Sayfa bandı aynı listeden (çift sayım düzeltildi). Mobil: "Ödeme aldım / Ödeme yaptım", "… onay bekliyor", Onayla / Bu ödemeyi almadım / Bildirimi geri çek. pgTAP 36 + Vitest + RNTL (ADR-032).

### [x] F2-08 Değişiklik talepleri (S15)
- `propose_amendment`, `decide_amendment`, taksitlerin yeniden üretilmesi, geçmiş ödemelerin korunması.
- **Not (2026-10-12):** `propose_amendment` (tam şartlar + isteğe bağlı gerekçe, tek açık talep BR-07, active → amendment_pending, itirazlıyken de), `decide_amendment` (diğer taraf; kabulde yeni taksitler ve onaylı ödemelerin yeniden dağıtımı, itirazı da çözer; redde eski versiyon), `withdraw_amendment` (öneren). Bildirimler ve olaylar; Talepler "Değişiklikler"; detayda `pending_by_me`. Mobil S15: plan satır satır düzenlenir, taksit eklenir/çıkarılır, yeni toplam satırlardan; karar ekranı değişiklik modunda gerekçe + mevcut/önerilen karşılaştırma, yalnızca kabul/red. pgTAP 32 + Vitest + RNTL (ADR-033).

### [x] F2-09 İtiraz ve karşılıklı iptal (S16)
- `open_dispute`, `resolve_dispute`, `request_cancel`, `decide_cancel`, `forgive_remaining`.
- **Not (2026-10-12):**
	- Veritabanı: `disputes` tablosu (gerekçe zorunlu, isteğe bağlı ödeme, anlaşma başına tek açık itiraz) ve `agreements.cancel_requested_by/at`.
	- `open_dispute`: `active`/`amendment_pending` → `disputed`.
	- `resolve_dispute`: yalnızca itirazı açan; anlaşma `active` olur, açık öneri varsa `amendment_pending`.
	- Kabul edilen değişiklik itirazı `amended` olarak kapatır.
	- `request_cancel` / `decide_cancel`: itirazlıyken de istenebilir; kabul anlaşmayı `cancelled` yapar, açık itirazı ve öneriyi kapatır; tekrar eden kabul ilk sonucu döner.
	- `forgive_remaining`: yalnızca alacaklı, `discount` ödemesi; tutar boşsa kalanın tamamı (`settled`); idempotent; borçlu yalnızca bilgilendirilir.
	- Detayda `dispute` ve `cancel_request`; Talepler'de "İtirazlar" ve "İptal talepleri".
	- Bildirim şablonları: `disputeOpened`, `disputeResolved`, `cancelRequested`, `cancelAccepted`, `cancelRejected`, `forgiven`.
	- Mobil: S16 ekranı (gerekçe + ilgili ödeme seçimi); detayda itiraz kartı, iptal talebi kabul/red, "İndirim yap" formu (tutar kalanla dolu gelir).
	- Testler: pgTAP 61, Vitest, RNTL 9 (ADR-034).

### [x] F2-10 Bekleyen davetleri hesaba bağlama
- `link-pending-invites` (yeni kayıtta numaraya bekleyen davetler).
- **Not (2026-10-13):** `private.link_pending_invites`, `complete_profile` içinde çalışır (ayrı edge function yok, ADR-035): web'de onaylanan/düzeltme önerilen anlaşmalara karşı taraf hesabı ve başkalarının bu numarayla kaydettiği kişiler bağlanır; reddedilen ("bana ait değil") bağlanmaz, açık davetler kararda bağlanır. `complete_profile` artık `pending_requests` döner; mobil, sayı > 0 ise kayıt bitince Talepler'i açar (davet linki önceliklidir). pgTAP 13 (+060 güncellendi), RNTL onboarding.

### [x] F2-11 Bildirim şablonları
- Tüm olay bildirimleri, copy-tr.md tonunda.
- **Not (2026-10-13):** Paylaşım akışı olayları (`shared`, `share_withdrawn`, `invite_expired`, `accepted`, `countered`, `rejected`, `settled`) `agreement_events` trigger'ıyla outbox'a düşer: `shareReceived` (hesabı olan davetli numaraya), `shareAccepted`/`shareCountered`/`shareRejected`/`inviteExpired` (oluşturana; web kararları dahil), `counterAccepted`/`shareWithdrawn`, `settled` (paylaşılmışsa iki tarafa). 7 gündür yanıtsız bildirilen ödeme için alacaklıya `paymentPending` (`enqueue_payment_reminders`, pg_cron 15 dk, ödeme başına bir kez, sessiz saatler). Push verisi şablonu taşır; uygulama karar isteyen bildirimlerde karar ekranını, geri çekilen paylaşımda Talepler'i açar. copy-tr.md tablosu tüm şablonlarla güncellendi. pgTAP 17, Vitest sözleşme, RNTL push (ADR-036).

### [ ] F2-12 Faz 2 kapısı
- Güvenlik taraması (claude-security), iki cihazla (biri uygulamasız) uçtan uca senaryolar, Maestro + Playwright.
- **Kabul (spec 15):** İki taraf aynı bakiyeyi görüyor; spec 16 "Kritik test senaryoları"nın tamamı geçiyor.
- **Durum (2026-10-13):** Kapı açık; kullanıcı kararıyla ertelendi, Faz 3'e geçildi. Yapılanlar:
	- Güvenlik invariantları kalıcı pgTAP testi oldu (`170_security_invariants`):
		- her tabloda RLS açık;
		- istemcinin hiçbir tabloya yazma yetkisi yok, anon hiçbir tabloyu okuyamıyor ve hiçbir RPC'yi çalıştıramıyor;
		- her security definer fonksiyonun `search_path`'i sabit;
		- `private` şemasından yalnızca `can_view_agreement` çağrılabiliyor;
		- web onayı ve outbox RPC'leri yalnızca servis rolüne açık;
		- geçmiş tabloları yalnızca eklemeye açık.
	- İstemci kodunda servis anahtarı referansı ve commit edilmiş `.env` dosyası yok.
	- Spec 16 senaryolarının karşılığı:
		1. → `180_concurrent_payments` (yeni);
		2. → `040`, `120`;
		3. → `090`;
		4. → Playwright `invite.spec.ts`;
		5. → `100`;
		6. → `040`, `120`;
		7. → `dates.test`, vektörler;
		8. → `130`;
		9. → `150`;
		10. hesap silme → F3-03 (henüz yok).
- **Kapıyı kapatmak için (kullanıcı):**
	- İki cihazla uçtan uca deneme (biri uygulamasız, web onayı): paylaş → web'de onayla → kaydol → bağlandı → ödeme bildir/onayla → değişiklik → itiraz → iptal.
	- Faz 2 için Maestro akışları (F1-19 ile aynı önkoşullar).
	- Senaryo 10, F3-03'ten sonra.
	- claude-security skill'i bu ortamda yok; elle tarama, yukarıdaki invariant testleriyle yapıldı.

---

## Faz 3 — Pilot ve yayın

### [x] F3-01 Gözlemlenebilirlik: Sentry (mobil, web, edge)
- **Not (2026-10-13):**
	- Ortak temizleyici: `scrubTelemetryEvent` / `scrubText` (`packages/shared`), edge için birebir kopyası `supabase/functions/_shared/telemetry.ts` (testle eşitliği denetleniyor). Telefon, tutar, e-posta, token/JWT maskelenir; kişisel/finansal anahtarlar `[Filtered]`; kullanıcı yalnızca id, istek yalnızca URL + yöntem.
	- Mobil: `@sentry/react-native` (`initSentry`, `EXPO_PUBLIC_SENTRY_DSN`); PII, ekran görüntüsü, görünüm hiyerarşisi, izleme kapalı.
	- Web: `@sentry/nextjs` yalnızca sunucuda (`instrumentation.ts`, `onRequestError`); tarayıcıya script yok, CSP değişmedi.
	- Edge: `npm:@sentry/deno` ile `withSentry` (6 fonksiyon) ve `rpcError`'daki beklenmeyen 500'ler.
	- DSN yoksa üçü de kapalı. Source map yükleme ve `@sentry/cli` sonraya (BACKLOG).
	- Testler: Vitest 15 (telemetry) + 3 (web), Jest 3 (mobil); edge, yerel `functions serve` ile DSN'li ve DSN'siz denendi (ADR-037).
### [x] F3-02 Analitik olayları (spec 13.3) ve basit metrik paneli
- **Not (2026-10-13):** Kullanıcı kararıyla PostHog yerine kendi tablomuz (ADR-038).
	- `analytics_events` yalnızca sunucuda zaten satırı olmayan olaylar için: `app_opened`, `reminder_opened {template}`, `invite_opened {channel}` ve `invite_otp_verified`. Web olayları davet başına bir kez sayılır; önizleme botları daveti tüketmez.
	- `track_event` RPC: beyaz liste, alan ve değer kontrolü; saatte 60 olay, aşan sessizce düşer.
	- `get_metrics(days)`: yalnızca servis rolü. Spec 13.1–13.2'yi mevcut tablolardan hesaplar.
	- Panel: `pnpm metrics [gün]` (yerelde `supabase status`'tan, uzakta `METRICS_*` ortam değişkenleriyle).
	- Mobil: `trackEvent` (mock'ta işlem yok, Supabase'de hataları yutar); açılış, bildirim açılışı ve davet açılışı.
	- Testler: pgTAP 24, RNTL 4, adaptör testleri.
### [x] F3-03 KVKK: aydınlatma metni ekranları, hesap silme, veri dışa aktarma
- **Not (2026-10-13):**
	- **Metinler:** KVKK aydınlatma metni ve kullanım koşulları ekranı (`legal/[doc]`), oturum açmadan da okunabilir; kayıt adımından erişiliyor. Metinler taslak; avukat onayı gerekli, ekranda belirtiliyor.
	- **Dışa aktarma:** `export_my_data` (profil, onaylar, rehber, anlaşmaların tamamı, cihazlar, analitik olaylar), sistem paylaşım sayfasıyla JSON olarak.
	- **Hesap silme:** `delete-account` edge function → `delete_account_data` (servis rolü) + auth soft delete.
		- Yalnızca kişiye ait anlaşmalar ve rehber silinir.
		- Paylaşılmış anlaşmalar karşı tarafta "Silinmiş kullanıcı" ile korunur (spec 16/10). Kişinin notları, gerekçeleri ve numara/IP/cihaz izleri temizlenir.
		- Aynı numarayla yeniden kayıt yeni ve temiz bir hesap açar (yerelde uçtan uca denendi).
	- Testler: pgTAP 25, RNTL 5, adaptör testleri (ADR-039).
### [x] F3-04 Yerli SMS sağlayıcı: Send SMS Hook
- **Not (2026-10-13):**
	- Sağlayıcıdan bağımsız SMS katmanı: `_shared/sms.ts` (saf, Vitest) + `smsSender.ts` (Deno). Modlar: `test`, `log` (yalnızca yerel), `netgsm`.
	- `send-sms-hook`: Standard Webhooks imzası doğrulanır, imzasız istek 401 alır.
	- Davet OTP'si (`invite-otp-send`) aynı katmana geçti. Numara loglarda maskeli; hatalar Sentry'ye numara ve kod olmadan gider.
	- Yerelde Auth hook'u açık; test numaraları hook'a uğramıyor. Gerçek numarayla `log` modunda giriş uçtan uca denendi: kod log'a düştü, doğrulama başarılı.
	- **Açık:** Netgsm adaptörü sağlayıcının OTP uç noktasına göre yazıldı; alan adları ve yanıt kodları ilk gerçek Netgsm hesabıyla doğrulanacak (ADR-040).
### [x] F3-05 Kötüye kullanım testleri: OTP, rate limit, SMS bütçe alarmı; bağımlılık denetimi (supply-chain-risk-auditor, insecure-defaults)
- **Not (2026-10-13):**
	- **SMS bütçesi:** `take_sms_budget`, Auth ve davet SMS'lerinin her biri için.
		- Numara başına saatte 5 SMS; sayaçta numaranın yalnızca hash'i tutulur.
		- Günlük toplam `SMS_DAILY_LIMIT`; dolunca gönderim durur. Alarm %80'de ve ilk retteki Sentry'ye gider.
		- Bütçe sorgusu başarısız olursa SMS gönderilmez. Uçtan uca denendi: aynı numaraya 6. kod reddedildi.
	- **Mevcut korumalar testli:**
		- davet OTP'si: IP 10/sa, numara 5/sa, 60 sn bekleme, 5 hatada kilit (`100`);
		- olay yazma sınırı (`190`);
		- güvenlik invariantları (`170`).
	- **Bağımlılık denetimi (`pnpm audit`):**
		- `next` 16.3.8'e yükseltildi (SSRF ve önbellek zehirlenmesi).
		- Expo yama sürümleri güncellendi (expo-doctor 21/21).
		- Kalan 5 bulgu derleme/test araçlarında ve yaması yok veya uyumsuz; `auditConfig`'te gerekçeli.
		- Uygulamaya giren `decode-uri-component` açığına 512 karakter link sınırı.
		- CI artık yeni yüksek seviye açıkta kırılıyor.
	- **Güvensiz varsayılan taraması:** çerezler `httpOnly` + `secure` + `strict`; e-posta ve anonim giriş kapalı; token rotasyonu açık. Üretim için SMS OTP süresi ve diğer ayarlar `supabase/README.md`'deki "Üretim kontrol listesi"nde.
	- Bu ortamda supply-chain-risk-auditor ve insecure-defaults skill'leri yok; denetim elle yapıldı (ADR-041).
### [ ] F3-06 EAS: build profilleri, TestFlight ve Play kapalı test (eas-app-stores, eas-workflows)
- **Durum (2026-10-13):** Kod ve yapılandırma hazır; hesap gerektiren adımlar kullanıcıda (`docs/RELEASE.md`).
	- `eas.json`: `development` / `preview` / `production` profilleri, her biri kendi EAS ortamıyla. Sürüm numarası EAS'ta (`remote`, `autoIncrement`). Android gönderimi kapalı test kanalına (`alpha`) taslak olarak.
	- `expo-dev-client` (Android'de uzak push için development build). `pnpm mobile` Expo Go ile açılmaya devam ediyor.
	- iOS: şifreleme beyanı (`usesNonExemptEncryption: false`) ve Türkçe rehber izni metni (`src/i18n/permissions.json`). Android: rehbere yazma izni engellendi.
	- Testler: RNTL/Jest 6 (`release.test.ts`). `expo config` çözümlemesi doğrulandı, expo-doctor 21/21.
	- **Kapatmak için (kullanıcı):** `eas login` + `eas init`; EAS ortam değişkenleri; App Store Connect ve Play Console'da uygulama kaydı; ilk TestFlight ve kapalı test build'i.
	- EAS Workflows (otomatik yayın) BACKLOG'da.
### [ ] F3-07 Mağaza materyalleri: metinler, ekran görüntüleri, gizlilik bildirimleri (aso-skills)
- **Durum (2026-10-13):** Metinler ve gizlilik beyanları hazır; ekran görüntüleri tasarıma ve cihaza bağlı.
	- `apps/mobile/store.config.json` (EAS Metadata, App Store tr-TR) ve `store/play-listing.json`. Karakter sınırları ve ürün sınırları (faiz, resmi belge, para transferi iddiası yok) `storeListing.test.ts` ile denetleniyor.
	- `docs/store/privacy.md`: Apple App Privacy ve Google Veri güvenliği cevapları, gerçek veri akışına göre.
	- `docs/store/screenshots.md`: 6 ekranlık plan, boyutlar, üst yazılar.
	- **Kapatmak için:**
		- tasarım uygulandıktan sonra ekran görüntüleri;
		- gizlilik politikası ve hesap silme web sayfası (alan adı ve destek e-postası kararı);
		- inceleme için üretimde test OTP numarası;
		- `example.com` yer tutucularının gerçek adreslerle değiştirilmesi.
	- aso-skills bu ortamda yok; metinler Expo `eas-app-stores` rehberine göre yazıldı.
### [x] F3-10 Tasarım sistemi: "Orman Defteri" (kullanıcının tasarım kanvası)
- **Not (2026-10-13):**
	- Kaynak: tasarım kanvası "ParamNet" (43 ekran). Kullanıcı kararı: görsel dil ve kapsamdaki ekranlar uygulanır; kapsam dışı modüller BACKLOG'da (ADR-043).
	- Token'lar: tasarımın açık paleti, aynı tonlardan türetilmiş koyu palet. Her iki temada 15 metin/zemin çifti WCAG AA ile testli.
	- Manrope 500–800 ve IBM Plex Mono (`@expo-google-fonts`); açılış ekranı fontlar yüklenene kadar kalıyor.
	- Bileşenler: kart (kenarlıklı, 20), rozet (yumuşak zeminli hap), buton (54; ikincil ve yıkıcı çerçeveli), giriş alanları (54, 14), segment, ilerleme çubuğu, liste satırı. Sekme çubuğu (etkin sekme hapı, yuvarlak köşeli + butonu).
	- Açılış ve Android ikon arka planı marka renginde. `design-tokens.md` yeniden yazıldı.

### [x] F3-11 Ekran düzenleri (tasarıma göre)
- Sekmeler: Ana · Borçlarım · (+) · Talepler · Takvim (kullanıcı kararı; Kişiler, Borçlarım içinden).
- Tasarımdaki karşılıklar:
	- Ana Sayfa (03);
	- Borçlarım/Alacaklarım (12);
	- Borç/Alacak detayı ve ödeme onayı (13, 15);
	- Kısmi ödeme (14) ve ödeme kaydedildi (11);
	- Gelen talep (16);
	- Elden taksit oluştur, plan önizleme ve taksit detayı (23–25);
	- Takvim (26);
	- Bildirimler (06);
	- Profil ve profili düzenle (04, 35);
	- Hoş geldin, giriş ve onboarding (01, 02, 31).
- Kapsam içi ama veri modelinde olmayanlar (ParamNet ID, "para teslimi bekleniyor", "para iste") uygulanmaz; tasarımdaki yerleri spec'teki akışla doldurulur.
- **İlerleme (2026-10-13):**
	- [x] Parça 1:
		- Sekmeler Ana · Borçlarım · (+) · Talepler · Takvim; Kişiler, Borçlarım'dan açılan bir ekran.
		- `list_agreements` RPC (pgTAP 6).
		- Borçlarım/Alacaklarım ekranı (12): toplam, ilerleme çubuklu satırlar, kapananlar ayrı.
		- Ana Sayfa (03): logo, bekleyen sayılı zil, selamlama, toplam kartları, amber bekleyenler bandı, hızlı işlem kutucukları, tarih kutulu vade satırları.
		- `Avatar` bileşeni.
	- [x] Parça 2:
		- Anlaşma detayı (13, 15): üst kart (avatar, kalan / toplam, ilerleme, birincil eylem), "Anlaşma" bilgi satırları, kartlı taksit ve ödeme listeleri, kısa zaman çizelgesi.
		- Ödeme ekranı (14): sıradaki taksit / kalanın tamamı kısayolları, "ödemeden sonra kalan".
		- Sonuç görünümü (11): kaydedildi ya da onay bekleniyor, yeni kalan.
	- [x] Parça 3:
		- Karşılama (01, 31): logo, simgeli tanıtım kartları, nokta göstergesi, "para tutmaz, transfer yapmaz" notu.
		- Telefon girişi (02): banka şifresi istenmez güven notu.
		- Talepler (06): avatarlı, eylem rozetli ("Yanıtla / Onayla / İncele") satırlar.
		- Karar ekranı (16): avatar, büyük tutar, "onaylamak para göndermez" kutusu.
		- Profil (04): avatarlı başlık.
		- Takvim (26) ve oluşturma formu (23–24) yalnızca yeni bileşenlerle güncellendi; tasarımdaki nakit projeksiyonu ve kredi/ekstre olayları kapsam dışı (ADR-043).
	- **Kullanıcı kontrolü:** Expo Go'da açık ve koyu temada ekranlara bakılmalı; bu makinede Xcode olmadığı için görsel kontrol yapılamadı.

### [ ] F3-08 Pilot (30–50 kişi), metrik takibi, hata düzeltme
### [ ] F3-09 Faz 3 kapısı: mağaza yayını
