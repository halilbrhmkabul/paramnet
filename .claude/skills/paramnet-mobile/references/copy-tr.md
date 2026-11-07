# Türkçe Metinler ve Ton

Kaynak: `docs/PRODUCT_SPEC.md` Bölüm 3.4 ve 5.9.

## Ton ilkeleri

- Uygulama yalnızca kullanıcıyla konuşur. Karşı tarafa bir şey gönderildiğini düşündürecek ifade yok.
- Suçlayıcı, tehditkâr veya resmi-hukuki dil yok ("borcunuzu ödemediniz", "yasal işlem").
- "Sen" hitabı, kısa cümleler, teknik terim yok ("versiyon", "durum makinesi" kullanıcıya görünmez).
- Uygulamanın adı her zaman **Paramnet** (büyük P, bitişik). Türkçe ekler kesme işaretiyle: Paramnet'te, Paramnet'e, Paramnet'i.
- Para her zaman `12.000,00 TL` biçiminde; tarih `10 Kasım`.

## Kaçınılacak → kullanılacak

| Kaçın | Kullan |
|---|---|
| Ödemen gecikti | Bugün ödeme günü |
| Hata oluştu | Bir sorun çıktı, tekrar dener misin? |
| İşlem başarılı | Kaydedildi |

## Anahtar metinler (`src/i18n/tr.ts` başlangıcı)

| Anahtar | Metin |
|---|---|
| `app.name` | Paramnet |
| `welcome.title` | Paranı, borçlarını ve gelecekteki ödemelerini tek yerden yönet. |
| `welcome.create` / `welcome.signIn` | Hesap oluştur / Giriş yap |
| `login.signInTitle` | Tekrar hoş geldin |
| `login.signInHelper` | Telefon numaran ve 6 haneli şifrenle giriş yap. |
| `login.forgot` | Şifremi unuttum |
| `pin.createTitle` / `pin.confirmTitle` | Şifreni belirle / Şifreni tekrar gir |
| `pin.weak` | Bu şifre kolay tahmin edilir. Art arda ya da aynı rakamlar kullanma. |
| `error.attemptsLeft` | Numara ya da şifre hatalı. {count} deneme hakkın kaldı. |
| `error.accountLocked` | Çok fazla hatalı deneme yapıldı. {minutes} dakika sonra tekrar dene ya da şifreni SMS ile yenile. |
| `otp.title` | Kodu gir |
| `otp.resend` | Kodu tekrar gönder |
| `otp.error.invalid` | Kod hatalı. Tekrar dener misin? |
| `otp.error.expired` | Kodun süresi doldu. Yeni kod iste. |
| `profile.name` | Adın nasıl görünsün? |
| `profile.notifications.reason` | Ödeme günlerini hatırlatabilmemiz için bildirim izni gerekiyor. |
| `home.receivable` | Alacağın |
| `home.payable` | Borcun |
| `home.dueThisMonth` | Bu ay ödenecek |
| `home.collectThisMonth` | Bu ay alınacak |
| `home.overdue` | Gecikenler |
| `home.empty.title` | İlk kaydını ekle |
| `home.empty.body` | Bir borcu veya taksitli alışverişi kaydet, ödeme günlerini biz hatırlatalım. |
| `new.lent` | Borç verdim |
| `new.borrowed` | Borç aldım |
| `new.boughtInstallment` | Taksitle aldım |
| `new.soldInstallment` | Taksitle sattım |
| `plan.total` | Toplam |
| `plan.downPayment` | Peşinat |
| `plan.remaining` | Kalan |
| `plan.mismatch` | Taksitlerin toplamı kalan tutara eşit olmalı. Fark: {amount} |
| `agreement.status.personal` | Açık |
| `agreement.status.settled` | Kapandı |
| `agreement.status.cancelled` | İptal edildi |
| `agreement.owesYou` | Sana borçlu |
| `agreement.youOwe` | Borçlusun |
| `payment.received` | Ödeme aldım |
| `payment.made` | Ödeme yaptım |
| `error.generic` | Bir sorun çıktı, tekrar dener misin? |
| `error.offline` | İnternet bağlantısı yok. Kayıt eklemek için bağlantı gerekiyor. |
| `error.conflict` | Bu kayıt az önce güncellendi. Son hâline bak. |
| `error.exceedsOutstanding` | Bu tutar kalan borçtan fazla. |
| `settled.title` | Tebrikler, bu plan tamamlandı! |
| `split.privacy` | Bu grubu yalnızca sen görüyorsun. |
| `split.settledUp` | Herkes ödeşti. |
| `split.owes` | {from}, {to} kişisine {amount} ödeyecek. |

## Bildirim şablonları

Yalnızca kayıt sahibine gider (ADR-064).

| Anahtar | Borçluysa | Alacaklıysa |
|---|---|---|
| `notif.dueSoon` | {date} tarihinde {name} için {amount} ödemen var. | {date} tarihinde {name} kişisinden {amount} alacağın var. |
| `notif.dueToday` | Bugün ödeme günü: {amount} ({seq}/{count}. taksit). | Bugün {name} ödeme günü: {amount}. |
| `notif.overdue1` | Dünkü {amount} ödeme henüz kaydedilmedi. Ödediysen kaydet. | {name} için dünkü {amount} henüz kaydedilmedi. Aldıysan kaydet. |
| `notif.overdue7` | {seq}. taksit 7 gündür açık görünüyor. | {name} için {seq}. taksit 7 gündür açık görünüyor. |

Metinler `supabase/functions/_shared/notifications.ts` `render()` ile üretilir; `packages/shared/src/notifications.contract.test.ts` bu tabloyla birebir aynı olduğunu doğrular.
