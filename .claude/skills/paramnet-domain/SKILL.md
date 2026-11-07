---
name: paramnet-domain
description: Paramnet (borç ve taksit uygulaması) alan kuralları, durum makineleri, veritabanı şeması ve güvenlik modeli. Supabase migration, RLS politikası, RPC/plpgsql fonksiyonu, edge function, pgTAP testi, bakiye/kalan borç, taksit planı, ödeme dağıtımı, hesap bölme, kayıt durumu (agreement status) veya packages/shared domain kodu yazarken ya da değiştirirken MUTLAKA kullan. Use for any backend, database, state-transition or money work in this project.
---

# paramnet-domain

Bu skill, uygulamanın doğruluğunu belirleyen kuralları taşır. Tek doğruluk kaynağı `docs/PRODUCT_SPEC.md`'dir; bu skill onun uygulanabilir özetidir. Çelişki görürsen spec kazanır ve kullanıcıya bildirirsin.

## Ne zaman hangi referans

| İş | Oku |
|---|---|
| Tutar, bakiye, taksit, ödeme, iptal, kapanış kuralı | `references/business-rules.md` |
| Herhangi bir durum değişikliği (kayıt, ödeme) | `references/state-machines.md` |
| Tablo, sütun, enum, indeks, RLS, RPC imzası | `references/schema.md` |
| Kimlik, OTP, rate limit, gizli anahtar, kişisel veri | `references/security.md` |

## Değişmez ilkeler

1. **Para kuruş cinsinden tam sayı.** DB'de `bigint`, `numeric`/`float` yasak. Sütun adları `_minor` ile biter.
2. **İstemci yazmaz.** Çekirdek tablolarda istemciye insert/update/delete RLS ile kapalıdır. Tüm yazmalar `security definer` RPC'lerden geçer.
3. **Her durum geçişi tek transaction:** satırı `FOR UPDATE` ile kilitle → yetkiyi kontrol et → geçişin izinli olduğunu kontrol et → `row_version` eşleşmesini kontrol et → güncelle → `agreement_events`'e yaz → gerekiyorsa `notification_outbox`'a yaz → `row_version` artır.
4. **Idempotency:** Ödeme ve oluşturma RPC'leri `idempotency_key uuid` alır. Aynı anahtar tekrar gelirse yeni kayıt oluşturmadan ilk sonucu döndür.
5. **Tek sahip:** Her kayıt, grup ve bildirim tek kullanıcınındır. Kullanıcılar arası görünürlük, paylaşım ve bildirim yoktur (ADR-064).
6. **Yalnızca ekleme:** `agreement_versions` ve `agreement_events` güncellenmez, silinmez.
7. **Türetilmiş durum:** Taksit durumu saklanmaz, `paid_minor`, `amount_minor`, `due_date` ve bugünden hesaplanır.
8. **Aynı mantık iki yerde:** Plan üretimi ve ödeme dağıtımı hem `packages/shared` (TS) hem plpgsql'de vardır. İkisi aynı test vektörleriyle doğrulanır.
9. **Kişiler arası faiz yok, para hareketi yok.** Faiz yalnızca kullanıcının banka kredisi için gösterim ve simülasyondur (ADR-045).

## İş akışı: yeni bir durum geçişi / RPC eklemek

1. `references/state-machines.md`'de geçişin tanımlı olduğunu doğrula. Değilse dur ve kullanıcıya sor; spec'e ekleme önerisi sun.
2. **Önce pgTAP testi yaz** (`supabase/tests/`):
	- izinli aktör → başarılı, doğru yeni durum, olay kaydı yazıldı
	- izinsiz aktör (başka kullanıcı, anonim) → hata
	- geçersiz mevcut durum → hata
	- eski `row_version` → conflict hatası
	- aynı idempotency anahtarıyla tekrar → tek kayıt
3. Testin başarısız olduğunu gör (`supabase test db`).
4. Fonksiyonu yeni bir migration'da yaz (aşağıdaki şablon).
5. Testleri geçir. `supabase gen types` ile TS tiplerini yenile.
6. `packages/shared` tarafında aynı mantık varsa test vektörlerini güncelle.

## RPC şablonu

```sql
create or replace function public.record_payment(
	p_agreement_id uuid,
	p_amount_minor bigint,
	p_paid_on date,
	p_method payment_method,
	p_note text,
	p_row_version int,
	p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_uid uuid := auth.uid();
	v_ag agreements%rowtype;
	v_existing payments%rowtype;
begin
	if v_uid is null then
		raise exception 'not_authenticated' using errcode = '28000';
	end if;

	select * into v_existing from payments where idempotency_key = p_idempotency_key;
	if found then
		return jsonb_build_object('payment_id', v_existing.id, 'status', v_existing.status, 'replayed', true);
	end if;

	select * into v_ag from agreements where id = p_agreement_id for update;
	if not found then
		raise exception 'not_found' using errcode = 'P0002';
	end if;

	-- yetki + durum + row_version kontrolleri
	-- ...
	-- güncelleme, payment_allocations, outstanding_minor
	-- insert into agreement_events (...)
	-- insert into notification_outbox (...) (gerekiyorsa)

	update agreements set row_version = row_version + 1 where id = v_ag.id;
	return jsonb_build_object('payment_id', /* ... */ null, 'replayed', false);
end;
$$;

revoke all on function public.record_payment from public, anon;
grant execute on function public.record_payment to authenticated;
```

Hata kodları istemcide eşlenir: `conflict` (row_version), `invalid_transition`, `forbidden`, `amount_exceeds_outstanding`, `not_found`, `validation_error`. Yeni bir kod eklersen `apps/mobile/src/api/errors.ts` eşlemesini de güncelle.

## Migration kuralları

- Dosya adı: `supabase/migrations/<timestamp>_<kısa_açıklama>.sql`.
- Uygulanmış bir migration düzenlenmez; düzeltme yeni migration'dır.
- Her yeni tabloda: `created_at timestamptz not null default now()`, RLS `enable`, varsayılan olarak hiçbir politika yok (kapalı), sonra gerekli okuma politikaları.
- Uzak (remote) projeye uygulama yalnızca kullanıcı onayıyla.
