# İş Kuralları

Kaynak: `docs/PRODUCT_SPEC.md` Bölüm 5 ve 7.

## Kurallar (BR)

| Kod | Kural |
|---|---|
| BR-01 | Tüm tutarlar kuruş cinsinden tam sayı (`bigint`). Ondalıklı tip yok. |
| BR-02 | İlk sürümde para birimi TRY. Şema çoklu para birimine hazır; anlaşmanın para birimi sonradan değişmez. |
| BR-03 | Taksit tutarları toplamı + peşinat = anlaşma tutarı, her zaman. |
| BR-04 | Kalan borç = anlaşma tutarı − onaylı ödemeler − onaylı indirimler. Asla negatif değil. |
| BR-05 | Paylaşılan ve aktif anlaşmanın şartları yalnızca karşı tarafın onayladığı değişiklik talebiyle değişir. |
| BR-06 | Her onay belirli versiyona ve o versiyonun `terms_hash`'ine bağlanır. Gösterilen ve onaylanan versiyon aynı olmalı. |
| BR-07 | Bir anlaşmada aynı anda en fazla bir açık değişiklik talebi. |
| BR-08 | Borçlunun bildirdiği ödeme alacaklı onaylamadan bakiyeden düşmez. Alacaklının kaydettiği ödeme doğrudan onaylıdır. |
| BR-09 | Her ödeme/karar işlemi idempotency anahtarı taşır; tekrar eden istek yeni kayıt oluşturmaz. |
| BR-10 | Onaylanmış ödeme silinmez; yalnızca karşı taraf onayıyla `voided` olur. |
| BR-11 | Davet linkini yalnızca davetteki hedef numarayı OTP ile doğrulayan kişi kullanabilir. |
| BR-12 | Kullanıcı kendisiyle anlaşma paylaşamaz. |
| BR-13 | Olay kaydı yalnızca eklenir (hesap silme anonimleştirmesi hariç). |
| BR-14 | `settled`, `cancelled` veya `disputed` anlaşmaya yeni ödeme/değişiklik eklenemez (itiraz çözülene kadar). |
| BR-15 | Faiz hesaplanmaz, faiz alanı yoktur. |
| BR-16 | Vade tarihleri `date` (Europe/Istanbul gününe göre), olay zamanları `timestamptz`. |

## Ödeme planı üretimi

- **Tek seferlik:** tek taksit; vade boş olabilir (vadesiz).
- **Eşit taksit:** kalan = toplam − peşinat; taksit = floor(kalan / n); yuvarlama farkı (kalan − taksit × n) **son taksite** eklenir.
- **Periyot:** aylık (varsayılan), haftalık, iki haftalık, özel. Aylık planda her taksitin günü `min(ilk vadenin günü, o ayın son günü)` olur. Örnek: ilk vade 31 Ocak → 28/29 Şubat, 31 Mart, 30 Nisan, 31 Mayıs. Tarih her zaman ilk vadeden hesaplanır, bir önceki taksitten değil (kayma olmaz).
- **Eşit olmayan plan:** kullanıcı her satırın tarih ve tutarını düzenler; toplam kalan tutara eşit değilse kaydedilemez; her tutar > 0; tarihler artan (eşit olabilir).
- **Peşinat:** `payments` tablosunda `kind = down_payment`, `status = confirmed` olarak oluşturulur.

Örnek: ₺28.000,00, peşinat 8.000,00, 5 taksit aylık, ilk 10 Kasım 2026 → 5 × 4.000,00; 10 Kas, 10 Ara, 10 Oca, 10 Şub, 10 Mar.
Örnek: ₺10.000,00, 3 taksit → 3.333,33 / 3.333,33 / 3.333,34.

## Ödeme dağıtımı

- Varsayılan FIFO: en eski ödenmemiş taksitten başla.
- Taksitten az → o taksit `partial`.
- Taksitten fazla → artan sonraki taksitlere.
- Kalan borçtan fazla ödeme → `amount_exceeds_outstanding` hatası.
- Gelişmiş: kullanıcı ödemeyi belirli taksite yönlendirebilir (ilk sürümde opsiyonel).
- `reported` (onay bekleyen) ödemeler dağıtılmaz ve bakiyeden düşmez; UI'da ayrıca gösterilir.

## Ödemeyi kim kaydeder

| Kaydeden | Mod | Sonuç |
|---|---|---|
| Sahip | personal | `confirmed` |
| Alacaklı | shared | `confirmed`, borçluya bilgi bildirimi |
| Borçlu | shared | `reported`, alacaklıya onay isteği; 7 gün yanıt yoksa hatırlatma, otomatik onay yok |

## Değişiklik talepleri

- Türler: taksit erteleme, plan yeniden düzenleme, tutar düzeltme, indirim/af.
- Yeni plan **kalan tutar** üzerinden kurulur; geçmiş onaylı ödemeler ve dağıtımları korunur.
- İndirim/af yalnızca alacaklı tarafından yapılır ve karşı taraf onayı gerekmez (alacaklının aleyhine). `payments.kind = discount`.

## Kapanış ve iptal

- Kalan borç 0 olduğunda otomatik `settled` (aynı transaction'da).
- Kişisel mod: sahip istediği zaman iptal eder.
- Paylaşılan `pending`: oluşturan geri çeker → `personal`.
- Paylaşılan `active`: iptal karşılıklı onay ister.
- Kapanan ve iptal edilen anlaşmalar silinmez; kullanıcı kendi görünümünden gizleyebilir (`hidden_by` gibi kullanıcıya özel bir işaretle).

## Hatırlatmalar

| Zaman | Kime |
|---|---|
| Vadeden 3 gün önce | Borçlu |
| Vade günü 10:00 | Borçlu ve alacaklı |
| Vade +1 gün (ödenmemişse) | Borçlu |
| Vade +7 gün | Borçlu ve alacaklı |
| `reported` ödeme bekliyorsa | Alacaklı |

Sessiz saatler 22:00–09:00 (Europe/Istanbul). `disputed`, `cancelled`, `settled` anlaşmalara hatırlatma yok. Kullanıcı anlaşma bazında kapatabilir.
