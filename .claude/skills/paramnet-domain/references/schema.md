# Veri Modeli

Kaynak: `docs/PRODUCT_SPEC.md` Bölüm 10. Tüm tablolarda `created_at timestamptz not null default now()` vardır (aşağıda tekrar edilmez). Para sütunları `_minor` ile biter ve `bigint`'tir.

## Enum'lar

```sql
create type agreement_status as enum ('personal','pending','countered','active','amendment_pending','disputed','rejected','settled','cancelled');
create type agreement_kind   as enum ('loan','installment_purchase');
create type party_role       as enum ('creditor','debtor');
create type contact_kind     as enum ('person','merchant');
create type version_status   as enum ('draft','proposed','accepted','rejected','superseded');
create type payment_status   as enum ('reported','confirmed','rejected','withdrawn','voided');
create type payment_kind     as enum ('payment','down_payment','discount');
create type payment_method   as enum ('cash','transfer','card','other');
create type invite_status    as enum ('active','consumed','revoked','expired','locked');
create type event_channel    as enum ('app','web','system');
create type account_kind     as enum ('bank','cash','savings','other');
create type transaction_kind as enum ('expense','income','transfer','adjustment');
create type recurrence_frequency as enum ('weekly','monthly','yearly');
create type card_color as enum ('navy','graphite','midnight','bordeaux');
```

## Tablolar

### profiles
| Sütun | Tip | Not |
|---|---|---|
| id | uuid PK | = auth.users.id |
| display_name | text not null | |
| phone_e164 | text unique not null | +90… |
| locale | text default 'tr-TR' | |
| timezone | text default 'Europe/Istanbul' | |
| deleted_at | timestamptz null | |
| first_name / last_name | text null | Görünen ad bunlardan; yalnızca görünen ad gelirse son boşluktan bölünür (ADR-051) |
| username | text unique null | `normalize_username` biçiminde; yalnızca gösterim, aramada kullanılmaz |
| avatar_path | text null | `avatars/{uid}/{uuid}.jpg` |
| paramnet_id | text unique null | `PN-` + 6 karakter (`23456789A–Z`, I ve O yok); kayıtta tetikleyiciyle atanır (ADR-050) |
| paramnet_id_changed_at | timestamptz null | Yenileme 30 günde bir |
| id_discoverable | boolean default true | Kapalıysa ID ile bulunmaz |
| reminder_before_days | int[] default {3,0} | 7, 3, 1, 0 alt kümesi |

### contacts
| Sütun | Tip | Not |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid FK profiles | |
| display_name | text not null | Sahibin verdiği ad |
| phone_e164 | text null | unique(owner_id, phone_e164) |
| linked_profile_id | uuid null FK profiles | |
| kind | contact_kind default 'person' | |

### agreements
| Sütun | Tip | Not |
|---|---|---|
| id | uuid PK | |
| creator_id | uuid FK profiles | |
| creator_role | party_role | |
| counterparty_contact_id | uuid FK contacts | Oluşturanın gözünden |
| counterparty_profile_id | uuid null FK profiles | Kabulde dolar |
| kind | agreement_kind | |
| title | text not null | |
| description | text null | |
| started_on | date null | Verildiği/alındığı tarih (ADR-019) |
| idempotency_key | uuid null unique | `create_agreement` tekrarı (ADR-021) |
| currency | char(3) default 'TRY' | Değişmez |
| principal_minor | bigint check > 0 | |
| outstanding_minor | bigint check >= 0 | Önbellek; ödemelerden doğrulanır |
| status | agreement_status | |
| active_version | int | |
| pending_version | int null | |
| row_version | int default 1 | İyimser kilit |
| settled_at, cancelled_at | timestamptz null | |

İndeksler: `(creator_id, status)`, `(counterparty_profile_id, status)`.

### agreement_versions
| Sütun | Tip | Not |
|---|---|---|
| agreement_id, version | PK (composite) | |
| terms | jsonb | `{ principal_minor, down_payment_minor, plan:[{seq,due_date,amount_minor}], notes }` |
| terms_hash | text | SHA-256(kanonik JSON) |
| proposed_by | uuid | |
| reason | text null | |
| status | version_status | |

