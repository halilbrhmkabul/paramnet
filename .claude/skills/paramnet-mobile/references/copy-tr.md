# Türkçe Metinler ve Ton

Kaynak: `docs/PRODUCT_SPEC.md` Bölüm 3.4 ve 5.9.

## Ton ilkeleri

- **Kontrol değil kolaylık.** Uygulama tarafları birbirine karşı korumaz; ikisinin de işini kolaylaştırır.
- Hatırlatmalar kullanıcı adına değil **uygulama adına** konuşur. Amaç para isteme mahcubiyetini kaldırmak.
- Suçlayıcı, tehditkâr veya resmi-hukuki dil yok ("borcunuzu ödemediniz", "yasal işlem").
- "Sen" hitabı, kısa cümleler, teknik terim yok ("versiyon", "hash", "durum makinesi" kullanıcıya görünmez).
- Uygulamanın adı her zaman **Paramnet** (büyük P, bitişik). Türkçe ekler kesme işaretiyle: Paramnet'te, Paramnet'e, Paramnet'i.
- Para her zaman `₺12.000,00` biçiminde; tarih `10 Kasım`.

## Kaçınılacak → kullanılacak

| Kaçın | Kullan |
|---|---|
| Borcunu onayla | Ödeme planımızı birlikte takip edelim |
| Borç talebi | Paylaşılan plan |
| Ödemen gecikti | Bugün ödeme günü |
| İtiraz et | Bir şey yanlış mı? |
| Reddet (ödeme) | Bu ödemeyi almadım |
| Hata oluştu | Bir sorun çıktı, tekrar dener misin? |
| İşlem başarılı | Kaydedildi |

## Anahtar metinler (`src/i18n/tr.ts` başlangıcı)

| Anahtar | Metin |
|---|---|
| `app.name` | Paramnet |
| `welcome.title` | Verdiğin, aldığın ve taksitle ödediğin her şey tek yerde. |
| `welcome.subtitle` | Planı kaydet, istersen karşı tarafla paylaş, ödemeleri birlikte takip edin. |
| `welcome.cta` | Başla |
| `phone.title` | Telefon numaran |
| `phone.helper` | Sana bir doğrulama kodu göndereceğiz. |
| `otp.title` | Kodu gir |
| `otp.resend` | Kodu tekrar gönder |
| `otp.error.invalid` | Kod hatalı. Tekrar dener misin? |
| `otp.error.expired` | Kodun süresi doldu. Yeni kod iste. |
| `profile.name` | Adın nasıl görünsün? |
| `profile.notifications.reason` | Ödeme günlerini hatırlatabilmemiz için bildirim izni gerekiyor. |
| `home.receivable` | Alacağın |
| `home.payable` | Borcun |
| `home.dueThisMonth` | Bu ay ödenecek |
| `home.collectThisMonth` | Bu ay tahsil edilecek |
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
| `agreement.personalBadge` | Yalnızca sen görüyorsun |
| `agreement.status.personal` | Kişisel |
| `agreement.status.pending` | Onay bekliyor |
| `agreement.status.countered` | Düzeltme önerildi |
| `agreement.status.active` | Aktif |
| `agreement.status.amendment_pending` | Değişiklik bekliyor |
| `agreement.status.disputed` | İtirazlı |
| `agreement.status.rejected` | Kabul edilmedi |
| `agreement.status.settled` | Kapandı |
| `agreement.status.cancelled` | İptal edildi |
| `agreement.owesYou` | Sana borçlu |
| `agreement.youOwe` | Borçlusun |
| `payment.received` | Ödeme aldım |
| `payment.made` | Ödeme yaptım |
| `payment.awaiting` | {amount} onay bekliyor |
| `payment.notReceived` | Bu ödemeyi almadım |
| `share.title` | Planı paylaş |
| `share.message` | {name} seninle Paramnet'te bir ödeme planı paylaştı. Birlikte takip etmek için: {link} |
| `invite.title` | {name} seninle bir ödeme planı paylaştı |
| `invite.accept` | Onaylıyorum |
| `invite.counter` | Düzeltme öner |
| `invite.reject` | Bu plan bana ait değil |
| `error.generic` | Bir sorun çıktı, tekrar dener misin? |
| `error.offline` | İnternet bağlantısı yok. Kayıt eklemek için bağlantı gerekiyor. |
| `error.conflict` | Bu kayıt az önce güncellendi. Son hâline bak. |
| `error.exceedsOutstanding` | Bu tutar kalan borçtan fazla. |
| `settled.title` | Tebrikler, bu plan tamamlandı! |

