# Yerel Supabase notları

## Bildirimler (F1-18)

Hatırlatmalar `pg_cron` ile kuyruğa girer (`enqueue-reminders`, 15 dakikada bir). Kuyruğu her dakika
`dispatch-notifications` edge function'ı boşaltır; `private.trigger_dispatch()` fonksiyonu çağırmak için
Vault'taki iki sırrı kullanır. Sırlar yoksa hiçbir şey çağrılmaz.

Yerelde bir kez (her `db reset`'ten sonra):

```sql
-- Studio SQL editörü veya: docker exec -i supabase_db_paramnet psql -U postgres
select vault.create_secret('http://supabase_kong_paramnet:8000', 'project_url');
select vault.create_secret('<pnpm supabase status → SERVICE_ROLE_KEY>', 'service_role_key');
```

Fonksiyonu yerelde çalıştırmak için:

```bash
pnpm supabase functions serve dispatch-notifications
```

Uzak projede `project_url` = `https://<ref>.supabase.co`, `service_role_key` = projenin servis anahtarı
(yalnızca Vault'ta; istemciye asla girmez). Expo'nun gelişmiş push güvenliği açılırsa fonksiyona
`EXPO_ACCESS_TOKEN` sırrı verilir.

Cihaza push için uygulamanın bir EAS proje kimliği (`extra.eas.projectId`) olmalı (F3-06); yoksa uygulama
token almaz ve hatırlatma göndermez. Android'de Expo Go uzak push almaz; development build gerekir.

## SMS (F3-04)

Giriş kodu Supabase Auth'un **Send SMS Hook**'u ile `send-sms-hook` fonksiyonuna, oradan yerli sağlayıcıya
gider; web onayındaki kod (`invite-otp-send`) aynı katmanı kullanır. `SMS_MODE`:

| Değer | Davranış |
|---|---|
| `test` | Hiçbir şey gönderilmez; yalnızca +905550000001/2/3 (kod `123456`). CI ve varsayılan yerel ayar. |
| `log` | Kod fonksiyon log'una yazılır (numara maskeli). Yalnızca yerel yığında çalışır; kendi numaranla Expo Go'da denemek için. |
| `netgsm` | Gerçek SMS; `NETGSM_USERCODE`, `NETGSM_PASSWORD`, `NETGSM_HEADER` gerekir. |

Kendi numaranla yerelde denemek:

```bash
sed 's/^SMS_MODE=test/SMS_MODE=log/' supabase/functions/.env.example > /tmp/fn.env
pnpm supabase functions serve --env-file /tmp/fn.env
```

Üretimde:
- Dashboard → Authentication → Hooks → Send SMS: HTTP, URL `https://<ref>.supabase.co/functions/v1/send-sms-hook`.
- Üretilen sırrı `supabase secrets set SEND_SMS_HOOK_SECRET=v1,whsec_...` ile fonksiyona ver.
- `SMS_MODE=netgsm` ve Netgsm bilgilerini de aynı şekilde sır olarak tanımla.
- Netgsm OTP alan adları ve yanıt kodları ilk gerçek hesapla, sağlayıcı dokümanından doğrulanmalı (ADR-040).
