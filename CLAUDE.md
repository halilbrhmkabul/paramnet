# Paramnet

Karşılıklı borç ve taksit yönetimi uygulaması.

Paramnet, bireyler arası borç ve elden taksit anlaşmalarını iki taraflı takip eden mobil uygulama (iOS + Android) ve tek sayfalık web onay ekranı.

## Doğruluk kaynakları

| Dosya | İçerik |
|---|---|
| `docs/PRODUCT_SPEC.md` | Ürün ve teknik tasarım. **Tek doğruluk kaynağı.** Kod ile spec çelişirse dur ve sor. |
| `docs/ROADMAP.md` | Görev listesi, sıra, kabul kriterleri ve durum. Her oturumun başlangıç noktası. |
| `docs/DECISIONS.md` | Alınan teknik kararlar (ADR). Spec dışında verilen her karar buraya yazılır. |
| `docs/BACKLOG.md` | Kapsam dışı fikirler. Mevcut görev sırasında akla gelen her yeni özellik buraya yazılır, uygulanmaz. |
| `.claude/skills/paramnet-domain/` | İş kuralları, durum makineleri, şema, güvenlik. Backend işlerinde zorunlu. |
| `.claude/skills/paramnet-mobile/` | Ekranlar, tasarım token'ları, Türkçe metinler, derin bağlantılar, test kuralları. Mobil işlerde zorunlu. |

## Çalışma şekli (zorunlu)

Her oturumda tek bir görev yapılır. Görev sırası `docs/ROADMAP.md`'dedir.

1. **Oku:** `docs/ROADMAP.md`'de durumu `[ ]` olan ilk görevi bul. Kullanıcı başka bir görev ID'si verdiyse onu al. Görevin kabul kriterlerini ve ilgili spec bölümlerini oku.
2. **Planla:** Kod yazmadan önce plan sun: değişecek/oluşacak dosyalar, yaklaşım, yazılacak testler, riskler, açık sorular. **Kullanıcı onaylamadan kod yazma.**
3. **Önce test:** Mümkün olan her yerde testi önce yaz, başarısız olduğunu gör, sonra uygula (domain: Vitest, veritabanı: pgTAP, mobil: RNTL/Maestro).
4. **Uygula:** Yalnızca görevin kapsamındaki işi yap. Kapsam dışı fikirleri `docs/BACKLOG.md`'ye yaz.
5. **Doğrula:** typecheck, lint ve ilgili testleri çalıştır. Çalıştırmadığın bir şeyin çalıştığını söyleme.
6. **Kaydet:** `docs/ROADMAP.md`'de görevi `[x]` yap, varsa notu ekle. Kararları `docs/DECISIONS.md`'ye yaz.
7. **Commit:** Kullanıcı onayıyla, görev başına tek commit: `feat(F1-04): create_agreement RPC` biçiminde (Conventional Commits + görev ID).
8. **Dur ve raporla:** Ne yapıldı, nasıl test edildi, kullanıcının elle kontrol etmesi gerekenler, sıradaki görev. **Sıradaki göreve kendiliğinden geçme.**

Faz sonundaki "Faz kapısı" görevi tamamlanmadan sonraki faza başlanmaz.

## Mimari (özet — ayrıntı spec Bölüm 9–10)

- Monorepo (pnpm workspaces):
	- `apps/mobile` — Expo (React Native, TypeScript, Expo Router)
	- `apps/web-confirm` — Next.js, tek rota web onay sayfası (Faz 2)
	- `packages/shared` — saf TS domain mantığı + zod şemaları (plan üretimi, ödeme dağıtımı, para)
	- `supabase/` — migration, RLS, RPC fonksiyonları, edge functions, pgTAP testleri
