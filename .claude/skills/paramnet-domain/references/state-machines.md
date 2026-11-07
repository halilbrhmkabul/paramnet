# Durum Makineleri

Kaynak: `docs/PRODUCT_SPEC.md` Bölüm 8. Burada olmayan bir geçiş uygulanmaz; gerekiyorsa kullanıcıya sorulur. Tüm geçişleri yalnızca kaydın sahibi yapar (ADR-064).

## Kayıt durumları (`agreement_status`)

| Durum | Anlamı | Etiket | Son durum mu |
|---|---|---|---|
| `personal` | Açık kayıt, tek çalışma durumu | Açık | Hayır |
| `settled` | Kalan borç 0 | Kapandı | Hayır (ödeme silinirse açılır) |
| `cancelled` | İptal | İptal | Evet |

## Kayıt geçişleri

| Mevcut | Olay / RPC | Yeni | Koşul / Etki |
|---|---|---|---|
| — | `create_agreement` | `personal` | v1 oluşur, taksitler üretilir, peşinat ödemesi `confirmed` |
| — | `create_agreement_with_paid` | `personal` (hepsi ödendiyse `settled`) | Aynısı + ilk n taksit vade gününde `confirmed` ödeme (ADR-059) |
| `personal` | `update_personal_agreement` | `personal` | Yeni versiyon; ödemeler korunur |
| `personal` | `record_payment` | `personal` / `settled` | `confirmed`; kalan 0 ise `settled` |
| `personal` | `forgive_remaining` | `personal` / `settled` | `discount` ödemesi; kalan 0 ise `settled` |
| `personal` | `cancel_agreement` | `cancelled` | |
| `personal` | `void_payment` | `personal` | Dağıtım geri alınır |
| `settled` | `void_payment` | `personal` | Kalan sıfırın üstüne çıkar |

## Ödeme durumları (`payment_status`)

| Mevcut | Olay | Yeni |
|---|---|---|
| — | `record_payment` | `confirmed` |
| `confirmed` | `void_payment` | `voided` |

`payment_kind`: `payment`, `down_payment`, `discount`.

## Taksit durumu (türetilmiş, saklanmaz)

| Durum | Koşul |
|---|---|
| `paid` | `paid_minor = amount_minor` |
| `overdue` | `paid_minor < amount_minor` ve `due_date < bugün` |
| `due_today` | `paid_minor < amount_minor` ve `due_date = bugün` |
| `upcoming` | `paid_minor < amount_minor` ve `due_date > bugün` veya `due_date is null` |
| `partial` | `0 < paid_minor < amount_minor` (diğerleriyle birlikte işaret) |

## Olay tipleri (`agreement_events.type`)

`created`, `updated_personal`, `payment_recorded`, `payment_voided`, `forgiven`, `settled`, `reopened`, `cancelled`.

Eski kayıtlardaki diğer tipler (`shared`, `accepted` vb.) okunur, yenisi yazılmaz.
