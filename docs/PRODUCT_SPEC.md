> Bu dosya `docs/Paramnet_Urun_ve_Teknik_Tasarim.docx` dokümanının Markdown kopyasıdır ve projenin tek doğruluk kaynağıdır (single source of truth).
> Word dokümanı güncellenirse bu dosya da güncellenmelidir.
> 7 Kasım 2026'dan itibaren ürün tek taraflı borç defteridir (ADR-064). Word dokümanı eski, iki taraflı sürümü anlatır; bu dosya öndedir.

**ÜRÜN VE TEKNİK TASARIM DOKÜMANI**

**Paramnet**

Kişisel Borç, Taksit ve Hesap Bölme Defteri

Fikir, çalışma şekli, kurgu, mimari, veri modeli, güvenlik ve yol haritası

**Uygulama adı:** Paramnet (marka ve alan adı uygunluk kontrolü yapılacak)

**Sürüm:** 0.4 — Tek taraflı defter (uygulama adı: Paramnet)

**Tarih:** 7 Kasım 2026

**Hazırlayan:** Halil

**Platform:** iOS ve Android mobil uygulama



# 1. Yönetici Özeti

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Ürün vaadi</strong></p>
<p>Verdiğin, aldığın ve taksitle ödeyeceğin borçları kendi defterinde tut. Ödeme günlerini kaçırma, ortak harcamalarda kimin kime ne kadar borçlu olduğunu tek bakışta gör.</p></td>
</tr>
</tbody>
</table>

Paramnet, kişinin kendi borç ve alacaklarını, elden taksitlerini ve banka kredilerini tuttuğu bir mobil defterdir. Her kullanıcı kendi defterini tutar. Karşı taraf hiçbir şekilde sürece girmez: uygulamaya davet edilmez, kaydı görmez, onaylamaz, ona bildirim gitmez.

Hesap bölme Splitwise mantığıyla çalışır ama yine tek taraflıdır: kullanıcı grubu ve kişileri isimleriyle kendisi yazar, harcamaları girer, uygulama kimin kime ne kadar borçlu olduğunu hesaplar ve sadeleştirir.

İlk tasarımda ürünün farkı karşılıklı onaydı (Bölüm 2.2). 7 Kasım 2026'da bu akış kaldırıldı (ADR-064): kullanıcı, karşı tarafı dahil etmeden çalışan sade bir defter istedi. Tek taraflı defterin pazarda tek başına bir fark yaratmadığı bilinerek alınmış bir karardır. Ürün artık sadelik ve kayıt kolaylığıyla ayrışmayı hedefler.

## 1.1 Temel kararlar

| **Konu**                | **Karar**                                                                                                                             |
|-------------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| Platform                | Mobil uygulama (iOS + Android). Web sayfası yoktur.                                                                                   |
| Hedef kitle             | Bireyler. Esnaf ve veresiye defteri kapsam dışıdır.                                                                                   |
| Ana değer               | Sade borç defteri, ödeme günü hatırlatması ve tek taraflı hesap bölme.                                                                |
| Sürüm kapsamı           | Borç ve alacak kaydı, elden taksit, kısmi ödeme, takvim, kendine hatırlatma, hesap bölme, banka kredisi takibi ve kredi simülasyonu.  |
| Silinenler              | Karşılıklı onay, paylaşım, davet, web onay sayfası, Para iste, para teslimi, itiraz, değişiklik talebi, ParamNet ID, kredi kartları.  |
| Gizlenenler             | Hesaplar, Toplam Nakit, gelir-gider, tekrarlayan işlem, bütçe, aylık rapor. Kod durur, arayüzde görünmez (5.18).                      |
| Para hareketi           | Uygulama para tutmaz, transfer başlatmaz. Yalnızca kayıt tutar.                                                                       |
| Gelir modeli            | Temel defter ücretsiz. Premium: raporlar, PDF çıktı, gelişmiş özellikler.                                                             |

# 2. Problem ve Pazar

## 2.1 Problem

Türkiye’de bireyler arasında borç, elden taksit ve vadeli alışveriş çok yaygındır. Bu anlaşmalar bugün çoğunlukla şu yollarla takip edilir:

- WhatsApp mesajları, telefon notları veya hafıza

- Mağazanın verdiği kâğıt ödeme planı veya senet

- Tek taraflı tutulan Excel tabloları veya basit borç defteri uygulamaları

Bunun sonuçları: unutulan ödeme günleri, tarafların farklı hatırladığı kalan tutarlar, para isteme mahcubiyeti ve ilişkiyi geren tartışmalar. Paramnet bu sorunların kullanıcının kendi tarafındaki kısmını çözer: ne verdiğini, ne aldığını ve ne zaman ödeyeceğini unutmamasını sağlar.

## 2.2 Pazar bulguları

| **Bulgu**                                                                                                                                                                                                    | **Ürün için anlamı**                                                                                       |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| Kartlı ödemeler Haziran 2026’da yıllık %50 artışla 2,87 trilyon TL; kredi kartı sayısı 150,4 milyon (BKM).                                                                                                   | Taksit kültürü çok güçlü; taksitli yükümlülük takibi gerçek bir ihtiyaç.                                   |
| Açık bankacılık 16,4 milyon kullanıcıya ulaştı; ÖHVPS 2.0 ile kart hareketleri de kapsama alındı (TCMB, Mart 2026). Garanti BBVA, Yapı Kredi, Ziraat diğer banka hesap ve kartlarını tek ekranda gösteriyor. | Banka/kart birleştirmede rekabet edilemez. Bankaların göremediği alan: kişiler arası borç ve elden taksit. |
| butce.app (₺69/ay), Nakitt (ücretsiz + ₺79,99/ay Pro), FinansX: gelir-gider, kart, taksit, kredi takibi.                                                                                                     | Kapsamlı kişisel finans uygulaması pazarı dolu; ilk sürümde bu alana girilmez.                             |
| Alacaklı, Kolay Defter, Borç Alacak Takvimi: tek taraflı borç, taksit, takvim, WhatsApp hatırlatma.                                                                                                          | Tek taraflı borç defteri tek başına farklılaşma değil.                                                     |
| Payla: yerli grup harcaması bölüştürme (100+ indirme). Splitwise ücretsiz sürümü günde 3–4 kayıtla sınırlı.                                                                                                  | Sosyal harcama tarafında rakip var; ancak iki taraflı onaylı taksitli borç anlaşması görülmedi.            |
| Finans uygulamalarında 30. gün tutunma kaynağa göre %4–17 arası; manuel giriş isteyen bütçe uygulamaları alt bantta.                                                                                         | Kayıt kolaylığı ve karşı tarafın varlığı tutunmanın ana kaldıracı.                                         |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Karar notu (ADR-064)</strong></p>
<p>Bu tablo iki taraflı akışı önerdiği dönemden kalmadır. Tek taraflı defter rakiplerde de var; ürün karşılıklı onaydan vazgeçerek bu alana bilerek girer. Fark, Splitwise mantığını hesap gerektirmeden sunmak ve uygulamayı sade tutmaktır.</p></td>
</tr>
</tbody>
</table>

# 3. Ürün Vizyonu ve Konumlandırma

## 3.1 Konumlandırma

Paramnet **kişinin kendi borç defteridir.** Kayıtlar yalnızca sahibine aittir, başka kimse görmez ve kimseyi bağlamaz.

| **Biz neyiz**                                  | **Biz ne değiliz**                        |
|------------------------------------------------|-------------------------------------------|
| Kişisel borç ve alacak defteri                 | Para transfer eden bir ödeme kuruluşu     |
| Elden taksit ve vadeli alışveriş takibi        | Banka hesabı / kart birleştirme aracı     |
| Kendine ödeme hatırlatması                     | Hukuken geçerli e-senet düzenleme hizmeti |
| Tek taraflı hesap bölme                        | Kredi veren platform                      |
| Banka kredisi takibi ve kredi simülasyonu      | Esnaf veresiye / cari hesap yazılımı      |

## 3.2 Hedef kullanıcılar

| **Persona**                    | **Durum**                                       | **Uygulamadan beklentisi**                                                    |
|--------------------------------|-------------------------------------------------|-------------------------------------------------------------------------------|
| Borç veren arkadaş             | Arkadaşına 18.000 TL verdi, 3 ayda geri alacak. | Ne verdiğini ve ne kadarının döndüğünü unutmamak; geri ödeme gününü bilmek. |
| Borç alan kişi                 | Akrabasından borç aldı, aylık ödüyor.           | Ne kadar ödediğini ve ne kadar kaldığını net görmek.                     |
| Elden taksitle alışveriş yapan | Mobilyacıdan peşinat + 5 taksitle aldı.         | Ödeme günlerini kaçırmamak, ödenen taksitleri işaretlemek.                    |
| Ev arkadaşı / tatil grubu      | Ortak harcamalar, sırayla ödenen hesaplar.      | Kimin kime ne kadar borçlu olduğunu tek bakışta görmek.                       |

## 3.3 Değer önerisi

- **Defter:** Borç, alacak ve elden taksit kaydı, ödeme planı, takvim, kendine hatırlatma. Başka kimse gerekmez.

- **Hesap bölme:** Grup, harcama, kimin ödediği, paylar ve sadeleştirilmiş borçlar. Diğer kişilerin uygulamayı kullanması gerekmez.

- **Banka kredisi:** Kullanıcının kendi kredilerinin planı ve erken kapama simülasyonu.

## 3.4 İletişim tonu

Borç konusu hassastır. Uygulama yalnızca kullanıcıyla konuşur; suçlayıcı veya resmî dil kullanmaz.

| **Kaçınılacak ifade** | **Kullanılacak ifade** |
|-----------------------|------------------------|
| Ödemen gecikti        | Bugün ödeme günü       |
| Borcunu ödemedin      | Henüz kaydedilmedi     |
| Hata oluştu           | Bir sorun çıktı        |

# 4. Temel Kavramlar (Alan Modeli)

Tüm ekip ve kod aynı terimleri kullanır. Kod tarafında İngilizce karşılıklar parantez içinde verilmiştir.

| **Kavram**                            | **Tanım**                                                                                                     |
|---------------------------------------|---------------------------------------------------------------------------------------------------------------|
| Kullanıcı (profile)                   | Telefon numarasıyla doğrulanmış uygulama hesabı. Defterin sahibi.                                             |
| Kişi (contact)                        | Kullanıcının defterine isimle yazdığı karşı taraf. Uygulama hesabıyla bağı yoktur, yalnızca ad ve tür tutulur. |
| Kayıt (agreement)                     | Bir kişiyle olan tek bir borç ilişkisi. Ana kayıttır.                                                         |
| Rol (role)                            | Kullanıcının kayıttaki yeri: alacaklı (creditor) veya borçlu (debtor).                                        |
| Kayıt versiyonu (agreement_version)   | Kaydın şartlarının değiştirilemez anlık görüntüsü. Her düzenleme yeni versiyondur.                            |
| Ödeme planı / Taksit (installment)    | Vadesi ve tutarı olan ödeme kalemi. Tek seferlik borç = tek taksitli plan.                                    |
| Peşinat (down_payment)                | Kayıt anında ödenen ve plandan düşülen tutar.                                                                 |
| Ödeme (payment)                       | Gerçekleşen bir geri ödeme kaydı. Yazıldığı anda bakiyeden düşer.                                             |
| Dağıtım (allocation)                  | Bir ödemenin hangi taksitlere ne kadar uygulandığı.                                                           |
| Olay kaydı (agreement_event)          | Kayıtta olan her şeyin değiştirilemez günlüğü. Kullanıcının kendi geçmişidir.                                 |
| Grup (split_group)                    | Ortak harcamaların toplandığı başlık: "Ev", "Kapadokya", "Akşam yemeği".                                      |
| Üye (split_group_member)              | Gruptaki kişi. Biri her zaman kullanıcının kendisidir, diğerleri yalnızca isimdir.                            |
| Harcama (split_expense)               | Grupta bir üyenin ödediği ve üyeler arasında paylaştırılan tutar.                                             |
| Ödeşme (split_settlement)             | Bir üyenin başka bir üyeye yaptığı geri ödemenin kaydı.                                                       |

