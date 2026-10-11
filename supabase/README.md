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