- Backend: Supabase (Postgres, Auth telefon OTP, RLS, RPC, Edge Functions, pg_cron, Storage).
- Mobil durum: TanStack Query (sunucu), Zustand (yalnızca yerel UI).
- Formlar: react-hook-form + zod (şemalar `packages/shared`'dan).

## Kesin kurallar

- **Para:** Kuruş cinsinden tam sayı (`bigint` / TS'de `number` tam sayı veya `bigint`). Ondalıklı sayı ile para hesabı yasak. Biçimlendirme tek yardımcıdan: `12.000,00 TL`.
- **Sunucu otoritesi:** İstemci çekirdek tablolara doğrudan yazamaz (RLS ile kapalı). Tüm yazmalar `security definer` RPC'lerle; her RPC yetki + durum geçişi kontrolü yapar, tek transaction'da çalışır, olay kaydı yazar.
- **Idempotency:** Ödeme ve karar işlemleri istemcide üretilen UUID anahtar taşır.
- **Versiyon:** Onaylar `version` + `terms_hash` ile verilir. Kabul edilmiş anlaşma tek taraflı değişmez.
- **Değiştirilemez geçmiş:** `agreement_versions` ve `agreement_events` yalnızca eklenir.
- **Tarih/saat:** Vade tarihleri `date`, olaylar `timestamptz`. Saat dilimi `Europe/Istanbul`.
- **Faiz yok, para hareketi yok:** Uygulama faiz hesaplamaz, para tutmaz, transfer başlatmaz.
- **Kişisel veri:** Loglarda ve analitik olaylarında telefon, ad, not, tutar (aralık hariç) yok.

## Kod stili

- Girinti **TAB** (Prettier `useTabs: true`). Tüm dosyalarda.
- TypeScript `strict`. `any` yasak; gerekiyorsa `unknown` + daraltma.
- Kod, tablo, fonksiyon, değişken adları İngilizce. Kullanıcıya görünen metinler Türkçe ve `apps/mobile/src/i18n/tr.ts`'den gelir.
- Yorumlar yalnızca "neden"i açıklar.
- Yeni bağımlılık eklemeden önce gerekçeyi plana yaz.

## Güvenlik ve ortam

- Geliştirme **yerel Supabase** ile yapılır (`supabase start`). Uzak (remote) projeye migration uygulama, veri silme veya edge function deploy **yalnızca kullanıcının açık onayıyla**.
- Supabase MCP ile uzak projede yazma işlemi yapmadan önce sor.
- `.env*` dosyaları commit edilmez. Servis rolü anahtarı mobil veya web istemcisine asla girmez.
- Migration'lar ileriye dönüktür; uygulanmış bir migration dosyası düzenlenmez, yeni migration yazılır.

## İletişim

- Kullanıcıyla Türkçe konuş. Kısa ve net ol; uzun açıklama yapma.
- Bir kural, spec ile çelişiyorsa veya spec'te cevap yoksa tahmin etme: seçenekleri sun ve sor.
- Tam dosya/kod üret; "... geri kalanı aynı" gibi kısmi çıktı verme.

## Komutlar

Tüm komutlar repo kökünden çalışır.

| Amaç | Komut |
|---|---|
| Bağımlılıkları kur | `pnpm install` |
| Mobil uygulamayı başlat (Expo Go QR) | `pnpm mobile` |
| Tüm testler (shared: Vitest, mobile: Jest) | `pnpm test` |
| Tek paket testi | `pnpm --filter @paramnet/shared test` / `pnpm --filter mobile test` |
| Typecheck + lint | `pnpm typecheck` · `pnpm lint` |
| Biçim kontrolü / düzeltme | `pnpm format:check` · `pnpm format` |
| Mobil bağımlılık ekle (SDK uyumlu) | `cd apps/mobile && pnpm exec expo install <paket>` |
| Expo uyumluluk kontrolü | `cd apps/mobile && npx expo-doctor@latest` |
| Yerel Supabase (Docker gerekir) | `pnpm supabase start` / `pnpm supabase stop` |
| Veritabanı testleri (pgTAP) | `pnpm db:test` |
| DB tiplerini üret (yerel DB açıkken) | `pnpm db:types` → `packages/shared/src/db.types.ts` |
| Yerel test telefonları (OTP `123456`) | `+905550000001` (A), `+905550000002` (B), `+905550000003` (yetkisiz) |