# 5. Uygulamanın Çalışma Şekli

Bu bölüm kullanıcının uygulamada yaptığı her işi uçtan uca anlatır.

## 5.1 İlk açılış ve kayıt

1.  Karşılama ekranı (01): tek cümlelik vaat, "Hesap oluştur" ve "Giriş yap". "Hesap oluştur" 3 kısa tanıtım ekranını (31, atlanabilir) açar.

2.  Telefon numarası girişi (+90, 02 "Kayıt ol"). SMS ile 6 haneli kod gönderilir.

3.  Kod doğrulanır, hesap oluşturulur. Kullanıcı 6 haneli PIN'i iki kez girerek belirler (ADR-046). Ad soyad (görünen ad) alınır.

4.  KVKK aydınlatma metni ve kullanım koşulları onayı.

5.  Bildirim izni istenir; gerekçe ekranda açıkça yazar: “Ödeme günlerini hatırlatabilmemiz için”.

6.  Boş durum ekranı: “İlk kaydını ekle” butonu ve 3 hızlı şablon (Borç verdim, Borç aldım, Taksitle aldım).

Sonraki girişler (02 "Giriş yap"): telefon + 6 haneli PIN. "Şifremi unuttum" SMS koduyla yeni PIN belirletir (Bölüm 11.1).

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Hedef</strong></p>
<p>Uygulamayı indirmeden ilk kayda kadar geçen süre 90 saniyenin altında olmalı.</p></td>
</tr>
</tbody>
</table>

## 5.2 Yeni kayıt oluşturma

Kullanıcı “+” butonuna bastığında önce ne yaptığını seçer. Her seçim yalnızca gerekli alanları açar.

| **Seçim**       | **Rol**            | **Açılan alanlar**                                                                             |
|-----------------|--------------------|------------------------------------------------------------------------------------------------|
| Borç verdim     | Kullanıcı alacaklı | Kişi, tutar, verildiği tarih, geri ödeme şekli (tek sefer / taksit), not                       |
| Borç aldım      | Kullanıcı borçlu   | Kişi, tutar, alındığı tarih, geri ödeme şekli, not                                             |
| Taksitle aldım  | Kullanıcı borçlu   | Satıcı (kişi veya serbest metin), ürün, toplam tutar, peşinat, taksit sayısı, ilk ödeme tarihi |
| Taksitle sattım | Kullanıcı alacaklı | Alıcı, ürün, toplam tutar, peşinat, taksit planı                                               |

Ödeme planı oluşturma kuralları

- **Tek seferlik:** Tek taksit, tek vade tarihi. Vade boş bırakılabilir (“vadesiz”).

- **Eşit taksit:** Kalan tutar = toplam − peşinat. Taksit tutarı = kalan / taksit sayısı, kuruşa yuvarlanır. Yuvarlama farkı son taksite eklenir.

- **Periyot:** Aylık (varsayılan), haftalık, iki haftalık, özel. Aylık planda ilk ödeme 31’i ise kısa aylarda ayın son günü kullanılır.

- **Eşit olmayan plan:** Kullanıcı her taksitin tarih ve tutarını tek tek düzenleyebilir. Toplam, kalan tutara eşit olmadan kaydedilemez.

- **Peşinat:** Ödenmiş bir ödeme olarak kaydedilir.

- **Önizleme:** Kaydetmeden önce plan liste halinde gösterilir; kullanıcı tek dokunuşla düzenler.

Örnek: Mobilya alışverişi

| **Alan**  | **Değer**                                                           |
|-----------|---------------------------------------------------------------------|
| Toplam    | 28.000,00 TL                                                        |
| Peşinat   | 8.000,00 TL                                                         |
| Kalan     | 20.000,00 TL                                                        |
| Plan      | 5 × 4.000,00 TL, aylık, ilk ödeme 10 Kasım 2026                     |
| Taksitler | 10 Kas 2026 · 10 Ara 2026 · 10 Oca 2027 · 10 Şub 2027 · 10 Mar 2027 |

Kişi seçimi

- Rehberden seçme (izin istenir, yalnızca seçilen kişinin adı okunur; rehber sunucuya yüklenmez).

- Elle ad yazma. Telefon numarası istenmez ve saklanmaz.

- Satıcı gibi taraflar için serbest metin karşı taraf (ör. “Yıldız Mobilya”).

## 5.3 Tek taraflı defter

Her kayıt yalnızca oluşturanındır. Kullanıcı tüm işlemleri tek başına yapar: ödeme ekler, taksit erteler, düzenler, kapatır. Doğrulama yoktur çünkü karşı taraf yoktur. Hiçbir kayıt başka bir kullanıcıya bağlanmaz, gönderilmez, paylaşılmaz.

## 5.4 Paylaşım ve karşılıklı onay

Kaldırıldı (ADR-064).

## 5.5 Ödeme kaydı

Kullanıcının kaydettiği ödeme doğrudan geçerlidir ve bakiyeden düşer. Alacaklıysa “Ödeme aldım”, borçluysa “Ödeme yaptım” der; sonuç aynıdır.

- Ödeme alanları: tutar, ödeme tarihi, yöntem (nakit, havale/EFT, kart, diğer), not, isteğe bağlı dekont görseli.

- Yanlış girilen ödeme silinebilir: silinen ödeme iptal edildi olarak geçmişte kalır, dağıtımı geri alınır, kalan artar. Kapanmış kayıt yeniden açılır.

Ödemenin taksitlere dağıtımı

- Varsayılan: en eski ödenmemiş taksitten başlayarak sırayla (FIFO).

- Taksit tutarından az ödeme: taksit “kısmen ödendi” olur.

- Taksit tutarından fazla ödeme: artan kısım sonraki taksitlere dağıtılır.

- Toplam kalan borçtan fazla ödeme kaydedilemez.

- Kullanıcı isterse ödemeyi belirli bir taksite yönlendirebilir (gelişmiş seçenek).

## 5.6 Düzenleme

Kullanıcı kendi kaydını istediği zaman düzenler; kimseden onay alınmaz. Taksit erteleme, planı yeniden düzenleme ve tutar düzeltme aynı düzenleme ekranındadır.

- Her düzenleme yeni bir versiyon oluşturur ve geçmişe yazılır.

- Yapılmış ödemeler düzenlemeyle silinmez; yeni plan kalan tutar üzerinden kurulur.

- **Borç silme:** Alacaklı kalanın bir kısmından ya da tamamından vazgeçebilir; indirim olarak kaydedilir ve kalandan düşer.

## 5.7 İtiraz

Kaldırıldı (ADR-064).

## 5.8 Kapanış ve iptal

- **Otomatik kapanış:** Ödemeler toplamı borca eşit olunca kayıt “kapandı” olur. Uygulama içinde tebrik mesajı görünür, bildirim gitmez.

- **İptal:** Kullanıcı istediği zaman iptal eder.

- Kapanan ve iptal edilen kayıtlar silinmez; arşivde görünür. Kullanıcı kendi görünümünden gizleyebilir.

## 5.9 Hatırlatmalar

Hatırlatma yalnızca defter sahibine gider. Karşı tarafa hiçbir şey gönderilmez. Kullanıcı alacaklı da borçlu da olsa kendi kaydı için hatırlatılır.

| **Zaman**                         | **Kullanıcı borçluysa**                                        | **Kullanıcı alacaklıysa**                                  |
|-----------------------------------|----------------------------------------------------------------|------------------------------------------------------------|
| Vadeden 7, 3 ya da 1 gün önce (kullanıcı tercihi, ADR-051) | 10 Kasım’da Yıldız Mobilya’ya 4.000 TL ödemen var. | 10 Kasım’da Ahmet’ten 4.000 TL alacağın var. |
| Vade günü 10:00 (kullanıcı tercihi) | Bugün ödeme günü: 4.000 TL (2/5. taksit).                    | Bugün Ahmet’in ödeme günü: 4.000 TL.                       |
| Vadeden 1 gün sonra (ödenmemişse) | Dünkü 4.000 TL’lik ödeme henüz kaydedilmedi. Ödediysen kaydet. | Ahmet’in dünkü 4.000 TL’si henüz kaydedilmedi. Aldıysan kaydet. |
| Vadeden 7 gün sonra               | 2\. taksit 7 gündür açık görünüyor.                            | Ahmet’in 2. taksiti 7 gündür açık görünüyor.               |

- Sessiz saatler: 22:00–09:00 arası bildirim gönderilmez (Europe/Istanbul).

- Kullanıcı vade öncesi hatırlatma zamanlarını Bildirimler ekranından seçer (7, 3, 1 gün önce, vade günü; varsayılan 3 gün önce ve vade günü). Anlaşma bazında kapatma sonraki sürümde.

- Banka kredisi taksitleri için de aynı kural geçerlidir.

- İptal edilmiş veya kapanmış kayıtlara hatırlatma gitmez.

## 5.10 Hızlı kayıt (sonraki küçük güncelleme)

Kullanıcı tek cümle yazar: “Ahmet’ten 12.000 TL aldım, 3 taksitte ödeyeceğim, ilk ödeme 25 Kasım”. Uygulama kişi, rol, tutar, taksit sayısı ve tarihi çıkarıp doldurulmuş bir form önerir; kullanıcı onaylamadan kayıt oluşmaz. İlk aşamada kural tabanlı ayrıştırıcı, sonra LLM destekli ayrıştırma. İlk sürümde bunun yerine son kullanılan kişiler, akıllı varsayılanlar ve hızlı şablonlar bulunur.

## 5.11 Hesaplar ve işlemler (kişisel kayıt, ADR-053)

> Gizli modül (5.18).

Kullanıcı kendi banka hesaplarını, nakit cüzdanını ve birikimlerini elle kaydeder; gelir, gider ve hesaplar arası transfer girer. Banka bağlantısı yoktur, uygulama para tutmaz ve transfer başlatmaz: "Transfer" yalnızca kullanıcının kendi iki hesabı arasındaki bir kayıttır. Bu kayıtlar borç bakiyelerine yansımaz.