### installments
| Sütun | Tip | Not |
|---|---|---|
| id | uuid PK | |
| agreement_id, version | FK | Yürürlükteki versiyonun taksitleri |
| seq | int | |
| due_date | date null | |
| amount_minor | bigint > 0 | |
| paid_minor | bigint default 0 | 0 ≤ paid ≤ amount |

İndeks: `(agreement_id, version, seq)` unique; `(due_date)` hatırlatmalar için.

### payments
| Sütun | Tip | Not |
|---|---|---|
| id | uuid PK | |
| agreement_id | uuid FK | |
| amount_minor | bigint > 0 | |
| paid_on | date | |
| method | payment_method | |
| kind | payment_kind | |
| status | payment_status | |
| note | text null | |
| reported_by | uuid | |
| decided_by | uuid null | |
| decided_at | timestamptz null | |
| idempotency_key | uuid unique | |
| attachment_path | text null | Storage yolu |

### payment_allocations
`payment_id uuid FK`, `installment_id uuid FK`, `amount_minor bigint > 0`; PK `(payment_id, installment_id)`.

### invites (istemciye tamamen kapalı)
| Sütun | Tip | Not |
|---|---|---|
| id | uuid PK | |
| agreement_id, version | FK | |
| token_hash | bytea unique | SHA-256(token) |
| target_phone_e164 | text null | Numarayla davet |
| target_profile_id | uuid null | ID ile davet: token ve OTP yok (`token_hash` null). İkisinden tam biri dolu |
| status | invite_status | |
| expires_at | timestamptz | +7 gün |
| otp_attempts | int default 0 | Üst sınır 5 |
| consumed_at | timestamptz null | |

### agreement_events (yalnızca ekleme)
| Sütun | Tip | Not |
|---|---|---|
| id | bigint identity PK | |
| agreement_id | uuid | |
| actor_id | uuid null | Web'de null olabilir |
| actor_phone_e164 | text null | Doğrulanmış numara |
| channel | event_channel | |
| type | text | Bkz. state-machines.md |
| version | int null | |
| payload | jsonb | |
| ip_hash | text null | |
| user_agent | text null | Kısaltılmış |

