# Maestro akışları

testing.md'deki Faz 1 akışları. **Henüz hiçbir cihazda çalıştırılmadı** (F1-19: Maestro CLI, simülatör/emülatör
veya development build gerekir). Seçiciler testID'lerdir (`id:`), metin yalnızca son çare.

Çalıştırma (development build yüklü bir simülatör/emülatör açıkken):

```bash
pnpm --filter mobile e2e
```

- `appId` development build'in kimliği `com.paramnet.app`; Expo Go ile çalışmaz.
- Sahte modda (`EXPO_PUBLIC_API_MODE=mock`) her numara, Supabase modunda yalnızca `+905550000001/2/3` kodu `123456` ile girer.
- Tarih seçici yerel bileşen olduğu için akışlar varsayılan tarihleri kullanır (ilk ödeme bugünden 1 ay sonra).