- **Hesap:** tür (banka hesabı, nakit cüzdan, birikim, diğer), ad, isteğe bağlı banka adı, açılış bakiyesi, "Toplam Nakit'e dahil et". IBAN ya da hesap numarası istenmez. Kullanıcı başına en fazla 50 açık hesap.
- **Bakiye saklanmaz:** açılış bakiyesi + gelir − gider ± transfer + düzeltme. Açılış bakiyesi gelir sayılmaz; eksi olabilir.
- **Toplam Nakit:** arşivlenmemiş ve "dahil" işaretli hesapların bakiyeleri toplamı. Ana Sayfa'da ve Hesaplar ekranında gösterilir; "Manuel kayıt · banka verisi değildir" notuyla.
- **İşlem türleri:** gider ve gelir (kategori zorunlu), transfer (iki farklı kendi hesabı, kategori yok), düzeltme ("Bakiye düzelt": kullanıcı gerçek bakiyeyi yazar, fark bugünün tarihiyle kaydedilir). Transfer ve düzeltme gelir/gider sayılmaz.
- **Kategoriler** (sabit liste, kodlar `packages/shared`): gider: yeme-içme, market, ulaşım, fatura, kira, sağlık, giyim, diğer; gelir: maaş, freelance, kira geliri, iade, diğer.
- **Aylık gelir ve gider:** ayın tüm hesaplardaki gelir ve gider kayıtlarının toplamı (arşivlenmiş ve toplama dahil olmayan hesaplar da sayılır).
- **Düzenleme:** gider, gelir ve transfer düzenlenebilir; her değişiklik eski ve yeni değeriyle geçmişe yazılır. Düzeltme kaydı düzenlenmez, yalnızca silinir.
- **Silme:** kayıt silindi olarak işaretlenir ve bakiyeden düşer; uygulama 10 saniye "Geri al" sunar. Silinen kayıtlar hesap silinene kadar saklanır.
- **Arşiv:** arşivlenen hesap listeden ve Toplam Nakit'ten çıkar, yeni kayıt almaz; geçmiş kayıtları kalır.
- **Tarih:** işlem tarihi `date` (Europe/Istanbul), en fazla bir yıl ileri. Kayıt zamanı ayrıca tutulur.

## 5.12 Tekrarlayan işlem, bütçe ve aylık rapor (ADR-054)

> Gizli modül (5.18).

- **Tekrarlayan işlem:** gelir ya da gider; ad, tutar, kategori, hesap, sıklık (haftalık, aylık, yıllık), ilk tarih ve "Her seferinde onay iste". Tarihler ilk tarihten sayılır; ay sonu kısalırsa ayın son günü kullanılır (31 Ocak → 28 Şubat → 31 Mart).
	- Onay isteyen kuralın günü gelen tarihi "Onay bekleyenler"de görünür: Onayla gerçekleşen kaydı yazar, Atla yazmaz. Onay istemeyen kural günü gelince kendiliğinden kaydedilir (saatlik iş).
	- Kural oluşturulmadan en fazla 31 gün önceki tarihler sayılır; durdurulup sürdürülen kuralda durdurma süresindeki tarihler sayılmaz. Arşivlenmiş hesaba kayıt yazılmaz.
	- Kural silinince yazılmış kayıtlar kalır. Kullanıcı başına en fazla 100 kural.
- **Bütçe:** gider kategorisi başına aylık sınır. Harcanan, o ayın silinmemiş gider kayıtlarıdır. Sınırın %80'inde "sınıra yakın", aşınca "aşıldı" uyarısı; özet kartında kalan gün ve kalan günlük pay.
- **Aylık rapor:** seçilen ayın geliri, gideri ve neti; son 6 ayın gelir-gider sütunları; gider kategorisi dağılımı; borç ve alacak dengesi (anlaşmalardan). Transfer, düzeltme ve borç kayıtları gelir-gidere dahil değildir. Varsayılan ay son tamamlanan aydır.

## 5.13 Kredi kartları

Kaldırıldı (ADR-064). Kartlar, kart harcamaları, ekstre ve kart faiz simülasyonu kod ve tablolarıyla silinir.

## 5.14 Banka kredileri (ADR-056)

- Kullanıcının kendi banka kredisi: banka, kredi türü, çekilen tutar, aylık faiz (vergiler dahil, yüzde ikinci haneye kadar), vade (1–120 ay), ilk taksit tarihi, isteğe bağlı bankanın taksiti ve ödeme hesabı.
- **Ödeme planı türetilir:** eşit taksit P·r / (1 − (1 + r)^−n), ondalıklı sayı kullanılmadan kuruşta tam hesaplanır; her ay faiz kalan anapara × r (yarım yukarı yuvarlanır), taksitin kalanı anaparadır, son taksit kalanı kapatır. Bankanın taksiti girilirse o kullanılır.
- **Faiz yalnızca planı ve simülasyonu göstermek için** hesaplanır (ADR-045); kişiler arası kayıtlara yansımaz.
- **Görünürlük:** Banka kredileri Borçlarım'da ve Ana menüde görünür. Kredi simülasyonu erken kapama tutarını, ücreti ve kazancı gösterir, kayıt yazmaz (ADR-057).
- **Taksit kaydı** sıradaki taksitin tutarıyla yazılır, düzenlenmez, yalnızca silinir; ödenen taksit sayısı bu kayıtlardan gelir. Hesap seçmek gerekmez. Hesaplar modülü açıksa (5.18) hesap seçilebilir; o zaman kayıt hesaptan krediye transferdir, gider sayılmaz.

## 5.15 Para iste ve para teslimi

Kaldırıldı (ADR-064).

## 5.16 Elden taksit kaydı (ADR-059)

- Taksitli alım ya da satışta alış (satış) tarihi tutulur; peşinat bu tarihle kaydedilir.
- Planın ilk taksitlerinin tarihi geçmişse önizlemede "Ödendi" işaretlenebilir. İşaretlenen taksitler kendi vade gününde ödenmiş sayılır ve kayıtla aynı işlemde yazılır. Ödemeler sırayla dağıtıldığı için yalnızca baştan ardışık taksitler işaretlenir.

## 5.17 Hesap bölme (ADR-064)

Splitwise mantığıyla çalışır, ama tek taraflıdır: grubu yalnızca kullanıcı görür. Diğer kişiler isimden ibarettir; hesap açmaz, gruba katılmaz, bildirim almaz. Kare kod, davet linki ve ParamNet ID yoktur.

- **Grup:** ad ve üyeler. Kullanıcı her zaman üyedir. Üyeler elle ya da rehberden isimle eklenir. Tek seferlik bir hesap da grup olarak açılır (ör. "Akşam yemeği").
- **Harcama:** başlık, toplam, tarih, ödeyen üye (kullanıcı olmak zorunda değil), dahil edilen üyeler ve bölme şekli: eşit, tutar ya da yüzde. Paylar toplamı harcamaya eşit olmalıdır. Kuruş farkı ödeyenin payına, ödeyen paylaşıma dahil değilse ilk dahil üyeye eklenir.
- **Bakiye türetilir, saklanmaz:** üyenin bakiyesi = ödediği harcamalar − payları + yaptığı ödeşmeler − aldığı ödeşmeler. Grup içindeki bakiyeler toplamı her zaman sıfırdır.
- **Sadeleştirme:** kimin kime ne kadar ödeyeceği, en çok alacaklı ile en çok borçlu eşleştirilerek en az sayıda ödemeye indirilir. Hesap `packages/shared`'dadır ve aynı girdiden hep aynı sonucu verir.
- **Ödeşme:** kullanıcı "Mehmet Ayşe'ye 500 TL verdi" diye kaydeder. Ödeşmeye kullanıcının taraf olması gerekmez. Tüm bakiyeler sıfırsa grup "ödeşildi" görünür.
- **Düzenleme:** harcama ve ödeşme düzenlenir ya da silinir; her değişiklik grubun geçmişine yazılır. Harcamada ya da ödeşmede geçen üye gruptan çıkarılamaz.
- **Defterle ilişki:** Grup bakiyeleri borç kaydı oluşturmaz, Borçlarım toplamlarına ve Ana Sayfa'daki toplam alacak ve borca katılmaz. Ortak sekmesinde ayrıca gösterilir, hatırlatma üretmez.
- **Arşiv:** grup arşivlenebilir; silinmez, listeden çıkar.

## 5.18 Gizli modüller (ADR-064)

Hesaplar, Toplam Nakit, gelir-gider, işlem geçmişi, tekrarlayan işlem, bütçe, aylık rapor ve takvimdeki nakit projeksiyonu arayüzde görünmez. Kod ve tablolar durur; `EXPO_PUBLIC_PERSONAL_FINANCE=1` ile derlenen uygulamada açılırlar. Varsayılan kapalıdır. Kapalıyken bu modüller için sorgu çalışmaz, rota açılmaz, tekrarlayan işlem kuralı oluşturulamaz.

# 6. Ekranlar ve Bilgi Mimarisi

## 6.1 Navigasyon

Alt sekme çubuğu 4 sekme + ortada “+” butonundan oluşur.

| **Sekme**       | **İçerik**                                                                                             |
|-----------------|--------------------------------------------------------------------------------------------------------|
| Ana Sayfa       | Özet: toplam alacak, toplam borç, bu ay ödenecekler, bu ay alınacaklar, gecikenler, yaklaşan vadeler.  |
| Borçlarım       | Borç ve alacak kayıtları, banka kredileri.                                                             |
| \+ (İşlem)      | Borç ver, Borç al, Elden taksit, Hesap böl, Kredi ekle.                                                |
| Ortak           | Gruplar, net bakiyeler, sadeleştirilmiş borçlar.                                                       |
| Takvim          | Aylık takvim: vadeler ve beklenen ödemeler, kredi taksitleri. Gün seçince o günün listesi.             |

Ana menü ve bildirimler Ana Sayfa üst çubuğundan, profil selamlama alanından açılır.

## 6.2 Ekran listesi

| **\#** | **Ekran**                     | **Ana bileşenler**                                                                    |
|--------|-------------------------------|---------------------------------------------------------------------------------------|
| S01    | Karşılama                     | Vaat, tanıtım kartları, Başla                                                         |
| S02    | Telefon girişi                | Ülke kodu, numara, KVKK linki                                                         |
| S03    | OTP doğrulama                 | 6 hane, yeniden gönder (60 sn), hata durumları                                        |
| S04    | Profil kurulumu               | Görünen ad, bildirim izni                                                             |
| S05    | Ana Sayfa                     | Özet kartları, yaklaşan vadeler                                                       |
| S06    | Borçlarım                     | Arama, kişi bazında net bakiye, kayıtlar, banka kredileri                             |
| S07    | Kişi detay                    | Net bakiye, kayıtlar, yeni kayıt                                                      |
| S08    | İşlem merkezi                 | Borç ver, Borç al, Elden taksit, Hesap böl, Kredi ekle                                |
| S09    | Kayıt formu                   | Dinamik alanlar, kişi seçici, tutar klavyesi                                          |
| S10    | Plan önizleme / düzenleme     | Taksit listesi, satır düzenleme, toplam kontrolü                                      |
| S11    | Kayıt detay                   | Durum etiketi, bakiye, ilerleme çubuğu, taksitler, ödemeler, geçmiş, aksiyonlar       |
| S12    | Ödeme ekle                    | Tutar, tarih, yöntem, dekont, not, dağıtım önizlemesi                                 |
| S13    | Kayıt düzenleme               | Tutar, tarih, plan; düzenleme geçmişe yazılır                                         |
| S14    | Kayıt geçmişi                 | Zaman çizelgesi (olay kaydı)                                                          |
| S15    | Takvim                        | Ay görünümü, gün listesi                                                              |
| S16    | Ortak (gruplar)               | Gruplar, her grupta net bakiyen, Grup oluştur                                         |
| S17    | Grup oluştur / düzenle        | Ad, üyeler (isim ya da rehber)                                                        |
| S18    | Grup detay                    | Bakiyeler, kim kime ne kadar, harcamalar, ödeşmeler, geçmiş                           |
| S19    | Harcama ekle / düzenle        | Başlık, tutar, tarih, ödeyen, dahil üyeler, eşit / tutar / yüzde                      |
| S20    | Ödeşme ekle                   | Kimden, kime, tutar, tarih                                                            |
| S21    | Profil / Ayarlar              | Fotoğraf, ad, @kullanıcı adı, bildirim tercihleri, veri dışa aktarma, yasal metinler, hesabı sil (ADR-051) |
| S22    | Ana menü                      | Banka kredileri, Kredi simülasyonu, Bildirimler, Profil                               |
| S23    | Bildirimler                   | Hatırlatma listesi, gün grupları, okunmamış noktası, hatırlatma tercihleri            |
| S24    | Banka kredileri               | Liste, detay, ekle, taksit kaydı, kredi simülasyonu                                   |

