# Durum Makineleri

Kaynak: `docs/PRODUCT_SPEC.md` Bölüm 8. Burada olmayan bir geçiş uygulanmaz; gerekiyorsa kullanıcıya sorulur.

## Anlaşma durumları (`agreement_status`)

| Durum | Anlamı | Son durum mu |
|---|---|---|
| `personal` | Kişisel mod, yalnızca oluşturan görür | Hayır |
| `pending` | Paylaşıldı, karşı taraf yanıtı bekleniyor | Hayır |
| `countered` | Karşı taraf düzeltme önerdi, oluşturan yanıtı bekleniyor | Hayır |
| `active` | İki taraf onayladı | Hayır |
| `amendment_pending` | Aktifte açık değişiklik talebi var; eski şartlar geçerli | Hayır |
| `disputed` | İtiraz açık; hatırlatmalar durur | Hayır |
| `rejected` | Karşı taraf reddetti | Hayır (personal'a dönebilir) |
| `settled` | Kalan borç 0 | Evet |
| `cancelled` | İptal | Evet |

## Anlaşma geçişleri

Aktör kısaltmaları: **C** = oluşturan (creator), **K** = karşı taraf (counterparty), **A** = alacaklı, **B** = borçlu, **S** = sistem, **Herhangi** = C veya K.

| Mevcut | Olay / RPC | Aktör | Yeni | Koşul / Etki |
|---|---|---|---|---|
| — | `create_agreement` | C | `personal` | v1 oluşur, taksitler üretilir, peşinat ödemesi `confirmed` |
| — | `create_agreement_with_paid` | C | `personal` (hepsi ödendiyse `settled`) | Aynısı + ilk n taksit vade gününde `confirmed` ödeme (ADR-059) |
| `personal` | `update_personal_agreement` | C | `personal` | Yeni versiyon; onaylı ödemeler korunur |
| `personal` | `record_payment` | C | `personal` / `settled` | Doğrudan `confirmed`; kalan 0 ise `settled` |
| `personal` | `cancel_agreement` | C | `cancelled` | |
| `personal` | `share_agreement` | C | `pending` | Telefon zorunlu; davet oluşur; `pending_version` = mevcut versiyon |
| `personal` | `share_agreement_by_id` | C | `pending` | ParamNet ID ile; davet hedef profile bağlı, token/OTP yok; karar yalnızca o hesaptan (ADR-050) |
| `pending` | `decide_agreement(accept)` | K | `active` | version + terms_hash eşleşmeli; `counterparty_profile_id` set; `active_version` = onaylanan |
| `pending` | `decide_agreement(counter)` | K | `countered` | Yeni versiyon taslağı (`proposed_by` = K) |
| `pending` | `decide_agreement(reject)` | K | `rejected` | Gerekçe opsiyonel |
| `pending` | `withdraw_share` | C | `personal` | Davet `revoked` |
| `pending` | süre dolumu | S | `personal` | Davet `expired` (7 gün) |
| `countered` | `decide_counter(accept)` | C | `active` | Karşı önerideki versiyon yürürlüğe girer |
| `countered` | `decide_counter(counter)` | C | `pending` | Yeni versiyonla tekrar K'ya |
| `countered` | `withdraw_share` | C | `personal` | |
| `rejected` | `make_personal` | C | `personal` | |
| `active` | `record_payment` | A | `active` / `settled` | `confirmed` |
| `active` | `record_payment` | B | `active` | `reported` |
| `active` | `propose_amendment` | Herhangi | `amendment_pending` | Tek açık talep (BR-07) |
| `amendment_pending` | `decide_amendment(accept)` | Diğer taraf | `active` | Yeni versiyon yürürlükte; kalan tutara yeni taksitler |
| `amendment_pending` | `decide_amendment(reject)` | Diğer taraf | `active` | Eski versiyon geçerli |
| `amendment_pending` | `withdraw_amendment` | Öneren | `active` | |
| `active` | `open_dispute` | Herhangi | `disputed` | Gerekçe zorunlu |
| `disputed` | `resolve_dispute` | İtirazı açan | `active` | |
| `disputed` | `decide_amendment(accept)` | Diğer taraf | `active` | İtiraz değişiklikle çözülür |
| `active` | `request_cancel` → `decide_cancel(accept)` | Herhangi → Diğer | `cancelled` | Karşılıklı |
| `active` | `forgive_remaining` | A | `settled` | Kalan `discount` olarak kapanır |
| `active` | onaylı ödeme ile kalan 0 | S | `settled` | Aynı transaction'da |

`amendment_pending` iken ödeme kaydı yapılabilir (eski şartlar geçerli). `disputed` iken ödeme ve değişiklik (itirazı çözen değişiklik hariç) yapılamaz.

## Ödeme durumları (`payment_status`)

| Mevcut | Olay | Aktör | Yeni |
|---|---|---|---|
| — | `record_payment` | A veya sahip (personal) | `confirmed` |
| — | `record_payment` | B (shared) | `reported` |
| `reported` | `decide_payment(confirm)` | A | `confirmed` (dağıtım yapılır) |
| `reported` | `decide_payment(reject)` | A | `rejected` |
| `reported` | `withdraw_payment` | B | `withdrawn` |
| `confirmed` | `void_payment` (karşılıklı onay) | İki taraf | `voided` (dağıtım geri alınır, kalan artar) |

`payment_kind`: `payment`, `down_payment`, `discount`.

## Taksit durumu (türetilmiş, saklanmaz)

| Durum | Koşul |
|---|---|
| `paid` | `paid_minor = amount_minor` |
| `overdue` | `paid_minor < amount_minor` ve `due_date < bugün` |
| `due_today` | `paid_minor < amount_minor` ve `due_date = bugün` |
| `upcoming` | `paid_minor < amount_minor` ve `due_date > bugün` veya `due_date is null` |
| `partial` | `0 < paid_minor < amount_minor` (diğerleriyle birlikte işaret) |

## Davet durumları (`invite_status`)

| Durum | Anlamı |
|---|---|
| `active` | Kullanılabilir |
| `consumed` | Karar verildi |
| `revoked` | Geri çekildi veya yeni davet oluşturuldu |
| `expired` | 7 gün doldu |
| `locked` | 5 başarısız OTP denemesi |

Bir anlaşmada aynı anda tek `active` davet olur; yeni davet eskisini `revoked` yapar.

## Olay tipleri (`agreement_events.type`)

`created`, `updated_personal`, `shared`, `share_withdrawn`, `invite_expired`, `accepted`, `countered`, `rejected`, `payment_recorded`, `payment_reported`, `payment_confirmed`, `payment_rejected`, `payment_withdrawn`, `payment_voided`, `amendment_proposed`, `amendment_accepted`, `amendment_rejected`, `amendment_withdrawn`, `dispute_opened`, `dispute_resolved`, `cancel_requested`, `cancel_accepted`, `cancel_rejected`, `forgiven`, `settled`, `cancelled`.

## Para teslimi (ADR-058)

Anlaşma durumu değişmez ("active" kalır). `delivery_required` olan anlaşmada:

| Mevcut | Olay | Aktör | Sonraki |
|---|---|---|---|
| teslim bekleniyor | delivery_reported | borç veren | onay bekleniyor (`delivery_reported_at`) |
| onay bekleniyor | delivery_confirmed | borç alan | tamamlandı (`delivery_confirmed_at`) |

Her adım `row_version` ister; başka aktör `forbidden`, sırasız adım `invalid_transition`.
