# Veri Modeli

Kaynak: `docs/PRODUCT_SPEC.md` Bölüm 10. Tüm tablolarda `created_at timestamptz not null default now()` vardır (aşağıda tekrar edilmez). Para sütunları `_minor` ile biter ve `bigint`'tir.

## Enum'lar

```sql
create type agreement_status as enum ('personal','settled','cancelled');
create type agreement_kind   as enum ('loan','installment_purchase');
create type party_role       as enum ('creditor','debtor');
create type contact_kind     as enum ('person','merchant');
create type payment_status   as enum ('confirmed','voided');
create type payment_kind     as enum ('payment','down_payment','discount');
create type payment_method   as enum ('cash','transfer','card','other');
create type account_kind     as enum ('bank','cash','savings','other');
create type transaction_kind as enum ('expense','income','transfer','adjustment');
create type recurrence_frequency as enum ('weekly','monthly','yearly');
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
| reminder_before_days | int[] default {3,0} | 7, 3, 1, 0 alt kümesi |

### contacts
| Sütun | Tip | Not |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid FK profiles | |
| display_name | text not null | Sahibin verdiği ad |
| kind | contact_kind default 'person' | |

### agreements
| Sütun | Tip | Not |
|---|---|---|
| id | uuid PK | |
| creator_id | uuid FK profiles | |
| creator_role | party_role | |
| counterparty_contact_id | uuid FK contacts | Oluşturanın gözünden |
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
| row_version | int default 1 | İyimser kilit |
| settled_at, cancelled_at | timestamptz null | |

İndeks: `(creator_id, status)`.

### agreement_versions
| Sütun | Tip | Not |
|---|---|---|
| agreement_id, version | PK (composite) | |
| terms | jsonb | `{ principal_minor, down_payment_minor, plan:[{seq,due_date,amount_minor}], notes }` |
| created_by | uuid | |
| reason | text null | |

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
| recorded_by | uuid | |
| idempotency_key | uuid unique | |
| attachment_path | text null | Storage yolu |

### payment_allocations
`payment_id uuid FK`, `installment_id uuid FK`, `amount_minor bigint > 0`; PK `(payment_id, installment_id)`.

### agreement_events (yalnızca ekleme)
| Sütun | Tip | Not |
|---|---|---|
| id | bigint identity PK | |
| agreement_id | uuid | |
| actor_id | uuid null | Sistem olayında null |
| type | text | Bkz. state-machines.md |
| version | int null | |
| payload | jsonb | |

### Diğer
- `reminders`: id, agreement_id, installment_id null, user_id, fire_at timestamptz, kind text, status (scheduled, sent, cancelled).
- `notification_outbox`: id, user_id, template text, payload jsonb, status (pending, sent, failed), attempts int, next_attempt_at.
- `push_tokens`: user_id, expo_token unique, platform, last_seen_at.
- `consents`: user_id, document (kvkk, terms), version, accepted_at.
- `pin_login_attempts` (istemciye kapalı, ADR-049): phone_hash text pk (sha256), failed_count, last_failed_at, locked_until. 1 günden eski satırları pg_cron siler.
- `user_pins` (istemciye kapalı): user_id pk → auth.users, pin_set_at. Satırı yoksa hesap PIN'den önceki bir hesaptır.
- `rate_limits`: key text, window_start timestamptz, count int (RPC/edge rate limit sayaçları). Hata fırlatan RPC sayacı da geri alır; sayılması gereken sonuçlar (ör. "bulunamadı") hata değil değer döner.
- `notifications` (istemciye kapalı, ADR-051): id bigint identity, user_id, template, payload, agreement_id null, read_at null. `notification_outbox`'a her ekleme tetikleyiciyle buraya da yazılır; 90 gün sonra pg_cron siler.
- `accounts` (istemciye kapalı, ADR-053): id, owner_id, kind, name (≤40), bank_name null (≤40; IBAN yok), opening_balance_minor bigint (±10¹³, eksi olabilir), include_in_total, archived_at null, idempotency_key unique, row_version, updated_at. `created_at` `clock_timestamp()` (ekleme sırası).
- `transactions` (istemciye kapalı): id, owner_id, kind, account_id, to_account_id null (yalnızca transfer, farklı hesap), amount_minor bigint (>0; yalnızca adjustment işaretli), category null (expense/income'da zorunlu, `private.is_category_for`), title null (≤80), note null (≤500), occurred_on date, idempotency_key unique, deleted_at null (geçici silme), row_version, updated_at. Bakiye saklanmaz: `private.account_balance`.
- `transaction_events` (yalnızca ekleme): transaction_id, owner_id, type (created, updated, deleted, restored), changes jsonb `{alan: [eski, yeni]}`. Hesap silmede `paramnet.erasure` ile birlikte silinir.
- `recurring_rules` (istemciye kapalı, ADR-054): id, owner_id, kind (expense/income), name (≤80), amount_minor, category, account_id, frequency, start_on, confirm_each, tracking_from (borç sayılan ilk gün), paused_at null, idempotency_key, row_version. Tarih kuralı `private.recurrence_dates` = `packages/shared` `occurrencesBetween` (`test-vectors/recurrence.json`).
- `recurring_occurrences`: (rule_id, occurrence_on) pk, status (posted, skipped), transaction_id null, idempotency_key. Saatlik `post_due_recurring` onay istemeyen kuralları yazar.
- `budgets`: (owner_id, category) pk, limit_minor (>0).
- `loans` (istemciye kapalı, ADR-056): id, owner_id, bank_name, loan_type, principal_minor, monthly_rate_bps (0–2000; 339 = %3,39), term_months 1–120, first_due_on, installment_minor, payment_account_id null, archived_at null, idempotency_key, row_version. Plan `private.loan_payment` / `private.loan_schedule` = `packages/shared` `annuityPayment` / `loanSchedule` (`test-vectors/loans.json`).

- `split_groups` (istemciye kapalı, ADR-064): id, owner_id, title (≤80), archived_at null, idempotency_key, row_version.
- `split_group_members`: id, group_id, seq, display_name (≤60), is_me. Grup başına bir `is_me`.
- `split_expenses`: id, group_id, title (≤80), total_minor, spent_on, payer_member_id, mode (equal, amount, percent), idempotency_key, deleted_at null, row_version.
- `split_expense_shares`: (expense_id, member_id) pk, share_minor ≥ 0.
- `split_settlements`: id, group_id, from_member_id, to_member_id (farklı), amount_minor, settled_on, idempotency_key, deleted_at null.
- `split_group_events` (yalnızca ekleme): id, group_id, type, payload.
- `transactions.to_loan_id`: kredi taksit kaydı; düzenlenmez, yalnızca silinir. Hesap seçilmediyse `account_id` boştur.
- Storage `avatars` (özel, 1 MB, JPEG): okuma, yazma ve silme yalnızca `{uid}/` klasörüne.

## RLS ilkeleri

- Tüm tablolarda RLS açık. İstemci rolleri (`anon`, `authenticated`) için **insert/update/delete politikası yok.**
- Her tablo yalnızca sahibine okunur: `creator_id = auth.uid()` ya da `owner_id = auth.uid()`; bağlı tablolar üst kayda bakar.
- Kullanıcılar arası görünürlük yoktur. `profiles` yalnızca kendisine okunur.
- `rate_limits`, `notification_outbox`: istemciye hiç açık değil.

## RPC listesi

| Fonksiyon | Görev |
|---|---|
| `create_agreement(input jsonb, idem_key uuid)` | Anlaşma + v1 + taksitler + peşinat |
| `create_agreement_with_paid(input jsonb, p_paid_count int, idem_key uuid)` | `create_agreement` + vadesi geçmiş ilk n taksitin ödemesi, tek işlemde (ADR-059) |
| `update_personal_agreement(id, terms jsonb, row_version)` | Yeni versiyon |
| `record_payment(id, input jsonb, row_version, idem_key)` | `confirmed` |
| `void_payment(payment_id, row_version)` | `voided`; dağıtım geri alınır, gerekirse kayıt açılır |
| `cancel_agreement(id, row_version)` | İptal |
| `forgive_remaining(id, amount_minor null)` | Alacaklı sahip |
| `create_split_group` / `update_split_group` / `archive_split_group` / `list_split_groups` / `get_split_group` | Grup, üyeler, türetilmiş bakiyeler, sadeleştirilmiş borçlar (ADR-064) |
| `add_split_expense` / `update_split_expense` / `delete_split_expense` | Harcama ve paylar |
| `add_split_settlement` / `delete_split_settlement` | Ödeşme |
| `get_dashboard()` | Ana sayfa özeti |
| `get_calendar(month date)` | |
| `get_agreement_detail(id)` | Anlaşma + versiyon + taksitler (türetilmiş durumla) + ödemeler + olaylar |
| `list_contacts_with_balance()` | |
| `get_my_profile()` / `update_profile(first, last, username)` / `check_username(u)` / `set_avatar(path)` | Kendi profili (ADR-051) |
| `list_notifications(before_id, limit)` / `mark_notifications_read(ids)` / `set_reminder_prefs(days)` | Bildirim kutusu ve vade öncesi hatırlatma tercihi |
| `create_account(input, idem_key)` / `update_account(id, input, row_version)` / `archive_account(id, row_version)` / `list_accounts()` | Kendi hesapları, türetilmiş bakiye, Toplam Nakit (ADR-053) |
| `adjust_account_balance(id, target_minor, idem_key)` | Bakiye düzelt; fark = hedef − bakiye, bugünün tarihiyle |
| `create_transaction(input, idem_key)` / `update_transaction(id, input, row_version)` / `delete_transaction(id, row_version)` / `restore_transaction(id, row_version)` | Gider, gelir, transfer; düzeltme yalnızca silinir |
| `get_transaction(id)` / `list_transactions(month, account_id null)` / `get_cash_summary(month)` | Detay + olaylar / ay listesi + gelir-gider / Ana Sayfa özeti |
| `create_recurring` / `update_recurring` / `set_recurring_paused` / `delete_recurring` / `list_recurring` / `confirm_recurring` / `skip_recurring` | Tekrarlayan işlem (ADR-054) |
| `set_budget(category, limit)` / `list_budgets(month)` / `get_monthly_report(month)` | Bütçe ve aylık rapor |
| `create_loan` / `update_loan` / `archive_loan` / `list_loans` / `get_loan` / `record_loan_payment` | Banka kredileri ve taksit kaydı (ADR-056) |
| `has_pin()` | Oturumdaki hesap PIN belirlemiş mi (ADR-046) |
| `pin_login_check(phone)` / `pin_login_record(phone, ok)` / `pin_mark_set(uid, phone)` | Yalnızca service_role; `pin-login` / `pin-set` kilit sayacı (ADR-049) |

## Edge functions

| Ad | Görev |
|---|---|
| `dispatch-notifications` | Outbox → Expo Push; geçersiz token temizliği |
| `schedule-reminders` | pg_cron, her gün 08:00 |
| `pin-login` | Telefon + PIN girişi; kilit kontrolü, türetilmiş parola ile Auth girişi, oturumu döndürür (ADR-049) |
| `pin-set` | Oturumdaki hesabın PIN'ini belirler; zayıf PIN'i reddeder |
| `delete-account` | Hesabı ve tüm verisini siler |
| `send-sms-hook` | Supabase Auth OTP → yerli SMS sağlayıcı (Faz 3) |