## 6.3 Kayıt detay ekranı yapısı

- Üst kart: karşı taraf adı, rol (“Sana borçlu” / “Borçlusun”), kalan tutar, toplam, ilerleme çubuğu, durum etiketi (Açık, Kapandı, İptal).

- Birincil aksiyon: Ödeme ekle.

- Taksitler listesi: vade, tutar, ödenen, durum.

- Ödemeler listesi: tarih, tutar, yöntem.

- Geçmiş: tüm olaylar zaman sırasıyla.

- Menü: Düzenle, Borç sil (alacaklı), İptal et, PDF çıktı (premium).

## 6.4 Tasarım ilkeleri

- Tek ekranda tek birincil aksiyon.

- Tutarlar her zaman Türk biçiminde: 12.000,00 TL. Tutar girişi özel sayısal klavye ile.

- Renk anlamı tutarlı: alacak yeşil tonu, borç turuncu tonu, gecikme kırmızı, bekleyen gri. Renk tek başına anlam taşımaz, etiketle desteklenir.

- Açık ve koyu tema, dinamik yazı boyutu, ekran okuyucu etiketleri.

- Her boş durum ekranında ne yapılacağını anlatan bir cümle ve buton.

# 7. İş Kuralları

Aşağıdaki kurallar sunucu tarafında zorunlu kılınır; istemci yalnızca kullanıcıya önceden gösterir. Kaldırılan kuralların numaraları yeniden kullanılmaz.

| **Kod** | **Kural**                                                                                                                          |
|---------|------------------------------------------------------------------------------------------------------------------------------------|
| BR-01   | Tüm tutarlar kuruş cinsinden tam sayı (bigint) saklanır. Ondalıklı sayı tipi kullanılmaz.                                          |
| BR-02   | İlk sürümde para birimi TRY’dir. Şema çoklu para birimini destekler; bir kaydın para birimi sonradan değişmez.                     |
| BR-03   | Taksit tutarları toplamı + peşinat, kayıt tutarına her zaman eşittir.                                                              |
| BR-04   | Kalan borç = kayıt tutarı − geçerli ödemeler − indirimler. Hiçbir zaman negatif olamaz.                                            |
| BR-05   | Kayıt şartlarını yalnızca sahibi değiştirir. Her değişiklik yeni versiyon ve olay kaydıdır.                                        |
| BR-08   | Kaydedilen ödeme doğrudan geçerlidir ve bakiyeden düşer.                                                                           |
| BR-09   | Her ödeme ve oluşturma işlemi idempotency anahtarı taşır; aynı anahtarla gelen ikinci istek yeni kayıt oluşturmaz, ilk sonucu döner. |
| BR-10   | Ödeme satırı silinmez; `voided` durumuna geçer, dağıtımı geri alınır. Kapanmış kayıtta kalan sıfırın üstüne çıkarsa kayıt açılır.  |
| BR-13   | Olay kaydı yalnızca eklenir; güncellenemez ve silinemez (hesap silme hariç, bkz. KVKK).                                            |
| BR-14   | Kapanmış veya iptal edilmiş kayda yeni ödeme ve düzenleme eklenemez.                                                               |
| BR-15   | Kişiler arası kayıtta faiz alanı ve hesabı yoktur. Faiz yalnızca kullanıcının banka kredisi için gösterilir (ADR-045).              |
| BR-16   | Tarihler Europe/Istanbul saat dilimine göre “gün” olarak (date) saklanır; olay zamanları timestamptz.                              |
| BR-19   | Her kaydı, grubu ve bildirimi yalnızca sahibi görür. Hiçbir veri başka kullanıcıya gösterilmez ya da gönderilmez.                  |
| BR-20   | Harcamanın payları toplamı harcama tutarına eşittir. Kuruş farkı ödeyene, ödeyen dahil değilse ilk dahil üyeye yazılır.            |
| BR-21   | Grup bakiyeleri saklanmaz, harcama ve ödeşmelerden türetilir; toplamları her zaman sıfırdır.                                       |
| BR-22   | Harcamada ya da ödeşmede geçen üye gruptan çıkarılamaz. Ödeşmede iki taraf farklı üye olmalıdır.                                   |

# 8. Durum Makineleri

Durum geçişleri yalnızca sunucu fonksiyonlarında yapılır; her geçiş tek bir veritabanı işlemi (transaction) içinde gerçekleşir ve olay kaydına yazılır.

## 8.1 Kayıt durumları

| **Durum** | **Anlamı**                       | **Etiket** |
|-----------|----------------------------------|------------|
| personal  | Açık kayıt. Tek çalışma durumu.  | Açık       |
| settled   | Kalan borç sıfır.                | Kapandı    |
| cancelled | İptal edildi. Son durum.         | İptal      |

`personal` adı mevcut veriyle uyum için kalır (ADR-064).

## 8.2 Kayıt geçiş tablosu

| **Mevcut** | **Olay**                  | **Yeni**                 | **Koşul / Etki**                                  |
|------------|---------------------------|--------------------------|---------------------------------------------------|
| —          | create                    | personal                 | Versiyon 1 oluşur.                                |
| personal   | edit                      | personal                 | Yeni versiyon; yapılmış ödemeler korunur.         |
| personal   | record_payment            | personal / settled       | Kalan 0 ise settled.                              |
| personal   | forgive_remaining         | personal / settled       | İndirim kaydı; kalan 0 ise settled.               |
| personal   | cancel                    | cancelled                |                                                   |
| personal   | void_payment              | personal                 | Dağıtım geri alınır.                              |
| settled    | void_payment              | personal                 | Kalan sıfırın üstüne çıkar.                       |

Tüm geçişleri yalnızca kaydın sahibi yapar.

## 8.3 Ödeme durumları

| **Mevcut** | **Olay** | **Yeni**  |
|------------|----------|-----------|
| —          | record   | confirmed |
| confirmed  | void     | voided    |

## 8.4 Taksit durumları

Taksit durumu saklanmaz, her sorguda hesaplanır (türetilmiş durum). Böylece tutarsızlık oluşmaz.

| **Durum** | **Hesaplama**                                             |
|-----------|-----------------------------------------------------------|
| upcoming  | paid \< amount ve due_date \> bugün                       |
| due_today | paid \< amount ve due_date = bugün                        |
| overdue   | paid \< amount ve due_date \< bugün                       |
| partial   | 0 \< paid \< amount (yukarıdakilerle birlikte gösterilir) |
| paid      | paid = amount                                             |

# 9. Teknik Mimari

## 9.1 Teknoloji seçimleri

| **Katman**       | **Seçim**                                                                               | **Gerekçe**                                                            |
|------------------|-----------------------------------------------------------------------------------------|------------------------------------------------------------------------|
| Mobil            | React Native + Expo (güncel SDK), TypeScript, Expo Router                               | Tek kod tabanı ile iOS ve Android; EAS Build/Update ile hızlı yayın.   |
| Durum yönetimi   | TanStack Query (sunucu durumu), Zustand (yerel UI durumu)                               | Sunucu verisi tek kaynaktan; önbellek ve yeniden deneme hazır.         |
| Formlar          | react-hook-form + zod                                                                   | Şemalar `packages/shared`'da.                                          |
| Backend          | Supabase: PostgreSQL, Auth, RLS, RPC (plpgsql), Edge Functions, Storage, pg_cron        | İş kuralları veritabanında; transaction ve kilitleme garantisi.        |
| SMS / OTP        | Supabase Phone Auth + Send SMS Hook ile yerli SMS sağlayıcı (ör. Netgsm, İleti Merkezi) | Türkiye’de teslim oranı ve maliyet. Sağlayıcı değiştirilebilir katman. |
| Bildirim         | Expo Push Notifications (APNs/FCM)                                                      | Tek API; token yönetimi basit.                                         |
| Hata izleme      | Sentry (mobil + edge)                                                             | Kırılma ve hata görünürlüğü.                                           |
| Ürün analitiği   | PostHog (AB bölgesi) veya kendi olay tablosu                                            | Huni ve kohort analizi. KVKK için kişisel veri gönderilmez.            |
| CI/CD            | GitHub Actions + EAS Build + Supabase CLI migration                                     | Her PR’da test, tag ile yayın.                                         |

## 9.2 Bileşen yapısı

Mobil uygulama (Expo / RN) HTTPS ve JWT ile Supabase'e bağlanır. Web bileşeni yoktur.

- **Auth:** telefon OTP, JWT.
- **PostgREST:** yalnızca okuma görünümleri (RLS).
- **RPC fonksiyonları:** tüm yazma işlemleri.
- **Edge Functions:** PIN girişi, push, SMS hook, hesap silme.
- **pg_cron:** hatırlatma üretimi, tekrarlayan işlem (gizli modül açıkken).
- **Storage:** dekont ve profil görselleri (özel bucket).

Dış servisler: SMS sağlayıcı (OTP), Expo Push (APNs/FCM).

## 9.3 Mimari ilkeler

1.  **Sunucu otoritesi:** İstemci çekirdek tablolara doğrudan yazamaz. RLS ile insert/update/delete kapalıdır. Tüm yazmalar security definer RPC fonksiyonlarıyla yapılır; fonksiyon önce yetkiyi, sonra durum geçişinin geçerliliğini kontrol eder.

2.  **Tek transaction:** Her durum geçişi tek transaction’dır: satır kilidi (SELECT ... FOR UPDATE), kontrol, güncelleme, olay kaydı, bildirim kuyruğu.

3.  **İyimser eşzamanlılık:** Anlaşmada row_version sütunu bulunur. İstemci gördüğü versiyonu gönderir; uyuşmazsa işlem 409 conflict ile reddedilir ve istemci güncel veriyi çeker.

4.  **Idempotency:** Ödeme ve oluşturma işlemleri istemcide üretilen UUID anahtar taşır; UNIQUE kısıt ile tekrar işlenmez.

5.  **Değiştirilemez geçmiş:** Versiyonlar ve olay kaydı yalnızca eklenir. Bakiye, geçerli ödemelerden türetilir; ayrıca önbelleğe alınmış bir outstanding_minor sütunu aynı transaction’da güncellenir ve periyodik tutarlılık kontrolüyle doğrulanır.

6.  **Bildirimler asenkron:** Transaction içinde notification_outbox tablosuna yazılır; edge function kuyruktan okuyup gönderir (outbox deseni). Bildirim hatası iş işlemini geri almaz.

