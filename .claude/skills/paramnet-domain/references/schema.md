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
| target_phone_e164 | text | |
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
- `rate_limits`: key text, window_start timestamptz, count int (RPC/edge rate limit sayaçları).

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

## Edge functions

| Ad | Görev |
|---|---|
| `invite-open` | Token doğrula; yalnızca oluşturanın adını döndür |
| `invite-otp-send` | Turnstile + rate limit; hedef numaraya OTP |
| `invite-otp-verify` | OTP doğrula; 15 dk'lık onay oturumu |
| `invite-decide` | Onay oturumuyla karar; olay kaydına channel=web, ip_hash, user_agent |
| `link-pending-invites` | Yeni kayıtta bekleyen davetleri bağla |
| `dispatch-notifications` | Outbox → Expo Push; geçersiz token temizliği |
| `schedule-reminders` | pg_cron, her gün 08:00 |
| `expire-invites` | pg_cron |
| `send-sms-hook` | Supabase Auth OTP → yerli SMS sağlayıcı (Faz 3) |