### Diğer
- `reminders`: id, agreement_id, installment_id null, user_id, fire_at timestamptz, kind text, status (scheduled, sent, cancelled).
- `notification_outbox`: id, user_id, template text, payload jsonb, status (pending, sent, failed), attempts int, next_attempt_at.
- `push_tokens`: user_id, expo_token unique, platform, last_seen_at.
- `consents`: user_id, document (kvkk, terms), version, accepted_at.
- `disputes`: id, agreement_id, opened_by, payment_id null, reason (zorunlu, ≤500), status (open, resolved, amended, closed), resolved_at; anlaşma başına tek açık itiraz (ADR-034).
- `agreements.cancel_requested_by` / `cancel_requested_at`: açık karşılıklı iptal talebi (ADR-034).
- `pin_login_attempts` (istemciye kapalı, ADR-049): phone_hash text pk (sha256), failed_count, last_failed_at, locked_until. 1 günden eski satırları pg_cron siler.
- `user_pins` (istemciye kapalı): user_id pk → auth.users, pin_set_at. Satırı yoksa hesap PIN'den önceki bir hesaptır.
- `rate_limits`: key text, window_start timestamptz, count int (RPC/edge rate limit sayaçları). Hata fırlatan RPC sayacı da geri alır; sayılması gereken sonuçlar (ör. "bulunamadı") hata değil değer döner.
- `retired_paramnet_ids` (istemciye kapalı): paramnet_id pk, retired_at. Kullanılmış ID yeniden verilmez.
- `notifications` (istemciye kapalı, ADR-051): id bigint identity, user_id, template, payload, agreement_id null, category (approval, reminder, completed, info), read_at null. `notification_outbox`'a her ekleme tetikleyiciyle buraya da yazılır; 90 gün sonra pg_cron siler.
- `accounts` (istemciye kapalı, ADR-053): id, owner_id, kind, name (≤40), bank_name null (≤40; IBAN yok), opening_balance_minor bigint (±10¹³, eksi olabilir), include_in_total, archived_at null, idempotency_key unique, row_version, updated_at. `created_at` `clock_timestamp()` (ekleme sırası).
- `transactions` (istemciye kapalı): id, owner_id, kind, account_id, to_account_id null (yalnızca transfer, farklı hesap), amount_minor bigint (>0; yalnızca adjustment işaretli), category null (expense/income'da zorunlu, `private.is_category_for`), title null (≤80), note null (≤500), occurred_on date, idempotency_key unique, deleted_at null (geçici silme), row_version, updated_at. Bakiye saklanmaz: `private.account_balance`.
- `transaction_events` (yalnızca ekleme): transaction_id, owner_id, type (created, updated, deleted, restored), changes jsonb `{alan: [eski, yeni]}`. Hesap silmede `paramnet.erasure` ile birlikte silinir.
- `recurring_rules` (istemciye kapalı, ADR-054): id, owner_id, kind (expense/income), name (≤80), amount_minor, category, account_id, frequency, start_on, confirm_each, tracking_from (borç sayılan ilk gün), paused_at null, idempotency_key, row_version. Tarih kuralı `private.recurrence_dates` = `packages/shared` `occurrencesBetween` (`test-vectors/recurrence.json`).
- `recurring_occurrences`: (rule_id, occurrence_on) pk, status (posted, skipped), transaction_id null, idempotency_key. Saatlik `post_due_recurring` onay istemeyen kuralları yazar.
- `budgets`: (owner_id, category) pk, limit_minor (>0).
- `cards` (istemciye kapalı, ADR-055): id, owner_id, bank_name, card_name null, last4 (4 rakam), color, limit_minor, opening_debt_minor, statement_day 1–28, due_offset_days 1–28, min_payment_rate 1–100, archived_at null, idempotency_key, row_version. Ekstre `private.card_state_from` = `packages/shared` `deriveCardState` (`test-vectors/cards.json`).
- `transactions` F4-05 ekleri: card_id null (kart harcaması/iadesi; account_id boş), to_card_id null (hesaptan karta ödeme, kind transfer), installments 1–36 (yalnızca kartta gider).
- Storage `avatars` (özel, 1 MB, JPEG): okuma sahibine ve paylaşılmış anlaşmanın karşı tarafına (`private.avatar_visible`); yazma/silme yalnızca `{uid}/` klasörüne.

## RLS ilkeleri

- Tüm tablolarda RLS açık. İstemci rolleri (`anon`, `authenticated`) için **insert/update/delete politikası yok.**
- `agreements` select: `creator_id = auth.uid()` **veya** (`counterparty_profile_id = auth.uid()` **ve** `status <> 'personal'`).
- `agreement_versions`, `installments`, `payments`, `payment_allocations`, `agreement_events` select: bağlı anlaşmayı görebiliyorsa (`exists (select 1 from agreements a where ... )` — performans için `security definer` yardımcı fonksiyon `can_view_agreement(uuid)`).
- `contacts` select: `owner_id = auth.uid()`. Karşı taraf, sahibin onu nasıl kaydettiğini görmez; karşı tarafın görünen adı `profiles.display_name`'den gelir.
- `profiles` select: kendisi + ortak anlaşması olan kullanıcıların yalnızca `id, display_name` alanları (görünüm üzerinden).
- `invites`, `rate_limits`, `notification_outbox`: istemciye hiç açık değil; yalnızca servis rolü / security definer fonksiyonlar.

## RPC listesi

| Fonksiyon | Görev |
|---|---|
| `create_agreement(input jsonb, idem_key uuid)` | Anlaşma + v1 + taksitler + peşinat |
| `update_personal_agreement(id, terms jsonb, row_version)` | Kişisel modda yeni versiyon |
| `share_agreement(id, phone, row_version)` | `pending`; davet; düz token yalnızca bir kez döner |
| `withdraw_share(id)` | Daveti iptal |
| `decide_agreement(id, version, terms_hash, decision, counter_terms jsonb null)` | accept / counter / reject |
| `decide_counter(id, version, terms_hash, decision, counter_terms jsonb null)` | Oluşturanın karşı öneriye yanıtı |
| `record_payment(id, input jsonb, row_version, idem_key)` | Rol ve moda göre confirmed / reported |
| `decide_payment(payment_id, decision)` | confirm / reject |
| `withdraw_payment(payment_id)` | |
| `void_payment(payment_id)` / `decide_void(payment_id, decision)` | Karşılıklı iptal |
| `propose_amendment(id, terms jsonb, reason)` | |
| `decide_amendment(id, version, terms_hash, decision)` | |
| `withdraw_amendment(id)` | |
| `open_dispute(id, reason, payment_id null)` / `resolve_dispute(id)` | |
| `request_cancel(id)` / `decide_cancel(id, decision)` | |
| `cancel_agreement(id)` | Yalnızca personal |
| `forgive_remaining(id, amount_minor null)` | Alacaklı |
| `get_dashboard()` | Ana sayfa özeti |
| `get_calendar(month date)` | |
| `get_agreement_detail(id)` | Anlaşma + versiyon + taksitler (türetilmiş durumla) + ödemeler + olaylar |
| `list_contacts_with_balance()` | |
| `find_by_paramnet_id(id)` | `{status: found/not_found/self/invalid, display_name?, paramnet_id?}`; saatte 20 |
| `share_agreement_by_id(id, paramnet_id, row_version)` | `pending`; hedef profile bağlı davet; `{status: shared/not_found/self/invalid}`; günde 10 |
| `regenerate_paramnet_id()` / `set_id_discoverable(on)` | 30 günde bir yeni ID / bulunabilirlik |
| `get_my_profile()` / `update_profile(first, last, username)` / `check_username(u)` / `set_avatar(path)` | Kendi profili (ADR-051) |
| `list_notifications(category, before_id, limit)` / `mark_notifications_read(ids)` / `set_reminder_prefs(days)` | Bildirim kutusu ve vade öncesi hatırlatma tercihi |
| `create_account(input, idem_key)` / `update_account(id, input, row_version)` / `archive_account(id, row_version)` / `list_accounts()` | Kendi hesapları, türetilmiş bakiye, Toplam Nakit (ADR-053) |
| `adjust_account_balance(id, target_minor, idem_key)` | Bakiye düzelt; fark = hedef − bakiye, bugünün tarihiyle |
| `create_transaction(input, idem_key)` / `update_transaction(id, input, row_version)` / `delete_transaction(id, row_version)` / `restore_transaction(id, row_version)` | Gider, gelir, transfer; düzeltme yalnızca silinir |
| `get_transaction(id)` / `list_transactions(month, account_id null)` / `get_cash_summary(month)` | Detay + olaylar / ay listesi + gelir-gider / Ana Sayfa özeti |
| `create_recurring` / `update_recurring` / `set_recurring_paused` / `delete_recurring` / `list_recurring` / `confirm_recurring` / `skip_recurring` | Tekrarlayan işlem (ADR-054) |
| `set_budget(category, limit)` / `list_budgets(month)` / `get_monthly_report(month)` | Bütçe ve aylık rapor |
| `create_card` / `update_card` / `archive_card` / `list_cards` / `get_card` | Kartlar ve türetilmiş ekstre (ADR-055) |
| `has_pin()` | Oturumdaki hesap PIN belirlemiş mi (ADR-046) |
| `pin_login_check(phone)` / `pin_login_record(phone, ok)` / `pin_mark_set(uid, phone)` | Yalnızca service_role; `pin-login` / `pin-set` kilit sayacı (ADR-049) |

## Edge functions

| Ad | Görev |
|---|---|
| `invite-open` | Token doğrula; yalnızca oluşturanın adını döndür |
| `invite-otp-send` | Turnstile + rate limit; hedef numaraya OTP |
| `invite-otp-verify` | OTP doğrula; 15 dk'lık onay oturumu |
| `invite-decide` | Onay oturumuyla karar; olay kaydına channel=web, ip_hash, user_agent |
| `link-pending-invites` | Yeni kayıtta bekleyen davetleri bağla — `complete_profile` içinde `private.link_pending_invites` (ADR-035) |
| `dispatch-notifications` | Outbox → Expo Push; geçersiz token temizliği |
| `schedule-reminders` | pg_cron, her gün 08:00 |
| `expire-invites` | pg_cron |
| `pin-login` | Telefon + PIN girişi; kilit kontrolü, türetilmiş parola ile Auth girişi, oturumu döndürür (ADR-049) |
| `pin-set` | Oturumdaki hesabın PIN'ini belirler; zayıf PIN'i reddeder |
| `send-sms-hook` | Supabase Auth OTP → yerli SMS sağlayıcı (Faz 3) |