7.  **Çevrimiçi yazma:** İlk sürümde yazma işlemleri bağlantı ister. Çevrimdışıyken veriler önbellekten okunur, yazma butonları açıklamalı olarak devre dışı kalır.

## 9.4 Klasör yapısı

```
apps/mobile/
	app/                 yalnızca rotalar: (auth), (tabs), agreement/[id], new, split, loans, me
	src/
		api/               AgreementsApi, adaptörler (mock, supabase), hook'lar
		components/        tasarım sistemi bileşenleri
		features/          agreement, new, debts, split, loans, calendar, home, auth, me, push
		i18n/tr.ts         tüm metinler
		lib/               supabase istemcisi, push, sentry, analytics
packages/shared/       saf TS: plan üretimi, dağıtım, para, hesap bölme, zod şemaları
supabase/              migrations, functions, tests (pgTAP)
```

Plan üretimi ve ödeme dağıtımı aynı algoritmayla hem istemcide (önizleme) hem veritabanında (kesin sonuç) çalışır; iki uygulamanın aynı sonucu verdiği testlerle doğrulanır. Hesap bölme bakiyeleri ve sadeleştirme de aynı kurala uyar.

# 10. Veri Modeli

Tablo adları İngilizce, açıklamalar Türkçedir. Tüm tablolarda created_at timestamptz default now() bulunur, ayrıca yazılmamıştır.

## 10.1 Tablolar

profiles

| **Sütun**         | **Tip**          | **Açıklama**             |
|-------------------|------------------|--------------------------|
| id                | uuid PK          | auth.users.id ile aynı   |
| display_name      | text             | Görünen ad; first_name + last_name'den türer |
| first_name / last_name | text        | Ad / soyad (ADR-051)     |
| username          | text UNIQUE null | @kullanıcı adı; yalnızca gösterim, aramada kullanılmaz |
| avatar_path       | text null        | Özel `avatars` bucket'ında yol |
| reminder_before_days | int[]         | Vade öncesi hatırlatma: 7, 3, 1, 0 alt kümesi; varsayılan {3,0} |
| phone_e164        | text UNIQUE      | Doğrulanmış numara, +90… |
| locale / timezone | text             | tr-TR / Europe/Istanbul  |
| deleted_at        | timestamptz null | Hesap silme işareti      |

contacts

| **Sütun**         | **Tip**                | **Açıklama**                         |
|-------------------|------------------------|--------------------------------------|
| id                | uuid PK                |                                      |
| owner_id          | uuid FK profiles       | Rehber sahibi                        |
| display_name      | text                   | Sahibin verdiği ad                   |
| kind              | enum: person, merchant | Satıcı serbest metin taraf           |

agreements

| **Sütun**                 | **Tip**                          | **Açıklama**                     |
|---------------------------|----------------------------------|----------------------------------|
| id                        | uuid PK                          |                                  |
| creator_id                | uuid FK profiles                 | Oluşturan                        |
| creator_role              | enum: creditor, debtor           | Oluşturanın rolü                 |
| counterparty_contact_id   | uuid FK contacts                 | Oluşturanın gözünden karşı taraf |
| kind                      | enum: loan, installment_purchase |                                  |
| title / description       | text                             | ör. “Mobilya”                    |
| currency                  | char(3)                          | TRY                              |
| principal_minor           | bigint                           | Toplam tutar (kuruş)             |
| outstanding_minor         | bigint                           | Önbelleğe alınmış kalan          |
| status                    | enum (bkz. 8.1)                  | personal, settled, cancelled     |
| active_version            | int                              | Yürürlükteki versiyon            |
| row_version               | int                              | İyimser kilit                    |
| settled_at / cancelled_at | timestamptz null                 |                                  |

agreement_versions

| **Sütun**              | **Tip**                                               | **Açıklama**                                                           |
|------------------------|-------------------------------------------------------|------------------------------------------------------------------------|
| agreement_id + version | PK                                                    |                                                                        |
| terms                  | jsonb                                                 | principal, down_payment, plan\[\] {seq, due_date, amount_minor}, notes |
| created_by             | uuid                                                  |                                                                        |
| reason                 | text null                                             | Değişiklik gerekçesi                                                   |

installments

| **Sütun**             | **Tip**   | **Açıklama**              |
|-----------------------|-----------|---------------------------|
| id                    | uuid PK   |                           |
| agreement_id, version | FK        | Hangi versiyonun taksiti  |
| seq                   | int       | Sıra                      |
| due_date              | date null | Vadesiz için null         |
| amount_minor          | bigint    |                           |
| paid_minor            | bigint    | Dağıtımlardan güncellenir |

payments ve payment_allocations

| **Sütun**                | **Tip**                                  | **Açıklama**               |
|--------------------------|------------------------------------------|----------------------------|
| id                       | uuid PK                                  |                            |
| agreement_id             | uuid FK                                  |                            |
| amount_minor             | bigint \> 0                              |                            |
| paid_on                  | date                                     | Ödeme tarihi               |
| method                   | enum: cash, transfer, card, other        |                            |
| kind                     | enum: payment, down_payment, discount    | İndirim/af da bakiye düşer |
| status                   | enum (bkz. 8.3)                          | confirmed, voided          |
| recorded_by              | uuid                                     |                            |
| idempotency_key          | uuid UNIQUE                              |                            |
| attachment_path          | text null                                | Storage yolu               |
| allocations              | payment_id, installment_id, amount_minor | Ayrı tablo                 |

agreement_events (olay kaydı)

| **Sütun**            | **Tip**                | **Açıklama**                                            |
|----------------------|------------------------|---------------------------------------------------------|
| id                   | bigint identity        |                                                         |
| agreement_id         | uuid                   |                                                         |
| actor_id             | uuid null              | Sistem olayında null                                    |
| type                 | text                   | created, updated, payment_recorded, payment_voided…     |
| version              | int                    | İlgili versiyon                                         |
| payload              | jsonb                  | Olaya özgü veri                                         |

Diğer tablolar

- reminders: agreement_id, installment_id, user_id, fire_at, kind, status (scheduled, sent, cancelled).

- notification_outbox: user_id, template, payload, status, attempts, next_attempt_at.

- push_tokens: user_id, expo_token, platform, last_seen_at.

- notifications (bildirim kutusu, ADR-051): user_id, template, payload, agreement_id null, created_at, read_at null. Outbox'a yazılan her bildirim buraya da yazılır; 90 gün saklanır.

- consents: user_id, document (kvkk, terms), version, accepted_at.

- accounts (ADR-053): owner_id, kind (bank, cash, savings, other), name, bank_name null, opening_balance_minor bigint (eksi olabilir), include_in_total, archived_at null, idempotency_key, row_version, updated_at.

- transactions (ADR-053): owner_id, kind (expense, income, transfer, adjustment), account_id, to_account_id null (yalnızca transfer), amount_minor bigint (yalnızca düzeltmede işaretli), category null, title null, note null, occurred_on date, idempotency_key, deleted_at null, row_version, updated_at. Bakiye saklanmaz.

- transaction_events (yalnızca ekleme): transaction_id, owner_id, type (created, updated, deleted, restored), changes jsonb ({alan: [eski, yeni]}).

- recurring_rules (ADR-054): owner_id, kind (expense, income), name, amount_minor, category, account_id, frequency (weekly, monthly, yearly), start_on, confirm_each, tracking_from, paused_at null, idempotency_key, row_version.

- recurring_occurrences: rule_id + occurrence_on (PK), status (posted, skipped), transaction_id null.

- budgets: owner_id + category (PK, gider kategorisi), limit_minor.

- loans (ADR-056): owner_id, bank_name, loan_type, principal_minor, monthly_rate_bps (339 = %3,39), term_months, first_due_on, installment_minor, payment_account_id null, archived_at null. Taksit kaydı transactions.to_loan_id ile krediye bağlanır; hesap seçilmediyse account_id boştur.

- split_groups (ADR-064): owner_id, title, archived_at null, idempotency_key, row_version.

- split_group_members: group_id, seq, display_name, is_me. Grup başına bir is_me üye.

- split_expenses: group_id, title, total_minor, spent_on, payer_member_id, mode (equal, amount, percent), idempotency_key, deleted_at null, row_version. split_expense_shares: expense_id + member_id (PK), share_minor.

- split_settlements: group_id, from_member_id, to_member_id, amount_minor, settled_on, idempotency_key, deleted_at null. Bakiye tablosu yoktur.

- split_group_events (yalnızca ekleme): group_id, type, payload. Harcama ve ödeşme eklemelerini, değişiklikleri ve silmeleri tutar.

- Kullanıcı adı kontrolü sayacı `rate_limits` tablosundadır.

## 10.2 Satır düzeyi güvenlik (RLS)

- Okuma: kullanıcı yalnızca creator_id / owner_id kendisi olan kayıtları görür. Kullanıcılar arası hiçbir görünürlük yoktur.

- Yazma: tüm tablolarda istemciye kapalı. Yalnızca RPC fonksiyonları yazar.

## 10.3 RPC fonksiyonları

| **Fonksiyon**                                                       | **Görev**                                                                   |
|---------------------------------------------------------------------|-----------------------------------------------------------------------------|
| create_agreement(input, idem_key)                                   | Kayıt + v1 + taksitler + peşinat ödemesi                                    |
| update_personal_agreement(id, terms, row_version)                   | Düzenleme (yeni versiyon)                                                   |
| cancel_agreement(id, row_version)                                   | İptal                                                                       |
| get_my_profile() / update_profile(first, last, username) / check_username(u) | Kendi profili; ad, soyad, @kullanıcı adı (ADR-051)                |
| set_avatar(path)                                                    | `avatars/{uid}/{uuid}.jpg`; eski yolu silinmek üzere döner                  |
| list_notifications(before_id, limit) / mark_notifications_read(ids) | Bildirim kutusu; okunmamış sayısı                                           |
| set_reminder_prefs(days)                                            | Vade öncesi hatırlatma: 7, 3, 1, 0 alt kümesi                               |
| record_payment(id, input, idem_key)                                 | Ödeme: confirmed, dağıtım, gerekirse kapanış                                |
| void_payment(payment_id, row_version)                               | Ödemeyi siler: voided, dağıtım geri alınır, gerekirse kayıt açılır          |
| forgive_remaining(id, amount?)                                      | Alacaklının indirimi                                                        |
| get_dashboard() / get_calendar(month)                               | Okuma için optimize görünümler                                              |
| create_account(input, idem_key) / update_account(id, input, row_version) / archive_account(id, row_version) | Kendi hesapları (ADR-053)                  |
| list_accounts()                                                     | Açık hesaplar, türetilmiş bakiyeler, Toplam Nakit                           |
| adjust_account_balance(id, target_minor, idem_key)                  | Bakiye düzelt: farkı düzeltme kaydı olarak yazar                            |
| create_transaction(input, idem_key) / update_transaction(id, input, row_version) | Gider, gelir, transfer; değişiklikler geçmişe              |
| delete_transaction(id, row_version) / restore_transaction(id, row_version) | Geçici silme ve geri alma                                            |
| get_transaction(id) / list_transactions(month, account_id?) / get_cash_summary(month) | Detay + geçmiş / ay listesi + gelir-gider / Ana Sayfa özeti |
| create_recurring / update_recurring / set_recurring_paused / delete_recurring / list_recurring | Tekrarlayan işlem kuralları; sonraki 3 tarih ve onay bekleyenler (ADR-054) |
| confirm_recurring(rule, date, idem_key) / skip_recurring(rule, date) | Günü gelen tarihi kaydet ya da atla |
| set_budget(category, limit) / list_budgets(month) | Kategori bütçesi; harcananla birlikte |
| get_monthly_report(month) | Gelir, gider, kategori dağılımı, 6 aylık seri |
| create_loan / update_loan / archive_loan / list_loans / get_loan / record_loan_payment | Banka kredileri, türetilmiş ödeme planı, taksit kaydı (ADR-056) |
| create_agreement_with_paid(input, paid_count, idem_key) | Kayıt + geçmiş ilk n taksitin ödemesi, tek işlemde (ADR-059) |
| create_split_group(input, idem_key) / update_split_group(id, input, row_version) / archive_split_group(id, row_version) | Grup ve üyeler (ADR-064) |
| add_split_expense(group, input, idem_key) / update_split_expense(id, input, row_version) / delete_split_expense(id, row_version) | Harcama ve paylar |
| add_split_settlement(group, input, idem_key) / delete_split_settlement(id) | Ödeşme |
| list_split_groups() / get_split_group(id) | Gruplar, türetilmiş bakiyeler, sadeleştirilmiş borçlar, geçmiş |

