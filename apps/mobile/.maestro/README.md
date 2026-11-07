# Maestro akışları

testing.md'deki Faz 1 akışları. Dördü de iPhone 18 Pro (iOS 27) simülatöründe, sahte modda, Release derlemesiyle arka arkaya iki turda geçti (2026-11-07, ADR-063). Android'de ve `supabase` modunda henüz çalıştırılmadı. Seçiciler testID'lerdir (`id:`), metin yalnızca son çare.

Çalıştırma (Maestro CLI ve uygulamanın yüklü olduğu bir simülatör/emülatör açıkken):

```bash
pnpm --filter mobile e2e
```

- `appId` development build'in kimliği `com.paramnet.app`; Expo Go ile çalışmaz.
- Sahte modda (`EXPO_PUBLIC_API_MODE=mock`) her numara, Supabase modunda yalnızca `+905550000001/2/3` kodu `123456` ile girer.
- Tarih seçici yerel bileşen olduğu için akışlar varsayılan tarihleri kullanır (ilk ödeme bugünden 1 ay sonra).
- Maestro Java 17 ister. Birden çok simülatör açıksa `maestro --device <UDID> test ...` ile hangisi olduğu söylenir.
- Sürücü (`xcodebuild test-without-building`) her çalıştırmadan sonra arkada kalabilir ve yenisini düşürür; akış rastgele bir adımda "Connection refused" ile biterse önce o süreç kapatılır.
- Sayısal klavyede kapatma tuşu yok: akışlar kullanıcı gibi sürükleyerek kapatır (`hideKeyboard` iOS'ta çalışmıyor). Altta kalan düğmeye klavye açıkken dokunulursa dokunuş klavyeye gider.
- Xcode 27 ile derlenen uygulama UIScene benimsemezse açılışta kapanır; yerel `ios/` klasörüne elle yama gerekir (ADR-063). Kalıcı çözüm F3-06'dan önce.
