# İş Kuralları

Kaynak: `docs/PRODUCT_SPEC.md` Bölüm 5 ve 7.

## Kurallar (BR)

| Kod | Kural |
|---|---|
| BR-01 | Tüm tutarlar kuruş cinsinden tam sayı (`bigint`). Ondalıklı tip yok. |
| BR-02 | İlk sürümde para birimi TRY. Şema çoklu para birimine hazır; anlaşmanın para birimi sonradan değişmez. |
| BR-03 | Taksit tutarları toplamı + peşinat = anlaşma tutarı, her zaman. |
| BR-04 | Kalan borç = anlaşma tutarı − onaylı ödemeler − onaylı indirimler. Asla negatif değil. |
| BR-05 | Kayıt şartlarını yalnızca sahibi değiştirir. Her değişiklik yeni versiyon ve olay kaydıdır. |
| BR-08 | Kaydedilen ödeme doğrudan geçerlidir ve bakiyeden düşer. |
| BR-09 | Her ödeme ve oluşturma işlemi idempotency anahtarı taşır; tekrar eden istek yeni kayıt oluşturmaz. |
| BR-10 | Ödeme satırı silinmez; `voided` olur, dağıtımı geri alınır. Kapanmış kayıtta kalan sıfırın üstüne çıkarsa kayıt açılır. |
| BR-13 | Olay kaydı yalnızca eklenir (hesap silme hariç). |
| BR-14 | `settled` veya `cancelled` kayda yeni ödeme ve düzenleme eklenemez. |
| BR-15 | Kişiler arası kayıtta faiz yoktur. Faiz yalnızca banka kredisi için gösterilir (ADR-045). |
| BR-16 | Vade tarihleri `date` (Europe/Istanbul gününe göre), olay zamanları `timestamptz`. |
| BR-19 | Her kaydı, grubu ve bildirimi yalnızca sahibi görür. |
| BR-20 | Harcamanın payları toplamı harcama tutarına eşittir. Kuruş farkı ödeyene, ödeyen dahil değilse ilk dahil üyeye yazılır. |
| BR-21 | Grup bakiyeleri saklanmaz, türetilir; toplamları her zaman sıfırdır. |
| BR-22 | Harcamada ya da ödeşmede geçen üye gruptan çıkarılamaz. Ödeşmede iki taraf farklı üye olmalıdır. |

Kaldırılan kural numaraları (BR-06, 07, 11, 12, 17, 18) yeniden kullanılmaz.

## Ödeme planı üretimi

- **Tek seferlik:** tek taksit; vade boş olabilir (vadesiz).
- **Eşit taksit:** kalan = toplam − peşinat; taksit = floor(kalan / n); yuvarlama farkı (kalan − taksit × n) **son taksite** eklenir.
- **Periyot:** aylık (varsayılan), haftalık, iki haftalık, özel. Aylık planda her taksitin günü `min(ilk vadenin günü, o ayın son günü)` olur. Örnek: ilk vade 31 Ocak → 28/29 Şubat, 31 Mart, 30 Nisan, 31 Mayıs. Tarih her zaman ilk vadeden hesaplanır, bir önceki taksitten değil (kayma olmaz).
- **Eşit olmayan plan:** kullanıcı her satırın tarih ve tutarını düzenler; toplam kalan tutara eşit değilse kaydedilemez; her tutar > 0; tarihler artan (eşit olabilir).
- **Peşinat:** `payments` tablosunda `kind = down_payment`, `status = confirmed` olarak oluşturulur.

Örnek: 28.000,00 TL, peşinat 8.000,00, 5 taksit aylık, ilk 10 Kasım 2026 → 5 × 4.000,00; 10 Kas, 10 Ara, 10 Oca, 10 Şub, 10 Mar.
Örnek: 10.000,00 TL, 3 taksit → 3.333,33 / 3.333,33 / 3.333,34.

## Ödeme dağıtımı

- Varsayılan FIFO: en eski ödenmemiş taksitten başla.
- Taksitten az → o taksit `partial`.
- Taksitten fazla → artan sonraki taksitlere.
- Kalan borçtan fazla ödeme → `amount_exceeds_outstanding` hatası.
- Gelişmiş: kullanıcı ödemeyi belirli taksite yönlendirebilir (ilk sürümde opsiyonel).

## Düzenleme

- Taksit erteleme, plan düzenleme ve tutar düzeltme tek düzenleme ekranındadır; onay yoktur.
- Yeni plan **kalan tutar** üzerinden kurulur; yapılmış ödemeler ve dağıtımları korunur.
- İndirim yalnızca alacaklı sahipte vardır. `payments.kind = discount`.

## Kapanış ve iptal

- Kalan borç 0 olduğunda otomatik `settled` (aynı transaction'da). Bildirim gitmez.
- Sahip istediği zaman iptal eder.
- Kapanan ve iptal edilen kayıtlar silinmez; kullanıcı kendi görünümünden gizleyebilir.

## Hatırlatmalar

Yalnızca kayıt sahibine gider (ADR-064). Kullanıcı alacaklı da borçlu da olsa kendi kaydı için hatırlatılır.

| Zaman | Kime |
|---|---|
| Vadeden önce, tercihe göre 7, 3, 1 gün (varsayılan 3) | Sahip |
| Vade günü 10:00 | Sahip |
| Vade +1 gün (ödenmemişse) | Sahip |
| Vade +7 gün | Sahip |

Sessiz saatler 22:00–09:00 (Europe/Istanbul). `cancelled`, `settled` kayda hatırlatma yok. Banka kredisi taksitlerine de aynı kural uygulanır.

## Hesap bölme (ADR-064)

- Üyeler isimdir, hesapla bağı yoktur; bir üye `is_me`'dir.
- Üye bakiyesi = ödediği harcamalar − payları + yaptığı ödeşmeler − aldığı ödeşmeler.
- Sadeleştirme: en çok alacaklı ile en çok borçlu eşleştirilir, ödeme sayısı en aza iner, aynı girdi aynı sonucu verir. Eşitlikte küçük `seq` önce gelir.
- Grup bakiyeleri borç kaydı oluşturmaz, Ana Sayfa toplamlarına katılmaz, hatırlatma üretmez.
- Hesap `packages/shared` ve plpgsql'de aynıdır; aynı test vektörleriyle doğrulanır.