## 10.4 Edge Functions

| **Fonksiyon**                | **Görev**                                                                |
|------------------------------|--------------------------------------------------------------------------|
| pin-login / pin-set          | PIN girişi ve belirleme (ADR-049).                                       |
| dispatch-notifications       | Outbox’tan push gönderir; geçersiz token’ları temizler.                  |
| schedule-reminders (pg_cron) | Her gün vadesi yaklaşan ve geçen taksitler için hatırlatma üretir.       |
| delete-account               | Hesabı ve tüm verisini siler.                                            |
| send-sms-hook                | Supabase Auth OTP’sini yerli SMS sağlayıcıya iletir.                     |

# 11. Güvenlik

## 11.1 Kimlik doğrulama

- Telefon + 6 haneli PIN (ADR-046). Kayıtta numara SMS koduyla doğrulanır, ardından PIN iki kez girilerek belirlenir. "Şifremi unuttum": SMS kodu → yeni PIN. PIN'i olmayan eski hesaplar SMS ile girdikten sonra PIN belirler.
- PIN, Supabase Auth'ta hesabın parolası olarak tutulur; ama PIN'in kendisi değil, sunucudaki `PIN_PEPPER` sırrıyla türetilmiş HMAC değeri (ADR-049). Bu yüzden Auth'a doğrudan parola girişi işe yaramaz; tek yol `pin-login` edge function'ıdır.
- Hesap kilidi sunucuda: `pin-login` her başarısız denemeyi `pin_login_attempts`'e yazar (numara yalnızca hash'iyle); 15 dakika içinde 5 hata numarayı 15 dakika kilitler. Kayıtlı olmayan numara da aynı yanıtı alır. Başarılı giriş ve yeni PIN sayacı sıfırlar.
- Zayıf PIN reddedilir: tüm haneleri aynı olan ve art arda gelen (123456, 654321) PIN'ler; kural uygulamada ve `pin-set`'te aynı.

- Oturum: Supabase JWT (kısa ömürlü erişim + yenileme token’ı). Token’lar Expo SecureStore’da (Keychain/Keystore) saklanır.

- İsteğe bağlı uygulama kilidi: Face ID / Touch ID / cihaz PIN’i (expo-local-authentication).

- Numara değişikliği: eski ve yeni numaraya OTP ile.

## 11.2 Web onay sayfası tehdit modeli

Kaldırıldı (ADR-064). Web yüzeyi yoktur. SMS kötüye kullanımına karşı yalnızca +90 numaralar, numara başına zaman sınırı ve günlük SMS bütçe alarmı kalır.

## 11.3 Uygulama ve altyapı

- İstemci yalnızca anon anahtarı taşır; servis rolü anahtarı yalnızca edge function ortam değişkenlerinde.

- Storage: dekont bucket’ı özel; erişim kısa süreli imzalı URL ile ve yalnızca kaydın sahibine.

- Dekont yükleme: yalnızca görsel/PDF, en fazla 5 MB, sunucuda MIME doğrulama, EXIF temizleme.

- Tüm RPC’lerde girdi doğrulama (tutar \> 0, tarih aralığı, metin uzunluğu).

- Rate limit: kullanıcı başına dakikada işlem sınırı (RPC’lerde sayaç tablosu veya edge katmanında).

- Bağımlılık taraması (Dependabot), gizli anahtar taraması, migration’ların kod incelemesi.

- Yedekleme: Supabase günlük yedek + PITR (ücretli plan).

- Loglarda telefon numarası ve tutar maskelenir.

# 12. KVKK ve Hukuki Çerçeve

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Önemli</strong></p>
<p>Bu bölüm teknik bir ön değerlendirmedir, hukuki görüş değildir. Yayından önce bir avukatla aşağıdaki başlıklar netleştirilmelidir.</p></td>
</tr>
</tbody>
</table>

| **Konu**                  | **Durum ve yaklaşım**                                                                                                                                          |
|---------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Kullanıcı verisi          | Aydınlatma metni, açık rıza gereken durumların belirlenmesi, VERBİS yükümlülüğünün değerlendirilmesi.                                                          |
| Üçüncü kişi verisi        | Kullanıcı, başka kişilerin adını ve borç bilgisini kendi defterine giriyor. Veri minimizasyonu: numara alınmaz; rehber sunucuya yüklenmez.   |
| Yurt dışına veri aktarımı | Supabase/Sentry/PostHog sunucularının konumu ve KVKK’daki yurt dışı aktarım kuralları. Gerekirse bölge seçimi veya yurt içi barındırma.                        |
| Silme hakkı               | Hesap silmede kullanıcının tüm kayıtları silinir. Başka kullanıcıyı ilgilendiren veri yoktur. |
| Ödeme hizmeti kapsamı     | Uygulama para tutmaz, ödeme başlatmaz; 6493 sayılı Kanun kapsamındaki ödeme hizmeti sunulmaz. Bu sınır ürün kararı olarak korunmalı.                           |
| Faiz                      | Kişiler arası faizli borç kaydı ve hesaplaması sunulmaz. Banka kredisinde faiz yalnızca gösterim ve simülasyondur.                                                                                           |
| Senet                     | Senet görseli ve bilgisi saklanabilir; uygulama e-senet düzenlemez ve kaydın hukuki geçerliliği hakkında iddiada bulunmaz.                                     |
| Kayıtların delil niteliği | Kayıtlar tek taraflıdır ve kullanıcının kendi notudur; delil ya da “resmi belge” olarak pazarlanmaz.                                                                               |
| Kullanım koşulları        | Kötüye kullanım yasağı ve hesap kapatma hakkı.                                                                                   |

# 13. Analitik ve Başarı Ölçütleri

## 13.1 Kuzey yıldızı metriği

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Haftalık aktif kayıt sayısı</strong></p>
<p>Son 7 günde en az bir olay (ödeme, düzenleme, yeni harcama) yaşayan kayıt ve grup sayısı. Uygulama açılış sayısı yerine, defterin gerçekten kullanılıp kullanılmadığını ölçer.</p></td>
</tr>
</tbody>
</table>

## 13.2 Huni ve davranış metrikleri

| **Metrik**               | **Tanım**                                                      | **Pilot hedefi**  |
|--------------------------|----------------------------------------------------------------|-------------------|
| Aktivasyon               | Kayıt olanların ilk anlaşmayı oluşturma oranı                  | %60+              |
| İlk kayıt süresi         | Uygulama açılışından ilk anlaşmaya                             | \< 90 sn          |
| Taksitli oran            | Oluşturulan anlaşmalardan taksitli olanlar                     | İzlenecek         |
| Hesap bölme kullanımı    | En az bir grup açan kullanıcı oranı                            | İzlenecek         |
| Tekrar kullanım          | İlk anlaşması kapanan kullanıcıların ikinci anlaşma açma oranı | %30+              |
| Tutunma                  | D7 ve D30 aktif kullanıcı (bilgi amaçlı)                       | D7 %30+, D30 %15+ |

Hedefler sektör garantisi değil, pilot için konan karar eşikleridir. Ödemeler aylık olduğundan günlük açılış başarının doğru ölçüsü değildir.

## 13.3 Olay listesi

app_opened, signup_completed, agreement_created {kind, installments}, agreement_updated, payment_recorded {role}, agreement_settled, reminder_sent, reminder_opened, split_group_created, split_expense_added {mode}, split_settlement_added.

Olaylara tutar aralığı dışında kişisel veri eklenmez (ad, numara, not gönderilmez).

# 14. Gelir Modeli

| **Ücretsiz (her zaman)**          | **Premium (sonra)**                           |
|-----------------------------------|-----------------------------------------------|
| Sınırsız kişisel anlaşma          | Anlaşma ve ödeme geçmişinin PDF çıktısı       |
| Taksit planı, kısmi ödeme, takvim | Gelişmiş raporlar ve dışa aktarma (Excel/CSV) |
| Hesap bölme                       | Çoklu para birimi ve altın bazlı borç         |
| Hatırlatmalar                     | Doğal dil ile hızlı kayıt (yüksek kota)       |
| Temel dekont ekleme               | İleride: kişisel finans modülleri             |

- İlke: Kayıt, hesap bölme ve hatırlatma ücret duvarı arkasında olmaz.

- Fiyat, pilot sonrası ödeme isteği görüşmeleri ve test ile belirlenir. Abonelik yönetimi için RevenueCat değerlendirilir.

- Enflasyon nedeniyle fiyatlar yılda en az bir kez gözden geçirilir; yıllık plan teşvik edilir.

# 15. Yol Haritası ve Yapılacaklar

Faz 0 — Doğrulama (1 hafta)

| **Görev**                                                                                                | **Çıktı**                   |
|----------------------------------------------------------------------------------------------------------|-----------------------------|
| 15–20 kullanıcı görüşmesi (borç veren/alan, elden taksit, ev arkadaşı)                                   | Görüşme notları ve özet     |
| Tıklanabilir prototip: borç ekle → paylaş → web’de onayla                                                | Figma veya Expo prototipi   |
| Rakip uygulamaları kurup karşılıklı onay akışını test etmek                                              | Rakip test raporu           |
| Karar kuralı: görüşülenlerin %40+’ı somut gerekçeyle link gönderirim diyorsa karşılıklı akış ana özellik | Devam / yön değiştir kararı |
| Paramnet için marka araştırması, alan adı, bekleme listesi sayfası                                       | Marka varlıkları            |
| Avukatla KVKK ön görüşmesi                                                                               | Hukuki yapılacaklar listesi |

Faz 1 — Temel ve kişisel defter (Hafta 1–4)

- Supabase projesi, migration altyapısı, CI.

- Şema, RLS, durum makinesi fonksiyonları ve pgTAP testleri (ilk hafta, kod yazmadan önce testler).

- Paylaşılan domain paketi: plan üretimi, dağıtım, para biçimlendirme + birim testleri.

- Auth akışı (telefon OTP, SMS hook).

- Ekranlar: Ana Sayfa, Kişiler, Kayıt formu, Plan önizleme, Anlaşma detay, Ödeme ekle, Takvim.

- Push token kaydı ve hatırlatma zamanlayıcısı.

**Çıkış ölçütü:** Kişisel modda anlaşma oluştur, öde, kapat; hatırlatma telefona düşüyor.