## Bildirim şablonları

| Anahtar | Metin |
|---|---|
| `notif.dueSoon` | {date} tarihinde {name} için {amount} ödemen var. |
| `notif.dueToday` | Bugün ödeme günü: {amount} ({seq}/{count}. taksit). |
| `notif.overdue1` | Dünkü {amount} ödeme henüz kaydedilmedi. Ödediysen kaydet. |
| `notif.overdue7` | {seq}. taksit 7 gündür açık görünüyor. |
| `notif.paymentReported` | {name} {amount} ödeme yaptığını bildirdi. Aldın mı? |
| `notif.paymentConfirmed` | {name} {amount} ödemeni onayladı. Kalan: {remaining}. |
| `notif.paymentRecorded` | {name} {amount} ödemeni kaydetti. Kalan: {remaining}. |
| `notif.paymentRejected` | {name} {amount} ödemeyi almadığını belirtti. Bir sorun varsa birlikte bakabilirsiniz. |
| `notif.paymentPending` | {name} {amount} ödeme bildirdi. Onaylıyor musun? (7 gün yanıtsız kalınca, alacaklıya) |
| `notif.shareReceived` | {name} seninle {amount} tutarında bir ödeme planı paylaştı. Göz atar mısın? |
| `notif.shareAccepted` | {name} ödeme planını onayladı. |
| `notif.shareCountered` | {name} planda bir düzeltme önerdi. |
| `notif.shareRejected` | {name} bu planın kendisine ait olmadığını belirtti. |
| `notif.counterAccepted` | {name} düzeltmeni kabul etti. Plan yürürlükte. |
| `notif.shareWithdrawn` | {name} paylaştığı planı geri çekti. |
| `notif.inviteExpired` | {name} için paylaştığın bağlantının süresi doldu. İstersen yeniden paylaşabilirsin. |
| `notif.amendmentProposed` | {name} planda bir değişiklik önerdi. Göz atar mısın? |
| `notif.amendmentAccepted` | {name} değişiklik önerini kabul etti. Yeni plan geçerli. |
| `notif.amendmentRejected` | {name} değişiklik önerini kabul etmedi. Mevcut plan geçerli. |
| `notif.disputeOpened` | {name} bu anlaşmaya itiraz etti. Gerekçesine göz atabilirsin. |
| `notif.disputeResolved` | {name} itirazını geri çekti. Anlaşma yeniden yürürlükte. |
| `notif.cancelRequested` | {name} anlaşmayı birlikte iptal etmek istiyor. Göz atar mısın? |
| `notif.cancelAccepted` | {name} iptal talebini kabul etti. Anlaşma iptal edildi. |
| `notif.cancelRejected` | {name} iptal talebini kabul etmedi. Anlaşma sürüyor. |
| `notif.forgiven` | {name} borcundan {amount} indirdi. Kalan: {remaining}. / Kalanın tamamında: {name} kalan {amount} borcunu sildi. Anlaşma kapandı. |
| `notif.settled` | {name} ile planınız tamamlandı. |

Metinler `supabase/functions/_shared/notifications.ts` `render()` ile üretilir; `packages/shared/src/notifications.contract.test.ts` bu tabloyla birebir aynı olduğunu doğrular.