Faz 2 — Karşılıklı akış

Tamamlandı, sonra kaldırıldı (ADR-064).

Faz 5 — Tek taraflı defter

- Kredi kartlarının silinmesi.

- Gizli modüller ve borç odaklı Ana Sayfa.

- Karşılıklı akışın mobilden ve sunucudan silinmesi, web onay sayfasının kaldırılması.

- Tek taraflı hesap bölme.

**Çıkış ölçütü:** Bölüm 5'teki akışlar tek hesapla eksiksiz çalışıyor; başka kullanıcıya ait hiçbir veri ne görünüyor ne gönderiliyor. Görev listesi `docs/ROADMAP.md`'dedir.

Faz 3 — Pilot ve yayın (Hafta 8–10)

- Sentry, analitik olayları, yönetici için basit metrik paneli.

- Güvenlik kontrol listesi, yük ve kötüye kullanım testleri (OTP, rate limit).

- KVKK metinleri, hesap silme, veri dışa aktarma.

- TestFlight / Play kapalı test ile 30–50 kişilik pilot.

- Mağaza materyalleri (ekran görüntüleri, açıklama, gizlilik bildirimleri).

- Hata düzeltme ve mağaza yayını.

**Çıkış ölçütü:** Pilot metrikleri ölçülüyor; kritik hata yok; mağazalarda yayında.

Sonraki sürümler (kullanıcı verisine göre önceliklendirilir)

| **Sürüm** | **İçerik**                                                                              |
|-----------|-----------------------------------------------------------------------------------------|
| 1.1       | Doğal dil ile hızlı kayıt, PDF çıktı, premium başlangıcı                                |
| 1.2       | Çoklu para birimi ve altın                                                              |
| 2.0       | Kişisel finans: gizli modüllerin açılması (kullanıcı verisine göre)                     |
| 2.x       | Ekstre PDF okuma, nakit akışı tahmini, AI asistan                                       |
| 3.x       | Lisanslı bir açık bankacılık sağlayıcısıyla iş ortaklığı                                |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Süre notu</strong></p>
<p>8–10 hafta, tek geliştirici için sıkı kontrol edilen kapsamla hedeflenen süredir; kesin taahhüt değildir. Kapsam değişiklikleri sonraki sürüme yazılır, mevcut faza eklenmez.</p></td>
</tr>
</tbody>
</table>

# 16. Test Stratejisi

| **Katman**      | **Araç**                     | **Kapsam**                                                                                                                                |
|-----------------|------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| Domain (TS)     | Vitest                       | Plan üretimi, yuvarlama, ay sonu tarihleri, ödeme dağıtımı, hesap bölme; özellik tabanlı testler (fast-check) ile “toplam her zaman eşit” ve “bakiyeler toplamı sıfır” değişmezleri |
| Veritabanı      | pgTAP                        | Her durum geçişi (izinli ve izinsiz), RLS politikaları, idempotency, eşzamanlı ödeme yarışları                                            |
| Mobil bileşen   | React Native Testing Library | Formlar, durum etiketleri, boş durumlar                                                                                                   |
| Edge Functions  | Deno test                    | PIN girişi, kilit, bildirim gönderimi                                                                                                     |
| Uçtan uca mobil | Maestro                      | Kayıt → kayıt oluşturma → ödeme → kapanış; grup → harcama → ödeşme                                                                        |
| Tutarlılık işi  | pg_cron                      | Günlük: outstanding_minor ile ödemelerden hesaplanan bakiye karşılaştırması, sapma alarmı                                                 |

Kritik test senaryoları

1.  Aynı ödeme isteği iki kez gelir: tek kayıt oluşur.

2.  Ödeme kalan borçtan fazla: reddedilir.

3.  31 Ocak başlangıçlı aylık plan: Şubat taksiti ayın son günü.

4.  Düzenleme sonrası geçmiş ödemeler korunur, yeni plan kalan tutara kurulur.

5.  Kapanmış kayıtta ödeme silinir: kayıt açılır, kalan doğru.

6.  Başka kullanıcı kaydı, grubu ya da bildirimi okuyamaz ve yazamaz.

7.  Grup bakiyeleri toplamı her harcama ve ödeşmeden sonra sıfırdır.

8.  Sadeleştirme aynı girdiden aynı sonucu verir; ödeme sayısı üye sayısından az olur.

9.  Ödeyen dahil olmayan harcamada kuruş farkı doğru üyeye yazılır.

10. Hesap silme: kullanıcının tüm kayıtları ve grupları silinir.

# 17. Riskler ve Önlemler

| **Risk**                                                     | **Etki**   | **Olasılık** | **Önlem**                                                              |
|--------------------------------------------------------------|------------|--------------|------------------------------------------------------------------------|
| Manuel giriş yorar, kullanım düşer                           | Yüksek     | Yüksek       | 90 sn hedefi; şablonlar; doğal dil kaydı 1.1’de                        |
| Bakiye tutarsızlığı güveni zedeler                           | Çok yüksek | Düşük        | Sunucu otoritesi, transaction, pgTAP, günlük tutarlılık işi            |
| SMS maliyeti ve kötüye kullanım                              | Orta       | Orta         | Rate limit, bütçe alarmı, yalnızca +90                                 |
| Tek taraflı defter rakiplerden ayrışmaz                      | Yüksek     | Yüksek       | Sadelik, hesapsız hesap bölme, Türkçe dil; pilotta ölçülür             |
| Rakip aynı özelliği ekler                                    | Orta       | Orta         | Hız, deneyim kalitesi, Türkiye’ye özgü dil ve akışlar                  |
| KVKK uyumsuzluğu                                             | Yüksek     | Düşük        | Avukat ön görüşmesi, veri minimizasyonu, bölge seçimi                  |
| Kapsam kayması                                               | Yüksek     | Yüksek       | Bu doküman kapsam sözleşmesi; yeni fikirler sonraki sürüm listesine    |
| Bildirimlerin spam algılanması                               | Orta       | Orta         | Sessiz saatler, sınırlı sıklık, anlaşma bazında kapatma                |

# 18. Geliştirme Ortamı: Claude Code Skill ve Plugin Seti

Geliştirme Claude Code ile yapılacaktır. Bu bölüm hangi skill ve plugin’lerin kurulacağını, hangi fazda kullanılacağını ve projeye özel yazılacak skill’leri tanımlar. Bilgiler 11 Ekim 2026 itibarıyla resmi depolardan derlenmiştir; komutlar kurulumdan önce kaynak depodan teyit edilmelidir.

## 18.1 Kullanım ilkeleri

- **Az ama doğru:** Çok sayıda skill Claude’un yanlış skill seçmesine ve bağlamın boşuna dolmasına yol açar. Aşağıdaki çekirdek set dışında ekleme, ihtiyaç doğduğunda yapılır.

- **Örtüşmeden kaçın:** Aynı konuyu kapsayan iki skill kurulmaz (ör. Callstack ve Vercel React Native kuralları).

- **Proje kapsamı:** Projeye özel skill’ler repoda .claude/skills/ altında tutulur ve git ile versiyonlanır. Genel plugin’ler kullanıcı kapsamında kurulabilir.

- **Güven:** Üçüncü taraf skill’lerin SKILL.md ve script’leri kurulmadan önce okunur. Resmi marketplace bile içerikten sorumlu olmadığını belirtir.

- **Yeniden yükleme:** Plugin kurulumundan sonra Claude Code içinde /reload-plugins çalıştırılır veya oturum yeniden başlatılır.

## 18.2 Çekirdek set (Faz 1’den itibaren kurulu)

<table>
<colgroup>
<col style="width: 26%" />
<col style="width: 21%" />
<col style="width: 52%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Skill / Plugin</strong></th>
<th><strong>Kaynak</strong></th>
<th><strong>Ne için kullanılacak</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p>supabase (plugin)</p>
<p>• supabase</p>
<p>• supabase-postgres-best-practices</p></td>
<td>Supabase (resmi), claude-plugins-official</td>
<td>Supabase MCP sunucusu + skill’ler. Şema, migration, RLS politikaları ve testleri, plpgsql fonksiyonları, Edge Functions, pg_cron, Storage, Auth ve kilitlenme/performans sorunları. Bölüm 9–10’un tamamı.</td>
</tr>
<tr class="even">
<td>expo (plugin)</td>
<td>Expo (resmi), claude-plugins-official</td>
<td>Proje yapısı (expo-project-structure), navigasyon (expo-router), native görünüm (expo-native-ui), veri çekme ve önbellek (expo-data-fetching), Universal Link/AASA (expo-app-clip), geliştirme istemcisi (expo-dev-client), SDK yükseltme (expo-upgrade), mağaza yayını ve CI (eas-app-stores, eas-workflows — ücretli EAS).</td>
</tr>
<tr class="odd">
<td>react-native-best-practices</td>
<td>Callstack</td>
<td>React Native performansı: render optimizasyonu, liste performansı, native iOS/Android tarafı, bundle boyutu.</td>
</tr>
<tr class="even">
<td>superpowers (plugin)</td>
<td>obra/superpowers, claude-plugins-official</td>
<td>test-driven-development, systematic-debugging, writing-plans, verification-before-completion. Bölüm 16’daki “önce test” disiplinini zorunlu kılar.</td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Superpowers notu</strong></p>
<p>Kapsamlı bir iş akışı paketidir ve oturumun akışını sahiplenir. İlk hafta denenir; yavaşlatıyorsa yalnızca TDD ve debugging skill’leri kullanılmaya devam edilir.</p></td>
</tr>
</tbody>
</table>

## 18.3 Mobil uygulamaya özel skill’ler

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 21%" />
<col style="width: 44%" />
<col style="width: 10%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Skill</strong></th>
<th><strong>Kaynak</strong></th>
<th><strong>Ne için</strong></th>
<th><strong>Faz</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p>platform-design-skills</p>
<p>(ios, android)</p></td>
<td>ehmo/platform-design-skills</td>
<td>Apple Human Interface Guidelines ve Material Design 3 kuralları: dokunma alanları, tipografi, Dynamic Type, koyu tema, erişilebilirlik, platforma özgü navigasyon desenleri. Ekranların native hissettirmesi için. Yalnızca ios ve android skill’leri kurulur.</td>
<td>Faz 1</td>
</tr>
<tr class="even">
<td>maestro-mobile-testing</td>
<td>tovimx/maestro-mobile-testing-skill</td>
<td>React Native/Expo için Maestro E2E testleri: kararsız testleri önleme, testID seçici stratejisi, oturum açık/kapalı akışlar, native alert yönetimi, alt akışlar, API mock. Bölüm 16’daki uçtan uca mobil senaryolar.</td>
<td>Faz 2–3</td>
</tr>
<tr class="odd">
<td>expo-app-clip (expo plugin içinde)</td>
<td>Expo</td>
<td>apple-app-site-association dosyası ve associated domains yapılandırması. Davet linklerinin uygulamayı doğrudan açması için.</td>
<td>Faz 2</td>
</tr>
<tr class="even">
<td><p>aso-skills (seçili)</p>
<p>• aso-audit</p>
<p>• android-aso</p>
<p>• metadata-optimization</p>
<p>• screenshot-optimization</p>
<p>• onboarding-optimization</p>
<p>• rating-prompt-strategy</p>
<p>• retention-optimization</p></td>
<td>Eronred/aso-skills</td>
<td>Mağaza yayını öncesi: Türkçe anahtar kelime ve metin optimizasyonu, Google Play’e özgü kurallar, ekran görüntüsü kurgusu, onboarding ve puanlama isteği zamanlaması, tutunma iyileştirme. Paketin tamamı (~40 skill) değil, yalnızca listelenenler kurulur.</td>
<td>Faz 3</td>
</tr>
<tr class="odd">
<td>frontend-mobile-security (değerlendirilecek)</td>
<td>wshobson/agents</td>
<td>Mobil güvenlik incelemesi. İçeriği kurulumdan önce incelenmeli; claude-security ile örtüşüyorsa kurulmaz.</td>
<td>Faz 3</td>
</tr>
</tbody>
</table>

## 18.4 Güvenlik ve kod inceleme

| **Skill / Plugin**        | **Kaynak**                         | **Ne için**                                                                                                                                   | **Faz** |
|---------------------------|------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|---------|
| claude-security           | Anthropic, claude-plugins-official | Kendi kodunda derin zafiyet taraması, bulguları raporlamadan önce doğrular. Web onay sayfası, edge function’lar ve RPC’ler yazıldıktan sonra. | Faz 2–3 |
| code-review               | Anthropic, claude-plugins-official | Çoklu ajanla PR incelemesi, güven puanıyla yanlış alarm eleme.                                                                                | Faz 1+  |
| supply-chain-risk-auditor | trailofbits/skills                 | npm bağımlılıklarında güvenlik açığı, terk edilmiş paket ve kurulum script’i denetimi.                                                        | Faz 3   |
| insecure-defaults         | trailofbits/skills                 | Güvensiz varsayılan yapılandırmaları (fail-open) bulur.                                                                                       | Faz 3   |

## 18.5 Kurulmayacaklar

| **Skill**                                                           | **Neden**                                                          |
|---------------------------------------------------------------------|--------------------------------------------------------------------|
| vercel-labs react-native-guidelines                                 | Callstack ve Expo skill’leriyle büyük ölçüde örtüşür.              |
| frontend-design                                                     | Web arayüzü odaklı; tek sayfalık onay ekranı için gerekmez.        |
| wshobson ui-design / multi-platform-apps                            | platform-design-skills ve Expo skill’leriyle örtüşür.              |
| platform-design-skills: macos, watchos, visionos, tvos, ipados, web | Ürünün hedef platformu değil.                                      |
| aso-skills’in kalan ~33 skill’i (reklam, UGC, Apple Search Ads vb.) | Pilot aşamasında gereksiz; büyüme fazında yeniden değerlendirilir. |

## 18.6 Projeye özel skill’ler (kendimiz yazacağız)

Hazır skill’ler geneldir. Projenin doğruluğu bu dokümandaki iş kurallarına, durum makinelerine ve mobil kurallara bağlıdır. Bunlar iki proje skill’ine dönüştürülür; böylece Claude Code her RPC, migration veya ekran yazdığında bu kurallara uyar ve kurallar her oturumda yeniden anlatılmaz.

Skill 1: paramnet-domain (alan ve backend kuralları)

> .claude/skills/paramnet-domain/
>
> SKILL.md ← kurallar özeti + iş akışları
>
> references/business-rules.md ← BR-01 … BR-16 (Bölüm 7)
>
> references/state-machines.md ← kayıt ve ödeme geçiş tabloları (Bölüm 8)
>
> references/schema.md ← tablolar, RLS ilkeleri, RPC listesi (Bölüm 10)
>
> references/security.md ← kimlik, anahtar ve kişisel veri kuralları (Bölüm 11)

- **Tetiklenme:** migration, RLS, RPC, edge function, bakiye, taksit, ödeme dağıtımı, hesap bölme veya durum geçişi ile ilgili her iş.

- **İş akışı – yeni durum geçişi eklemek:** 1) Geçiş tablosuna satır ekle, 2) pgTAP testini önce yaz (izinli ve izinsiz aktör), 3) RPC’yi security definer + FOR UPDATE + row_version kontrolüyle yaz, 4) olay kaydı ve outbox satırı, 5) TS tiplerini yeniden üret.

- **Kesin kurallar:** Para kuruş cinsinden bigint; istemci çekirdek tablolara yazmaz; her yazma idempotency anahtarı taşır; onaylar versiyon + terms_hash ile; olay kaydı yalnızca eklenir.

Skill 2: paramnet-mobile (mobil uygulama kuralları)

> .claude/skills/paramnet-mobile/
>
> SKILL.md ← mobil kurallar + ekran yazma iş akışı
>
> references/screens.md ← S01–S20 ekran listesi ve bileşenleri (Bölüm 6)
>
> references/design-tokens.md ← renkler, tipografi, boşluk, durum renkleri
>
> references/copy-tr.md ← Türkçe metinler ve iletişim tonu (Bölüm 3.4)
>
> references/deep-links.md ← bildirimden uygulama içi rotaya geçiş
>
> references/testing.md ← testID adlandırma, Maestro akış listesi

- **Tetiklenme:** ekran, bileşen, navigasyon, form, bildirim, derin bağlantı veya mobil test ile ilgili her iş.

- **Klasör ve katman kuralı:** Bölüm 9.4’teki yapı; iş mantığı src/domain/’da saf TS; ekranlar yalnızca src/api/ hook’larını çağırır, Supabase istemcisini doğrudan kullanmaz.

- **Para ve tarih:** Tutar girişi özel sayısal klavye ile, gösterim her zaman 12.000,00 TL; tarihler Europe/Istanbul; para birimi biçimlendirme tek yardımcı fonksiyondan.

- **Ekran kuralları:** tek birincil aksiyon; her ekranda yükleniyor, boş, hata ve çevrimdışı durumları; çevrimdışıyken yazma butonları açıklamalı devre dışı.

- **Erişilebilirlik:** her etkileşimli öğede accessibilityLabel ve testID; Dynamic Type; renk tek başına anlam taşımaz; minimum dokunma alanı 44 pt.

- **Metin:** tüm kullanıcı metinleri copy-tr.md’deki tonla; “borcunu onayla” gibi suçlayıcı ifadeler yerine kolaylık dili.

- **İş akışı – yeni ekran yazmak:** 1) screens.md’den ekranı oku, 2) dört durumu (yükleniyor/boş/hata/veri) tasarla, 3) testID’leri ver, 4) Maestro akışını ekle, 5) iOS ve Android’de görsel kontrol.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Oluşturma yöntemi</strong></p>
<p>Her iki skill de bu Word dokümanından çıkarılır ve skill-creator ile yazılır. skill-creator tetiklenme açıklamasını test ederek skill’in doğru işlerde devreye girdiğini doğrular.</p>
<p>Doküman güncellendiğinde references/ dosyaları da güncellenir; tek doğruluk kaynağı bu dokümandır.</p></td>
</tr>
</tbody>
</table>

## 18.7 Faz bazında kullanım

| **Faz**                         | **Aktif skill’ler**                                                                                                             |
|---------------------------------|---------------------------------------------------------------------------------------------------------------------------------|
| Faz 0 – Doğrulama               | Yok (görüşmeler ve prototip). İsteğe bağlı: platform-design-skills ile prototip ekranları.                                      |
| Faz 1 – Temel ve kişisel defter | supabase, expo, react-native-best-practices, superpowers, platform-design-skills, code-review, paramnet-domain, paramnet-mobile |
| Faz 2 – Karşılıklı akış         | Faz 1 + expo-app-clip (AASA), maestro-mobile-testing, claude-security (web onay sayfası ve edge function’lar için)              |
| Faz 3 – Pilot ve yayın          | Faz 2 + eas-app-stores, eas-workflows, aso-skills (seçili), supply-chain-risk-auditor, insecure-defaults                        |

## 18.8 Kurulum komutları

Faz 1 başında, proje kök dizininde:

> \# Resmi marketplace
>
> claude plugin marketplace add anthropics/claude-plugins-official
>
> claude plugin install supabase@claude-plugins-official
>
> claude plugin install expo@claude-plugins-official
>
> claude plugin install superpowers@claude-plugins-official
>
> claude plugin install code-review@claude-plugins-official
>
> \# Callstack (Claude Code içinde)
>
> /plugin marketplace add callstackincubator/agent-skills
>
> /plugin install building-react-native-apps@callstack-agent-skills (react-native-best-practices skill'i bu pakette)
>
> \# Platform tasarım kuralları (yalnızca ios ve android)
>
> npx skills add ehmo/platform-design-skills --skill ios-design-guidelines android-design-guidelines --agent claude-code -y
>
> /reload-plugins

Faz 2 başında:

> npx -y skills add tovimx/maestro-mobile-testing-skill --skill maestro-mobile-testing --agent claude-code
>
> claude plugin install claude-security@claude-plugins-official

Faz 3 başında:

> npx skills add eronred/aso-skills --skill aso-audit android-aso metadata-optimization \\
>
> screenshot-optimization onboarding-optimization rating-prompt-strategy retention-optimization
>
> /plugin marketplace add trailofbits/skills
>
> /plugin menu ← supply-chain-risk-auditor ve insecure-defaults seçilir

npx skills komutlarının --skill parametresinin birden fazla değer alma biçimi sürüme göre değişebilir; hata alınırsa her skill ayrı komutla kurulur.

## 18.9 Kaynaklar

- Supabase Agent Skills ve plugin: supabase.com/docs/guides/getting-started/ai-skills, supabase.com/docs/guides/ai-tools/plugins

- Expo skills: github.com/expo/skills

- Callstack: github.com/callstackincubator/agent-skills

- Superpowers: github.com/obra/superpowers

- Platform design: github.com/ehmo/platform-design-skills

- Maestro: github.com/tovimx/maestro-mobile-testing-skill

- ASO: github.com/Eronred/aso-skills

- Trail of Bits: github.com/trailofbits/skills

- Anthropic resmi marketplace: github.com/anthropics/claude-plugins-official

# 19. Açık Kararlar ve Sonraki Adımlar

## 19.1 Verilmesi gereken kararlar

| **Karar**                                  | **Seçenekler**                                                                                | **Ne zaman** |
|--------------------------------------------|-----------------------------------------------------------------------------------------------|--------------|
| Marka ve alan adı                          | Paramnet için TÜRKPATENT marka araştırması (9. ve 36. sınıf), alan adı ve mağaza adı kontrolü | Faz 0        |
| SMS sağlayıcı                              | Netgsm, İleti Merkezi, diğer                                                                  | Faz 1 başı   |
| Analitik aracı                             | PostHog (AB) / kendi olay tablosu                                                             | Faz 1        |
| Supabase bölgesi                           | KVKK görüşmesine göre                                                                         | Faz 0 sonu   |
| Yayın sırası                               | iOS ve Android birlikte / önce Android                                                        | Faz 3        |
| Premium fiyatı                             | Pilot sonrası test                                                                            | 1.1          |

## 19.2 Hemen sonraki adımlar

1.  Bu dokümanı gözden geçir, kapsam ve kuralları onayla.

2.  Faz 0 görüşme rehberini hazırla ve görüşmelere başla.

3.  Bölüm 18’deki çekirdek skill setini kur; paramnet-domain ve paramnet-mobile proje skill’lerini bu dokümandan oluştur.

4.  Faz 0 sonucuna göre Faz 1’i başlat: şema, RLS ve durum makinesi testleri.
