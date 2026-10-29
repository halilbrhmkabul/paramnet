> Bu dosya `docs/Paramnet_Urun_ve_Teknik_Tasarim.docx` dokümanının Markdown kopyasıdır ve projenin tek doğruluk kaynağıdır (single source of truth).
> Word dokümanı güncellenirse bu dosya da güncellenmelidir.

**ÜRÜN VE TEKNİK TASARIM DOKÜMANI**

**Paramnet**

Karşılıklı Borç ve Taksit Yönetimi Uygulaması

Fikir, çalışma şekli, kurgu, mimari, veri modeli, güvenlik ve yol haritası

**Uygulama adı:** Paramnet (marka ve alan adı uygunluk kontrolü yapılacak)

**Sürüm:** 0.3 — Taslak (uygulama adı: Paramnet)

**Tarih:** 11 Ekim 2026

**Hazırlayan:** Halil

**Platform:** iOS ve Android mobil uygulama + tek sayfalık web onay ekranı



# 1. Yönetici Özeti

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Ürün vaadi</strong></p>
<p>Verdiğin, aldığın ve taksitle ödeyeceğin borçları iki taraflı takip et. Borcu kaydet, ödeme planı oluştur, karşı tarafa gönder ve ödemeleri birlikte doğrula.</p></td>
</tr>
</tbody>
</table>

Uygulama, bireyler arasındaki borç ve taksit anlaşmalarını dijitalleştiren bir mobil uygulamadır. Kullanıcı uygulamayı tek başına kişisel borç defteri olarak kullanabilir. Karşı tarafı davet ettiğinde anlaşma iki tarafın da onayladığı, değişiklik geçmişi korunan ve ödemeleri karşılıklı doğrulanan ortak bir kayda dönüşür.

Pazar araştırması iki sonucu netleştirdi. Birincisi, banka hesabı ve kredi kartı birleştirme artık bankaların açık bankacılık üzerinden ücretsiz sunduğu bir özelliktir; bu alanda farklılaşmak mümkün değildir. İkincisi, tek taraflı borç defteri, elden taksit, ödeme takvimi ve WhatsApp hatırlatması Türkiye’deki birçok uygulamada zaten vardır. Doğrulanmış farklılaşma alanı, **anlaşmanın iki tarafça yönetilmesi**dir: onay, ortak takip, ödeme doğrulaması, değişiklik ve itiraz.

## 1.1 Temel kararlar

| **Konu**                | **Karar**                                                                                                                             |
|-------------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| Platform                | Mobil uygulama (iOS + Android). Davet edilen ve uygulaması olmayan kişi için tek sayfalık web onay ekranı.                            |
| Hedef kitle             | Bireyler. Esnaf ve veresiye defteri ilk sürümde kapsam dışıdır.                                                                       |
| Ana farklılaşma         | Karşılıklı onaylı borç anlaşması, ortak ödeme takibi ve mutabakat.                                                                    |
| İlk sürüm kapsamı       | Kişisel borç defteri, elden taksit, kısmi ödeme, takvim, hatırlatma, davet, karşılıklı onay, ödeme doğrulaması, değişiklik ve itiraz. |
| Kapsam dışı (ilk sürüm) | Gelir-gider, banka hesapları, kredi kartı, banka kredisi, faiz hesaplama, ekstre okuma, grup harcaması, AI asistan. Faz 4'te tasarımla birlikte görev görev eklenir (ADR-044; hesaplar ve gelir-gider: 5.11, ADR-053). |
| Para hareketi           | Uygulama para tutmaz, transfer başlatmaz. Yalnızca kayıt ve mutabakat sağlar.                                                         |
| Uzun vadeli vizyon      | Borç merkezli kişisel finans platformu. Diğer modüller kullanıcı verisine göre sırayla eklenir.                                       |
| Gelir modeli            | Temel özellikler ve davet akışı ücretsiz. Premium: raporlar, PDF çıktı, gelişmiş özellikler.                                          |

# 2. Problem ve Pazar

## 2.1 Problem

Türkiye’de bireyler arasında borç, elden taksit ve vadeli alışveriş çok yaygındır. Bu anlaşmalar bugün çoğunlukla şu yollarla takip edilir:

- WhatsApp mesajları, telefon notları veya hafıza

- Mağazanın verdiği kâğıt ödeme planı veya senet

- Tek taraflı tutulan Excel tabloları veya basit borç defteri uygulamaları

Bunun sonuçları: unutulan ödeme günleri, tarafların farklı hatırladığı kalan tutarlar, para isteme mahcubiyeti ve ilişkiyi geren tartışmalar. Tek taraflı kayıt bu sorunların yalnızca bir kısmını çözer; çünkü karşı taraf kayda itiraz edebilir ve kaydı görmez.

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
<td><p><strong>Doğrulanması gereken varsayım</strong></p>
<p>Rakiplerin hiçbirinde “anlaşma oluştur → karşı taraf onaylar → iki tarafta ortak takip → ödeme bildirimi → doğrulama → itiraz/yeniden anlaşma” akışının tamamı görülmedi. Bu, mağaza açıklamalarına dayalı bir tespittir; rakip uygulamalar bizzat kurulup test edilerek teyit edilmelidir.</p></td>
</tr>
</tbody>
</table>

# 3. Ürün Vizyonu ve Konumlandırma

## 3.1 Konumlandırma

Uygulama ne bir bütçe uygulaması ne de bir harcama bölüştürme uygulamasıdır. **Bireyler arası borç ve vadeli ödeme anlaşmalarının dijital mutabakat aracıdır.**

| **Biz neyiz**                                     | **Biz ne değiliz**                        |
|---------------------------------------------------|-------------------------------------------|
| İki tarafın onayladığı borç kaydı                 | Para transfer eden bir ödeme kuruluşu     |
| Elden taksit ve vadeli alışveriş takibi           | Banka hesabı / kart birleştirme aracı     |
| Ödeme hatırlatma ve doğrulama                     | Hukuken geçerli e-senet düzenleme hizmeti |
| Değişiklik ve itiraz geçmişi tutan kayıt          | Kredi veren veya faiz hesaplayan platform |
| Tek başına da kullanılabilen kişisel borç defteri | Esnaf veresiye / cari hesap yazılımı      |

## 3.2 Hedef kullanıcılar

| **Persona**                    | **Durum**                                       | **Uygulamadan beklentisi**                                                    |
|--------------------------------|-------------------------------------------------|-------------------------------------------------------------------------------|
| Borç veren arkadaş             | Arkadaşına 18.000 TL verdi, 3 ayda geri alacak. | Para istemek zorunda kalmadan hatırlatma; kalan tutarda anlaşmazlık olmaması. |
| Borç alan kişi                 | Akrabasından borç aldı, aylık ödüyor.           | Ne kadar ödediğini ve ne kadar kaldığını kanıtlayabilmek.                     |
| Elden taksitle alışveriş yapan | Mobilyacıdan peşinat + 5 taksitle aldı.         | Ödeme günlerini kaçırmamak, ödenen taksitleri işaretlemek.                    |
| Ev arkadaşı / aile içi borç    | Düzenli küçük borçlar ve geri ödemeler.         | Kimin kime ne kadar borçlu olduğunu net görmek.                               |

## 3.3 Değer önerisinin iki katmanı

- **Tek başına kullanım:** Kişisel borç defteri, taksit planı, takvim, hatırlatma. Karşı taraf uygulamayı kullanmasa da tam çalışır.

- **Karşılıklı kullanım:** Anlaşma paylaşılır, karşı taraf onaylar, iki tarafta aynı kayıt ve bakiye görünür, ödemeler karşılıklı doğrulanır.

Ürün tasarımının temel ilkesi: Uygulama tek başına yeterince faydalı olmalı; arkadaş davet edildiğinde fayda artmalı. Davet zorunlu bir adım değil, değer katan bir yükseltmedir.

## 3.4 İletişim tonu

Kişiler arası borç kaydı Türkiye’de güvensizlik veya ayıp olarak algılanabilir. Bu nedenle ürün dili “kontrol” yerine “kolaylık” üzerine kurulur:

| **Kaçınılacak ifade** | **Kullanılacak ifade**                          |
|-----------------------|-------------------------------------------------|
| Borcunu onayla        | Ödeme planımızı birlikte takip edelim           |
| Borç talebi           | Anlaşma paylaşımı                               |
| Ödemen gecikti        | Bugün ödeme günü (hatırlatma uygulamadan gelir) |
| İtiraz et             | Bir şey yanlış mı? Düzeltme öner                |

# 4. Temel Kavramlar (Alan Modeli)

Tüm ekip ve kod aynı terimleri kullanır. Kod tarafında İngilizce karşılıklar parantez içinde verilmiştir.

| **Kavram**                            | **Tanım**                                                                                                                         |
|---------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| Kullanıcı (profile)                   | Telefon numarasıyla doğrulanmış uygulama hesabı.                                                                                  |
| Kişi (contact)                        | Kullanıcının rehberindeki karşı taraf. Uygulamaya kayıtlı olabilir veya olmayabilir. Ad ve isteğe bağlı telefon numarası tutulur. |
| Anlaşma (agreement)                   | İki taraf arasındaki tek bir borç ilişkisi. Ana kayıttır.                                                                         |
| Rol (role)                            | Anlaşmadaki taraf: alacaklı (creditor) veya borçlu (debtor).                                                                      |
| Mod (mode)                            | Kişisel (personal): yalnızca oluşturan görür. Paylaşılan (shared): iki taraf da görür ve onaylar.                                 |
| Anlaşma versiyonu (agreement_version) | Anlaşma şartlarının değiştirilemez bir anlık görüntüsü. Her onay belirli bir versiyona verilir.                                   |
| Ödeme planı / Taksit (installment)    | Vadesi ve tutarı olan ödeme kalemi. Tek seferlik borç = tek taksitli plan.                                                        |
| Peşinat (down_payment)                | Anlaşma anında ödenen ve plandan düşülen tutar.                                                                                   |
| Ödeme (payment)                       | Gerçekleşen bir geri ödeme kaydı. Bildirilir, karşı tarafça doğrulanır.                                                           |
| Dağıtım (allocation)                  | Bir ödemenin hangi taksitlere ne kadar uygulandığı.                                                                               |
| Değişiklik talebi (amendment)         | Aktif anlaşmanın şartlarında önerilen değişiklik (erteleme, tutar, vade). Karşı taraf onaylarsa yeni versiyon olur.               |
| İtiraz (dispute)                      | Taraflardan birinin kayıt veya ödemeye itiraz ettiği durum.                                                                       |
| Davet (invite)                        | Anlaşmayı karşı tarafa ileten, süreli ve tek amaçlı link.                                                                         |
| ParamNet ID (paramnet_id)             | Kullanıcının rastgele, yeniden üretilebilir kimliği (PN-XXXXXX). Kayıtlı kullanıcıyı telefonsuz bulmak ve paylaşmak içindir (ADR-050). |
| Olay kaydı (agreement_event)          | Anlaşmada olan her şeyin değiştirilemez günlüğü. Denetim ve itiraz kanıtıdır.                                                     |

# 5. Uygulamanın Çalışma Şekli

Bu bölüm kullanıcının uygulamada yaptığı her işi uçtan uca anlatır.

## 5.1 İlk açılış ve kayıt

1.  Karşılama ekranı (01): tek cümlelik vaat, "Hesap oluştur" ve "Giriş yap". "Hesap oluştur" 3 kısa tanıtım ekranını (31, atlanabilir) açar.

2.  Telefon numarası girişi (+90, 02 "Kayıt ol"). SMS ile 6 haneli kod gönderilir.

3.  Kod doğrulanır, hesap oluşturulur. Kullanıcı 6 haneli PIN'i iki kez girerek belirler (ADR-046). Ad soyad (görünen ad) alınır.

4.  KVKK aydınlatma metni ve kullanım koşulları onayı.

5.  Bildirim izni istenir; gerekçe ekranda açıkça yazar: “Ödeme günlerini hatırlatabilmemiz için”.

6.  Telefon numarasına bekleyen davet varsa (başkası bu kullanıcıyla anlaşma paylaşmışsa) doğrudan Talepler ekranı açılır.

7.  Yoksa boş durum ekranı: “İlk kaydını ekle” butonu ve 3 hızlı şablon (Borç verdim, Borç aldım, Taksitle aldım).

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

- **Peşinat:** Ödenmiş bir ödeme olarak kaydedilir ve anlaşma oluşturulurken onaylı sayılır.

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

- Rehberden seçme (izin istenir, yalnızca seçilen kişinin adı ve numarası okunur; rehber sunucuya yüklenmez).

- Elle ad yazma; telefon numarası isteğe bağlı. Numara yoksa anlaşma yalnızca kişisel modda kalabilir.

- Satıcı gibi uygulamayı kullanmayacak taraflar için serbest metin karşı taraf (ör. “Yıldız Mobilya”).

## 5.3 Kişisel mod (tek taraflı kullanım)

Paylaşılmayan her anlaşma kişisel moddadır. Kullanıcı tüm işlemleri tek başına yapar: ödeme ekler, taksit erteler, düzenler, kapatır. Doğrulama gerekmez çünkü karşı taraf yoktur. Ekranda “Yalnızca sen görüyorsun” etiketi bulunur.

Kişisel moddaki bir anlaşma her an paylaşılabilir. Paylaşıldığında o anki şartlar ilk versiyon olarak karşı tarafa gönderilir. Paylaşımdan önce yapılan ödemeler “karşı tarafça henüz doğrulanmadı” olarak gösterilir ve onay sırasında karşı tarafa listelenir.

## 5.4 Paylaşım ve karşılıklı onay

Akış

1.  Oluşturan kullanıcı “Paylaş”a basar. Karşı tarafın telefon numarası zorunludur.

2.  Sunucu tek kullanımlık bir davet oluşturur: rastgele token, hedef telefon numarası, 7 gün geçerlilik.

3.  Uygulama paylaşım menüsünü açar; hazır mesaj + link WhatsApp, SMS veya başka kanalla gönderilir. (Uygulama kendisi SMS ile davet göndermez; maliyet ve spam riski nedeniyle.)

4.  Karşı taraf linke tıklar. Uygulama yüklüyse Universal/App Link ile doğrudan uygulamada açılır; değilse web onay sayfası açılır.

5.  Karşı taraf telefon numarasını SMS kodu ile doğrular. Numara, davetteki hedef numarayla eşleşmezse onay verilemez.

6.  Anlaşma detayları gösterilir: taraflar, roller, tutar, peşinat, ödeme planı, varsa daha önce bildirilmiş ödemeler.

7.  Karşı taraf üç seçenekten birini seçer: Onayla, Düzeltme öner, Reddet.

8.  Onaylanırsa anlaşma “aktif” olur. İki tarafa bildirim gider, kayıt iki tarafın ekranında aynı görünür.

Web onay sayfası

- OTP doğrulamasından önce yalnızca “\[Ad\] seninle bir ödeme planı paylaştı” bilgisi görünür; tutar ve detay gösterilmez.

- Doğrulamadan sonra anlaşma detayı ve karar butonları görünür.

- Karar verildikten sonra “Ödeme günlerinde hatırlatma almak için uygulamayı indir” çağrısı ve mağaza butonları gösterilir.

- Web’de onaylayan kişi daha sonra aynı numarayla uygulamaya kayıt olursa anlaşma otomatik olarak hesabına bağlanır.

- Web sayfası yalnızca bu işlemi yapar: onay, düzeltme önerisi, red. Hesap yönetimi veya başka işlem yoktur.

ParamNet ID ile paylaşım (ADR-050)

- Paylaş ekranında telefon numarası yerine karşı tarafın ParamNet ID'si girilebilir. Uygulama ID'yi arar ve yalnızca görünen adı ve baş harfleri gösterir; kullanıcı doğru kişi olduğunu teyit eder.

- Sunucu hedef profile bağlı bir davet oluşturur; link, token ve OTP yoktur. Davet 7 gün geçerlidir; geri çekme ve süre dolumu telefonla paylaşımdaki gibidir.

- Karşı tarafa push ve Bildirimler'de talep gider; kararı uygulama içinde verir (adım 6–8 aynı).

- Arama tam eşleşmedir ve kullanıcı başına saatte 20 ile sınırlıdır; ID ile paylaşım günde 10 ile sınırlıdır. "ID ile bulunabilirim" kapalı olan kullanıcı bulunamaz.

- Kullanıcı ID'sini Profil'den 30 günde bir yeniden üretebilir; eski ID hemen geçersiz olur ve tekrar kullanılmaz.

Düzeltme önerisi

Karşı taraf tutar, peşinat veya plan üzerinde değişiklik önerebilir. Öneri yeni bir versiyon taslağı oluşturur ve oluşturan kullanıcıya gider. Oluşturan kabul ederse anlaşma bu versiyonla aktif olur; karşı öneri yaparsa döngü devam eder. Her tur olay kaydına yazılır.

## 5.5 Ödeme kaydı ve doğrulama

| **Ödemeyi kaydeden**     | **Sonuç**                                                                                                            |
|--------------------------|----------------------------------------------------------------------------------------------------------------------|
| Alacaklı (“Ödeme aldım”) | Ödeme doğrudan onaylanır. Parayı alan taraf kabul ediyorsa doğrulamaya gerek yoktur. Borçluya bilgi bildirimi gider. |
| Borçlu (“Ödeme yaptım”)  | Ödeme “bildirildi” durumunda kalır. Alacaklıya bildirim gider: Onayla / Reddet. Onaylanınca bakiyeden düşer.         |
| Kişisel mod              | Kullanıcının kaydettiği ödeme doğrudan geçerlidir.                                                                   |

- Ödeme alanları: tutar, ödeme tarihi, yöntem (nakit, havale/EFT, kart, diğer), not, isteğe bağlı dekont görseli.

- Bekleyen ödemeler bakiyede ayrıca gösterilir: “Kalan 12.000 TL · 4.000 TL onay bekliyor”.

- Alacaklı 7 gün içinde yanıt vermezse hatırlatma gider. Otomatik onay yoktur.

- Reddedilen ödeme silinmez; “reddedildi” olarak geçmişte kalır. Borçlu düzeltip yeniden bildirebilir.

Ödemenin taksitlere dağıtımı

- Varsayılan: en eski ödenmemiş taksitten başlayarak sırayla (FIFO).

- Taksit tutarından az ödeme: taksit “kısmen ödendi” olur.

- Taksit tutarından fazla ödeme: artan kısım sonraki taksitlere dağıtılır.

- Toplam kalan borçtan fazla ödeme kaydedilemez.

- Kullanıcı isterse ödemeyi belirli bir taksite yönlendirebilir (gelişmiş seçenek).

## 5.6 Değişiklik talepleri (aktif anlaşmada)

Paylaşılan ve aktif bir anlaşmanın şartları tek taraflı değiştirilemez. Değişiklik bir talep olarak açılır.

| **Değişiklik türü**    | **Örnek**                                                                                |
|------------------------|------------------------------------------------------------------------------------------|
| Taksit erteleme        | 3\. taksit 10 Ocak yerine 10 Şubat                                                       |
| Plan yeniden düzenleme | Kalan 12.000 TL, 3 yerine 4 taksit                                                       |
| Tutar düzeltme         | Anlaşma tutarı yanlış girilmiş                                                           |
| Borç affı / indirim    | Alacaklı kalan 1.000 TL’den vazgeçiyor (yalnızca alacaklı önerebilir ve kendisi uygular) |

- Talep yeni versiyon taslağıdır; karşı taraf kabul ederse yürürlüğe girer, reddederse eski versiyon geçerli kalır.

- Aynı anda tek bir açık değişiklik talebi olabilir.

- Geçmiş ödemeler ve onaylanmış ödemeler değişiklikle silinmez; yeni plan kalan tutar üzerinden kurulur.

- Alacaklının lehine olmayan tek taraflı işlemler (borç affı, indirim) karşı taraf onayı gerektirmez; yalnızca bilgi verilir.

## 5.7 İtiraz

- Taraflardan biri anlaşmanın tamamına veya bir ödemeye itiraz edebilir; gerekçe yazmak zorunludur.

- İtirazlı anlaşmada hatırlatmalar durur, ekranda uyarı görünür.

- Çözüm yolları: itirazı açan geri çeker veya taraflar bir değişiklik talebinde uzlaşır.

- Uygulama hakem değildir; yalnızca kaydı ve geçmişi şeffaf tutar.

## 5.8 Kapanış ve iptal

- **Otomatik kapanış:** Onaylı ödemeler toplamı borca eşit olunca anlaşma “kapandı” olur, iki tarafa tebrik bildirimi gider.

- **İptal:** Kişisel modda kullanıcı istediği zaman iptal eder. Paylaşılan aktif anlaşmada iptal karşı taraf onayı gerektirir; onay bekleyen anlaşmayı oluşturan tek taraflı geri çekebilir.

- Kapanan ve iptal edilen anlaşmalar silinmez; arşivde görünür. Kullanıcı kendi görünümünden gizleyebilir.

## 5.9 Hatırlatmalar

| **Zaman**                         | **Kime**           | **Mesaj örneği**                                               |
|-----------------------------------|--------------------|----------------------------------------------------------------|
| Vadeden 7, 3 ya da 1 gün önce (kullanıcı tercihi, ADR-051) | Borçlu | 10 Kasım’da Yıldız Mobilya’ya 4.000 TL ödemen var. |
| Vade günü 10:00 (kullanıcı tercihi) | Borçlu ve alacaklı | Bugün ödeme günü: 4.000 TL (2/5. taksit).                    |
| Vadeden 1 gün sonra (ödenmemişse) | Borçlu             | Dünkü 4.000 TL’lik ödeme henüz kaydedilmedi. Ödediysen kaydet. |
| Vadeden 7 gün sonra               | Borçlu ve alacaklı | 2\. taksit 7 gündür açık görünüyor.                            |
| Bildirilen ödeme bekliyorsa       | Alacaklı           | Ahmet 6.000 TL ödeme bildirdi. Onaylıyor musun?                |

- Sessiz saatler: 22:00–09:00 arası bildirim gönderilmez (Europe/Istanbul).

- Kullanıcı vade öncesi hatırlatma zamanlarını Bildirimler ekranından seçer (7, 3, 1 gün önce, vade günü; varsayılan 3 gün önce ve vade günü). Anlaşma bazında kapatma sonraki sürümde.

- Hatırlatma alacaklı adına değil, uygulama adına yazılır; amaç para isteme mahcubiyetini kaldırmaktır.

- İtirazlı, iptal edilmiş veya kapanmış anlaşmalara hatırlatma gitmez.

## 5.10 Hızlı kayıt (sonraki küçük güncelleme)

Kullanıcı tek cümle yazar: “Ahmet’ten 12.000 TL aldım, 3 taksitte ödeyeceğim, ilk ödeme 25 Kasım”. Uygulama kişi, rol, tutar, taksit sayısı ve tarihi çıkarıp doldurulmuş bir form önerir; kullanıcı onaylamadan kayıt oluşmaz. İlk aşamada kural tabanlı ayrıştırıcı, sonra LLM destekli ayrıştırma. İlk sürümde bunun yerine son kullanılan kişiler, akıllı varsayılanlar ve hızlı şablonlar bulunur.

## 5.11 Hesaplar ve işlemler (kişisel kayıt, ADR-053)

Kullanıcı kendi banka hesaplarını, nakit cüzdanını ve birikimlerini elle kaydeder; gelir, gider ve hesaplar arası transfer girer. Banka bağlantısı yoktur, uygulama para tutmaz ve transfer başlatmaz: "Transfer" yalnızca kullanıcının kendi iki hesabı arasındaki bir kayıttır. Bu kayıtlar anlaşmalara, karşı tarafa ya da borç bakiyelerine yansımaz.

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

- **Tekrarlayan işlem:** gelir ya da gider; ad, tutar, kategori, hesap, sıklık (haftalık, aylık, yıllık), ilk tarih ve "Her seferinde onay iste". Tarihler ilk tarihten sayılır; ay sonu kısalırsa ayın son günü kullanılır (31 Ocak → 28 Şubat → 31 Mart).
	- Onay isteyen kuralın günü gelen tarihi "Onay bekleyenler"de görünür: Onayla gerçekleşen kaydı yazar, Atla yazmaz. Onay istemeyen kural günü gelince kendiliğinden kaydedilir (saatlik iş).
	- Kural oluşturulmadan en fazla 31 gün önceki tarihler sayılır; durdurulup sürdürülen kuralda durdurma süresindeki tarihler sayılmaz. Arşivlenmiş hesaba kayıt yazılmaz.
	- Kural silinince yazılmış kayıtlar kalır. Kullanıcı başına en fazla 100 kural.
- **Bütçe:** gider kategorisi başına aylık sınır. Harcanan, o ayın silinmemiş gider kayıtlarıdır. Sınırın %80'inde "sınıra yakın", aşınca "aşıldı" uyarısı; özet kartında kalan gün ve kalan günlük pay.
- **Aylık rapor:** seçilen ayın geliri, gideri ve neti; son 6 ayın gelir-gider sütunları; gider kategorisi dağılımı; borç ve alacak dengesi (anlaşmalardan). Transfer, düzeltme ve borç kayıtları gelir-gidere dahil değildir. Varsayılan ay son tamamlanan aydır.

## 5.13 Kredi kartları (ADR-055)

- **Kart:** banka, isteğe bağlı kart adı, son 4 hane, renk, limit, güncel borç (son ekstreye dahil sayılır), hesap kesim günü (1–28), son ödeme (kesimden kaç gün sonra) ve asgari ödeme oranı. Tam kart numarası, CVV ya da şifre istenmez. Limit 50.000 TL'ye kadar %20, üstünde %40 önerilir. Kullanıcı başına en fazla 20 açık kart.
- **Kart harcaması** bir gider kaydıdır ama bir hesaba değil karta yazılır: Toplam Nakit'i değiştirmez, kart borcunu artırır, gider olarak bir kez sayılır. Taksitli harcama (2–36) eşit parçalara bölünür; kalan kuruş ilk taksittedir ve her taksit kendi ayının ekstresine girer. **İade** kartta gelir kaydıdır ve borcu azaltır.
- **Kart ödemesi** bir hesaptan karta transferdir: hesabın bakiyesi düşer, kart borcu azalır, gider sayılmaz.
- **Ekstre türetilir:** son kesimde kartta biriken (açılış borcu + o güne kadar faturalanan taksitler ve harcamalar − o güne kadar yapılan ödeme ve iadeler, sıfırın altına inmez). Kalan ekstre borcu = ekstre − kesimden sonraki ödemeler. Asgari = ekstre × oran (yukarı yuvarlanır). Son ödeme = kesim + gün. Dönem içi harcama = son kesimden sonraki kesime kadar faturalanacak taksitler. Kullanılabilir limit = limit − (açılış borcu + tüm harcamalar − ödeme ve iadeler).
- **Faiz hesaplanmaz** (simülasyon F4-07). Uygulama banka ile konuşmaz; ödeme bir kayıttır.

## 5.14 Banka kredileri (ADR-056)

- Kullanıcının kendi banka kredisi: banka, kredi türü, çekilen tutar, aylık faiz (vergiler dahil, yüzde ikinci haneye kadar), vade (1–120 ay), ilk taksit tarihi, isteğe bağlı bankanın taksiti ve ödeme hesabı.
- **Ödeme planı türetilir:** eşit taksit P·r / (1 − (1 + r)^−n), ondalıklı sayı kullanılmadan kuruşta tam hesaplanır; her ay faiz kalan anapara × r (yarım yukarı yuvarlanır), taksitin kalanı anaparadır, son taksit kalanı kapatır. Bankanın taksiti girilirse o kullanılır.
- **Faiz yalnızca planı göstermek için** hesaplanır (ADR-045); kişiler arası anlaşmalara, Toplam Nakit'e ya da karşı tarafa yansımaz.
- **Taksit kaydı** bir hesaptan krediye transferdir: hesap bakiyesi düşer, gider sayılmaz; sıradaki taksitin tutarıyla yazılır, düzenlenmez, yalnızca silinir. Ödenen taksit sayısı bu kayıtlardan gelir.

# 6. Ekranlar ve Bilgi Mimarisi

## 6.1 Navigasyon

Alt sekme çubuğu 4 sekme + ortada “+” butonundan oluşur.

| **Sekme**       | **İçerik**                                                                                                                             |
|-----------------|----------------------------------------------------------------------------------------------------------------------------------------|
| Ana Sayfa       | Özet: toplam alacak, toplam borç, bu ay ödenecekler, bu ay tahsil edilecekler, gecikenler, yaklaşan 5 vade, onay bekleyen işler bandı. |
| Kişiler         | Kişi bazında net bakiye (bana borçlu / benim borçlu olduğum). Kişiye dokununca o kişiyle tüm anlaşmalar.                               |
| \+ (Yeni kayıt) | Kayıt türü seçimi ve form (modal).                                                                                                     |
| Takvim          | Aylık takvim: vadeler, beklenen tahsilatlar, gecikmeler. Gün seçince o günün listesi.                                                  |
| Talepler        | Gelen paylaşımlar, onay bekleyen ödemeler, değişiklik talepleri, itirazlar. Rozet ile sayı gösterilir.                                 |

Profil ve ayarlar Ana Sayfa’nın sağ üstündeki avatar ile açılır.

## 6.2 Ekran listesi

| **\#** | **Ekran**                     | **Ana bileşenler**                                                                    |
|--------|-------------------------------|---------------------------------------------------------------------------------------|
| S01    | Karşılama                     | Vaat, tanıtım kartları, Başla                                                         |
| S02    | Telefon girişi                | Ülke kodu, numara, KVKK linki                                                         |
| S03    | OTP doğrulama                 | 6 hane, yeniden gönder (60 sn), hata durumları                                        |
| S04    | Profil kurulumu               | Görünen ad, bildirim izni                                                             |
| S05    | Ana Sayfa                     | Özet kartları, yaklaşan vadeler, bekleyen işler                                       |
| S06    | Kişiler                       | Arama, kişi listesi, net bakiye                                                       |
| S07    | Kişi detay                    | Net bakiye, anlaşmalar listesi, yeni kayıt                                            |
| S08    | Kayıt türü seçimi             | 4 seçenek kartı                                                                       |
| S09    | Kayıt formu                   | Dinamik alanlar, kişi seçici, tutar klavyesi                                          |
| S10    | Plan önizleme / düzenleme     | Taksit listesi, satır düzenleme, toplam kontrolü                                      |
| S11    | Anlaşma detay                 | Durum etiketi, bakiye, ilerleme çubuğu, taksitler, ödemeler, geçmiş, aksiyonlar       |
| S12    | Ödeme ekle                    | Tutar, tarih, yöntem, dekont, not, dağıtım önizlemesi                                 |
| S13    | Paylaş                        | Numara kontrolü, mesaj önizleme, paylaşım menüsü                                      |
| S14    | Gelen paylaşım (uygulama içi) | Anlaşma özeti, Onayla / Düzeltme öner / Reddet                                        |
| S15    | Değişiklik talebi             | Mevcut ve önerilen plan karşılaştırması                                               |
| S16    | İtiraz                        | Gerekçe, ilgili ödeme seçimi                                                          |
| S17    | Anlaşma geçmişi               | Zaman çizelgesi (olay kaydı)                                                          |
| S18    | Takvim                        | Ay görünümü, gün listesi                                                              |
| S19    | Talepler                      | Sekmeli liste: Paylaşımlar, Ödemeler, Değişiklikler                                   |
| S20    | Profil / Ayarlar              | Fotoğraf, ad, @kullanıcı adı, ParamNet ID (kopyala, paylaş), ID ile bulunabilirlik ve yeni ID, bildirim tercihleri, veri dışa aktarma, yasal metinler, hesabı sil (ADR-050, 051) |
| W01    | Web onay – giriş              | Kısa bilgi, numara doğrulama                                                          |
| W02    | Web onay – OTP                | Kod girişi                                                                            |
| W03    | Web onay – detay ve karar     | Anlaşma detayı, 3 aksiyon                                                             |
| W04    | Web onay – sonuç              | Teşekkür, uygulama indirme çağrısı                                                    |

## 6.3 Anlaşma detay ekranı yapısı

- Üst kart: karşı taraf adı, rol (“Sana borçlu” / “Borçlusun”), kalan tutar, toplam, ilerleme çubuğu, durum etiketi (Kişisel, Onay bekliyor, Aktif, İtirazlı, Kapandı).

- Birincil aksiyon (duruma göre tek buton): Ödeme ekle / Paylaş / Onayla.

- Taksitler listesi: vade, tutar, ödenen, durum.

- Ödemeler listesi: tarih, tutar, yöntem, doğrulama durumu.

- Geçmiş: tüm olaylar zaman sırasıyla.

- Menü: Düzenle / Değişiklik öner, İtiraz et, İptal et, PDF çıktı (premium).

## 6.4 Tasarım ilkeleri

- Tek ekranda tek birincil aksiyon.

- Tutarlar her zaman Türk biçiminde: 12.000,00 TL. Tutar girişi özel sayısal klavye ile.

- Renk anlamı tutarlı: alacak yeşil tonu, borç turuncu tonu, gecikme kırmızı, bekleyen gri. Renk tek başına anlam taşımaz, etiketle desteklenir.

- Açık ve koyu tema, dinamik yazı boyutu, ekran okuyucu etiketleri.

- Her boş durum ekranında ne yapılacağını anlatan bir cümle ve buton.

# 7. İş Kuralları

Aşağıdaki kurallar sunucu tarafında zorunlu kılınır; istemci yalnızca kullanıcıya önceden gösterir.

| **Kod** | **Kural**                                                                                                                                          |
|---------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| BR-01   | Tüm tutarlar kuruş cinsinden tam sayı (bigint) saklanır. Ondalıklı sayı tipi kullanılmaz.                                                          |
| BR-02   | İlk sürümde para birimi TRY’dir. Şema çoklu para birimini destekler; bir anlaşmanın para birimi sonradan değişmez.                                 |
| BR-03   | Taksit tutarları toplamı + peşinat, anlaşma tutarına her zaman eşittir.                                                                            |
| BR-04   | Kalan borç = anlaşma tutarı − onaylı ödemeler − onaylı indirimler. Hiçbir zaman negatif olamaz.                                                    |
| BR-05   | Paylaşılan ve aktif anlaşmanın şartları yalnızca karşı tarafın onayladığı bir değişiklik talebiyle değişir.                                        |
| BR-06   | Her onay belirli bir versiyona ve o versiyonun içerik hash’ine bağlanır. Onay ekranında gösterilen versiyon ile onaylanan versiyon aynı olmalıdır. |
| BR-07   | Bir anlaşmada aynı anda en fazla bir açık değişiklik talebi olabilir.                                                                              |
| BR-08   | Borçlunun bildirdiği ödeme, alacaklı onaylamadan bakiyeden düşmez. Alacaklının kaydettiği ödeme doğrudan onaylıdır.                                |
| BR-09   | Her ödeme işlemi idempotency anahtarı taşır; aynı anahtarla gelen ikinci istek yeni kayıt oluşturmaz, ilk sonucu döner.                            |
| BR-10   | Onaylanmış ödeme silinmez; yalnızca karşı taraf onayıyla “iptal edildi” durumuna geçer.                                                            |
| BR-11   | Davet linki yalnızca davette belirtilen telefon numarasını doğrulayan kişi tarafından kullanılabilir. ID ile verilen davette karar yalnızca hedef profil tarafından uygulama içinden verilir. |
| BR-12   | Kullanıcı kendisiyle anlaşma paylaşamaz (oluşturanın numarası = hedef numara ya da hedef ID kendi ID'si ise reddedilir).                           |
| BR-13   | Olay kaydı yalnızca eklenir; güncellenemez ve silinemez (hesap silme hariç, bkz. KVKK).                                                            |
| BR-14   | Kapanmış, iptal edilmiş veya itirazlı anlaşmaya yeni ödeme ve değişiklik eklenemez (itiraz çözülene kadar).                                        |
| BR-15   | Uygulama faiz hesaplamaz ve faiz alanı sunmaz (ilk sürüm).                                                                                         |
| BR-16   | Tarihler Europe/Istanbul saat dilimine göre “gün” olarak (date) saklanır; olay zamanları timestamptz.                                              |
| BR-17   | ParamNet ID araması yalnızca görünen adı ve baş harfleri döner; telefon ve profil kimliği dönmez. Kapalı, silinmiş ve olmayan ID aynı yanıtı alır. |
| BR-18   | ParamNet ID 30 günde en fazla bir kez yeniden üretilir; kullanılmış bir ID hiçbir hesaba yeniden verilmez.                                         |

# 8. Durum Makineleri

Uygulamanın doğruluğu durum makinelerine dayanır. Durum geçişleri yalnızca sunucu fonksiyonlarında yapılır; her geçiş tek bir veritabanı işlemi (transaction) içinde gerçekleşir ve olay kaydına yazılır.

## 8.1 Anlaşma durumları

| **Durum**         | **Anlamı**                                                            |
|-------------------|-----------------------------------------------------------------------|
| personal          | Kişisel mod. Yalnızca oluşturan görür ve yönetir.                     |
| pending           | Paylaşıldı, karşı tarafın yanıtı bekleniyor.                          |
| countered         | Karşı taraf düzeltme önerdi, oluşturanın yanıtı bekleniyor.           |
| active            | İki taraf onayladı. Ödemeler ve hatırlatmalar işler.                  |
| amendment_pending | Aktif anlaşmada açık bir değişiklik talebi var. Eski şartlar geçerli. |
| disputed          | İtiraz açık. Hatırlatmalar durur.                                     |
| settled           | Kalan borç sıfır. Son durum.                                          |
| cancelled         | İptal edildi. Son durum.                                              |
| rejected          | Karşı taraf reddetti. Oluşturan isterse kişisel moda döndürebilir.    |

## 8.2 Anlaşma geçiş tablosu

| **Mevcut**        | **Olay**                        | **Kim**              | **Yeni**                       | **Koşul / Etki**                                           |
|-------------------|---------------------------------|----------------------|--------------------------------|------------------------------------------------------------|
| —                 | create                          | Oluşturan            | personal                       | Versiyon 1 oluşur.                                         |
| personal          | share                           | Oluşturan            | pending                        | Telefon numarası ya da ParamNet ID zorunlu. Davet oluşur.  |
| personal          | record_payment / edit / cancel  | Oluşturan            | personal / settled / cancelled | Doğrulama gerekmez.                                        |
| pending           | accept                          | Karşı taraf          | active                         | Versiyon hash eşleşmeli. Karşı taraf profile bağlanır.     |
| pending           | counter                         | Karşı taraf          | countered                      | Yeni versiyon taslağı.                                     |
| pending           | reject                          | Karşı taraf          | rejected                       | Gerekçe isteğe bağlı.                                      |
| pending           | withdraw                        | Oluşturan            | personal                       | Davet geçersiz olur.                                       |
| pending           | invite_expired                  | Sistem               | personal                       | 7 gün dolunca. Oluşturan yeniden paylaşabilir.             |
| countered         | accept_counter                  | Oluşturan            | active                         | Karşı önerideki versiyon yürürlüğe girer.                  |
| countered         | counter                         | Oluşturan            | pending                        | Yeni versiyonla tekrar karşı tarafa gider.                 |
| countered         | withdraw                        | Oluşturan            | personal                       |                                                            |
| rejected          | make_personal                   | Oluşturan            | personal                       |                                                            |
| active            | propose_amendment               | Herhangi bir taraf   | amendment_pending              | Tek açık talep.                                            |
| amendment_pending | accept_amendment                | Diğer taraf          | active                         | Yeni versiyon yürürlüğe girer, taksitler yeniden üretilir. |
| amendment_pending | reject / withdraw               | Diğer taraf / Öneren | active                         | Eski versiyon geçerli.                                     |
| active            | open_dispute                    | Herhangi bir taraf   | disputed                       | Gerekçe zorunlu.                                           |
| disputed          | resolve_dispute                 | İtirazı açan         | active                         | Veya değişiklik kabulüyle.                                 |
| active            | payment_confirmed               | Sistem               | settled                        | Kalan borç 0 ise.                                          |
| active            | request_cancel → confirm_cancel | İki taraf            | cancelled                      | Karşılıklı onay.                                           |
| active            | forgive_remaining               | Alacaklı             | settled                        | Kalan borç indirim olarak kapatılır.                       |

## 8.3 Ödeme durumları

| **Mevcut** | **Olay**                           | **Kim**          | **Yeni**  |
|------------|------------------------------------|------------------|-----------|
| —          | record (alacaklı veya kişisel mod) | Alacaklı / Sahip | confirmed |
| —          | report (borçlu)                    | Borçlu           | reported  |
| reported   | confirm                            | Alacaklı         | confirmed |
| reported   | reject                             | Alacaklı         | rejected  |
| reported   | withdraw                           | Borçlu           | withdrawn |
| confirmed  | void (karşılıklı onayla)           | İki taraf        | voided    |

## 8.4 Taksit durumları

Taksit durumu saklanmaz, her sorguda hesaplanır (türetilmiş durum). Böylece tutarsızlık oluşmaz.

| **Durum** | **Hesaplama**                                             |
|-----------|-----------------------------------------------------------|
| upcoming  | paid \< amount ve due_date \> bugün                       |
| due_today | paid \< amount ve due_date = bugün                        |
| overdue   | paid \< amount ve due_date \< bugün                       |
| partial   | 0 \< paid \< amount (yukarıdakilerle birlikte gösterilir) |
| paid      | paid = amount                                             |

## 8.5 Davet durumları

| **Durum** | **Anlamı**                                        |
|-----------|---------------------------------------------------|
| active    | Geçerli, kullanılabilir.                          |
| consumed  | Karar verildi (onay, düzeltme veya red).          |
| revoked   | Oluşturan geri çekti veya yeni davet oluşturuldu. |
| expired   | Süre doldu.                                       |
| locked    | Çok fazla başarısız OTP denemesi.                 |

# 9. Teknik Mimari

## 9.1 Teknoloji seçimleri

| **Katman**       | **Seçim**                                                                               | **Gerekçe**                                                            |
|------------------|-----------------------------------------------------------------------------------------|------------------------------------------------------------------------|
| Mobil            | React Native + Expo (güncel SDK), TypeScript, Expo Router                               | Tek kod tabanı ile iOS ve Android; EAS Build/Update ile hızlı yayın.   |
| Durum yönetimi   | TanStack Query (sunucu durumu), Zustand (yerel UI durumu)                               | Sunucu verisi tek kaynaktan; önbellek ve yeniden deneme hazır.         |
| Formlar          | react-hook-form + zod                                                                   | Aynı zod şemaları web onay sayfasında da kullanılır.                   |
| Backend          | Supabase: PostgreSQL, Auth, RLS, RPC (plpgsql), Edge Functions, Storage, pg_cron        | İş kuralları veritabanında; transaction ve kilitleme garantisi.        |
| SMS / OTP        | Supabase Phone Auth + Send SMS Hook ile yerli SMS sağlayıcı (ör. Netgsm, İleti Merkezi) | Türkiye’de teslim oranı ve maliyet. Sağlayıcı değiştirilebilir katman. |
| Bildirim         | Expo Push Notifications (APNs/FCM)                                                      | Tek API; token yönetimi basit.                                         |
| Web onay sayfası | Next.js (veya Astro) – tek rota, sunucu tarafı render                                   | Hafif, hızlı açılış; Universal Link dosyalarını da sunar.              |
| Derin bağlantı   | iOS Universal Links, Android App Links (apple-app-site-association, assetlinks.json)    | Uygulama yüklüyse link doğrudan uygulamayı açar.                       |
| Bot koruması     | Cloudflare Turnstile (web onay sayfası)                                                 | SMS pumping ve otomasyon engeli.                                       |
| Hata izleme      | Sentry (mobil + web + edge)                                                             | Kırılma ve hata görünürlüğü.                                           |
| Ürün analitiği   | PostHog (AB bölgesi) veya kendi olay tablosu                                            | Huni ve kohort analizi. KVKK için kişisel veri gönderilmez.            |
| CI/CD            | GitHub Actions + EAS Build + Supabase CLI migration                                     | Her PR’da test, tag ile yayın.                                         |

## 9.2 Bileşen yapısı

> ┌──────────────────────┐ ┌──────────────────────────┐
>
> │ Mobil Uygulama │ │ Web Onay Sayfası │
>
> │ (Expo / RN) │ │ (Next.js, tek rota) │
>
> └─────────┬────────────┘ └────────────┬─────────────┘
>
> │ HTTPS (JWT) │ HTTPS (davet token + OTP)
>
> ▼ ▼
>
> ┌──────────────────────────────────────────────────────────┐
>
> │ Supabase │
>
> │ ├─ Auth (telefon OTP, JWT) │
>
> │ ├─ PostgREST → yalnızca okuma görünümleri (RLS) │
>
> │ ├─ RPC fonksiyonları → tüm yazma işlemleri │
>
> │ ├─ Edge Functions → davet, web onay, push, SMS hook │
>
> │ ├─ pg_cron → hatırlatma üretimi, davet süre sonu │
>
> │ └─ Storage → dekont görselleri (özel bucket) │
>
> └──────────────┬──────────────────────────┬────────────────┘
>
> ▼ ▼
>
> SMS sağlayıcı (OTP) Expo Push (APNs/FCM)

## 9.3 Mimari ilkeler

1.  **Sunucu otoritesi:** İstemci çekirdek tablolara doğrudan yazamaz. RLS ile insert/update/delete kapalıdır. Tüm yazmalar security definer RPC fonksiyonlarıyla yapılır; fonksiyon önce yetkiyi, sonra durum geçişinin geçerliliğini kontrol eder.

2.  **Tek transaction:** Her durum geçişi tek transaction’dır: satır kilidi (SELECT ... FOR UPDATE), kontrol, güncelleme, olay kaydı, bildirim kuyruğu.

3.  **İyimser eşzamanlılık:** Anlaşmada row_version sütunu bulunur. İstemci gördüğü versiyonu gönderir; uyuşmazsa işlem 409 conflict ile reddedilir ve istemci güncel veriyi çeker.

4.  **Idempotency:** Ödeme ve karar işlemleri istemcide üretilen UUID anahtar taşır; UNIQUE kısıt ile tekrar işlenmez.

5.  **Değiştirilemez geçmiş:** Versiyonlar ve olay kaydı yalnızca eklenir. Bakiye, onaylı ödemelerden türetilir; ayrıca önbelleğe alınmış bir outstanding_minor sütunu aynı transaction’da güncellenir ve periyodik tutarlılık kontrolüyle doğrulanır.

6.  **Bildirimler asenkron:** Transaction içinde notification_outbox tablosuna yazılır; edge function kuyruktan okuyup gönderir (outbox deseni). Bildirim hatası iş işlemini geri almaz.

7.  **Çevrimiçi yazma:** İlk sürümde yazma işlemleri bağlantı ister. Çevrimdışıyken veriler önbellekten okunur, yazma butonları açıklamalı olarak devre dışı kalır.

## 9.4 Mobil uygulama klasör yapısı

> app/
>
> (auth)/welcome.tsx, phone.tsx, otp.tsx, profile.tsx
>
> (tabs)/index.tsx, contacts.tsx, calendar.tsx, requests.tsx
>
> agreement/\[id\]/index.tsx, payment.tsx, share.tsx, amend.tsx, history.tsx
>
> new/index.tsx, form.tsx, plan.tsx
>
> invite/\[token\].tsx ← derin bağlantı girişi
>
> src/
>
> domain/ ← saf TS: plan üretimi, dağıtım, para biçimlendirme, zod şemaları
>
> api/ ← RPC çağrıları, query key’leri, hook’lar
>
> components/ ← tasarım sistemi bileşenleri
>
> features/ ← agreement, payment, invite, reminders
>
> lib/ ← supabase istemcisi, push, sentry, analytics
>
> supabase/
>
> migrations/ ← şema, RLS, fonksiyonlar
>
> functions/ ← edge functions
>
> tests/ ← pgTAP testleri
>
> web-confirm/ ← Next.js onay sayfası
>
> packages/shared/ ← ortak zod şemaları ve domain mantığı

domain/ katmanı saf TypeScript’tir ve hem mobilde hem web onay sayfasında kullanılır. Plan üretimi ve ödeme dağıtımı aynı algoritmayla hem istemcide (önizleme) hem veritabanında (kesin sonuç) çalışır; iki uygulamanın aynı sonucu verdiği testlerle doğrulanır.

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
| paramnet_id       | text UNIQUE      | PN-XXXXXX, rastgele (ADR-050) |
| paramnet_id_changed_at | timestamptz | Son yeniden üretim; 30 gün sınırı |
| id_discoverable   | boolean          | ID ile bulunabilir; varsayılan true |
| locale / timezone | text             | tr-TR / Europe/Istanbul  |
| deleted_at        | timestamptz null | Hesap silme işareti      |

contacts

| **Sütun**         | **Tip**                | **Açıklama**                         |
|-------------------|------------------------|--------------------------------------|
| id                | uuid PK                |                                      |
| owner_id          | uuid FK profiles       | Rehber sahibi                        |
| display_name      | text                   | Sahibin verdiği ad                   |
| phone_e164        | text null              | UNIQUE(owner_id, phone_e164)         |
| linked_profile_id | uuid null              | Numara kayıtlı bir kullanıcıya aitse |
| kind              | enum: person, merchant | Satıcı serbest metin taraf           |

agreements

| **Sütun**                 | **Tip**                          | **Açıklama**                     |
|---------------------------|----------------------------------|----------------------------------|
| id                        | uuid PK                          |                                  |
| creator_id                | uuid FK profiles                 | Oluşturan                        |
| creator_role              | enum: creditor, debtor           | Oluşturanın rolü                 |
| counterparty_contact_id   | uuid FK contacts                 | Oluşturanın gözünden karşı taraf |
| counterparty_profile_id   | uuid null                        | Onaylayınca dolar                |
| kind                      | enum: loan, installment_purchase |                                  |
| title / description       | text                             | ör. “Mobilya”                    |
| currency                  | char(3)                          | TRY                              |
| principal_minor           | bigint                           | Toplam tutar (kuruş)             |
| outstanding_minor         | bigint                           | Önbelleğe alınmış kalan          |
| status                    | enum (bkz. 8.1)                  |                                  |
| active_version            | int                              | Yürürlükteki versiyon            |
| pending_version           | int null                         | Onay bekleyen versiyon           |
| row_version               | int                              | İyimser kilit                    |
| settled_at / cancelled_at | timestamptz null                 |                                  |

agreement_versions

| **Sütun**              | **Tip**                                               | **Açıklama**                                                           |
|------------------------|-------------------------------------------------------|------------------------------------------------------------------------|
| agreement_id + version | PK                                                    |                                                                        |
| terms                  | jsonb                                                 | principal, down_payment, plan\[\] {seq, due_date, amount_minor}, notes |
| terms_hash             | text                                                  | terms’in kanonik JSON’unun SHA-256’sı                                  |
| proposed_by            | uuid                                                  |                                                                        |
| reason                 | text null                                             | Değişiklik gerekçesi                                                   |
| status                 | enum: draft, proposed, accepted, rejected, superseded |                                                                        |

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
| status                   | enum (bkz. 8.3)                          |                            |
| reported_by / decided_by | uuid                                     |                            |
| idempotency_key          | uuid UNIQUE                              |                            |
| attachment_path          | text null                                | Storage yolu               |
| allocations              | payment_id, installment_id, amount_minor | Ayrı tablo                 |

invites

| **Sütun**             | **Tip**          | **Açıklama**                        |
|-----------------------|------------------|-------------------------------------|
| id                    | uuid PK          |                                     |
| agreement_id, version | FK               | Paylaşılan versiyon                 |
| token_hash            | bytea UNIQUE     | SHA-256(token); düz token saklanmaz |
| target_phone_e164     | text null        | Yalnızca bu numara onaylayabilir    |
| target_profile_id     | uuid null        | ID ile paylaşımda hedef profil; token ve OTP yok. İkisinden tam biri dolu (CHECK). |
| status                | enum (bkz. 8.5)  |                                     |
| expires_at            | timestamptz      | Oluşturma + 7 gün                   |
| otp_attempts          | int              | Üst sınır 5                         |
| consumed_at           | timestamptz null |                                     |

agreement_events (olay kaydı)

| **Sütun**            | **Tip**                | **Açıklama**                                            |
|----------------------|------------------------|---------------------------------------------------------|
| id                   | bigint identity        |                                                         |
| agreement_id         | uuid                   |                                                         |
| actor_id             | uuid null              | Web’den onayda null olabilir                            |
| actor_phone_e164     | text                   | Doğrulanmış numara                                      |
| channel              | enum: app, web, system |                                                         |
| type                 | text                   | created, shared, accepted, countered, payment_reported… |
| version              | int                    | İlgili versiyon                                         |
| payload              | jsonb                  | Olaya özgü veri                                         |
| ip_hash / user_agent | text                   | Kanıt amaçlı, kısaltılmış                               |

Diğer tablolar

- reminders: agreement_id, installment_id, user_id, fire_at, kind, status (scheduled, sent, cancelled).

- notification_outbox: user_id, template, payload, status, attempts, next_attempt_at.

- push_tokens: user_id, expo_token, platform, last_seen_at.

- notifications (bildirim kutusu, ADR-051): user_id, template, payload, agreement_id null, category (approval, reminder, completed, info), created_at, read_at null. Outbox'a yazılan her bildirim buraya da yazılır; 90 gün saklanır.

- consents: user_id, document (kvkk, terms), version, accepted_at.

- retired_paramnet_ids: paramnet_id (PK), retired_at. Kullanılmış ID'ler yeniden verilmez.

- accounts (ADR-053): owner_id, kind (bank, cash, savings, other), name, bank_name null, opening_balance_minor bigint (eksi olabilir), include_in_total, archived_at null, idempotency_key, row_version, updated_at.

- transactions (ADR-053): owner_id, kind (expense, income, transfer, adjustment), account_id, to_account_id null (yalnızca transfer), amount_minor bigint (yalnızca düzeltmede işaretli), category null, title null, note null, occurred_on date, idempotency_key, deleted_at null, row_version, updated_at. Bakiye saklanmaz.

- transaction_events (yalnızca ekleme): transaction_id, owner_id, type (created, updated, deleted, restored), changes jsonb ({alan: [eski, yeni]}).

- recurring_rules (ADR-054): owner_id, kind (expense, income), name, amount_minor, category, account_id, frequency (weekly, monthly, yearly), start_on, confirm_each, tracking_from, paused_at null, idempotency_key, row_version.

- recurring_occurrences: rule_id + occurrence_on (PK), status (posted, skipped), transaction_id null.

- budgets: owner_id + category (PK, gider kategorisi), limit_minor.

- cards (ADR-055): owner_id, bank_name, card_name null, last4, color, limit_minor, opening_debt_minor, statement_day (1–28), due_offset_days, min_payment_rate, archived_at null, idempotency_key, row_version. transactions'a card_id, to_card_id ve installments eklendi; kart harcamasında account_id boştur.

- loans (ADR-056): owner_id, bank_name, loan_type, principal_minor, monthly_rate_bps (339 = %3,39), term_months, first_due_on, installment_minor, payment_account_id null, archived_at null. transactions.to_loan_id taksit kaydını krediye bağlar.

- Arama, paylaşım ve kullanıcı adı kontrolü sayaçları mevcut `rate_limits` tablosundadır (`pnid:find:`, `pnid:share:`, `username:check:` + kullanıcı).

## 10.2 Satır düzeyi güvenlik (RLS)

- Okuma: kullanıcı creator_id veya counterparty_profile_id ise anlaşmayı, versiyonlarını, taksitlerini, ödemelerini ve olaylarını görebilir.

- Kişisel moddaki anlaşmayı yalnızca oluşturan görür.

- contacts yalnızca sahibine görünür. Karşı tarafa sizin onu rehberde hangi adla kaydettiğiniz gösterilmez; karşı taraf kendi display_name’ini görür.

- Yazma: tüm tablolarda istemciye kapalı. Yalnızca RPC fonksiyonları yazar.

- invites istemciye hiç açılmaz; yalnızca edge function servis rolüyle erişir.

## 10.3 RPC fonksiyonları

| **Fonksiyon**                                                       | **Görev**                                                                   |
|---------------------------------------------------------------------|-----------------------------------------------------------------------------|
| create_agreement(input, idem_key)                                   | Anlaşma + v1 + taksitler + peşinat ödemesi                                  |
| update_personal_agreement(id, terms, row_version)                   | Kişisel modda düzenleme (yeni versiyon)                                     |
| share_agreement(id, phone, row_version)                             | pending’e geçirir, davet token’ı üretir, düz token’ı yalnızca bir kez döner |
| share_agreement_by_id(id, paramnet_id, row_version)                 | ID ile pending'e geçirir; hedef profile bağlı davet, token yok (günde 10)   |
| withdraw_share(id)                                                  | Daveti iptal eder                                                           |
| find_by_paramnet_id(paramnet_id)                                    | status (found, not_found, self, invalid) + görünen ad; saatte 20 (ADR-050)  |
| get_my_profile() / update_profile(first, last, username) / check_username(u) | Kendi profili; ad, soyad, @kullanıcı adı (ADR-051)                |
| set_avatar(path)                                                    | `avatars/{uid}/{uuid}.jpg`; eski yolu silinmek üzere döner                  |
| list_notifications(category, before_id, limit) / mark_notifications_read(ids) | Bildirim kutusu; okunmamış ve canlı onay bekleyen sayısı           |
| set_reminder_prefs(days)                                            | Vade öncesi hatırlatma: 7, 3, 1, 0 alt kümesi                               |
| regenerate_paramnet_id() / set_id_discoverable(on)                  | Yeni rastgele ID (30 günde bir) / bulunabilirlik anahtarı                   |
| decide_agreement(id, version, terms_hash, decision, counter_terms?) | accept / counter / reject                                                   |
| record_payment(id, input, idem_key)                                 | Alacaklı/kişisel: confirmed; borçlu: reported                               |
| decide_payment(payment_id, decision)                                | confirm / reject                                                            |
| withdraw_payment(payment_id)                                        | Borçlu bildirimini geri çeker                                               |
| propose_amendment(id, terms, reason)                                | amendment_pending                                                           |
| decide_amendment(id, version, terms_hash, decision)                 | accept / reject                                                             |
| open_dispute(id, reason, payment_id?) / resolve_dispute(id)         | İtiraz                                                                      |
| request_cancel(id) / decide_cancel(id, decision)                    | Karşılıklı iptal                                                            |
| forgive_remaining(id, amount?)                                      | Alacaklının indirimi/affı                                                   |
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
| create_card / update_card / archive_card / list_cards / get_card | Kartlar; türetilmiş ekstre, asgari, son ödeme, kullanılabilir limit (ADR-055) |
| create_loan / update_loan / archive_loan / list_loans / get_loan / record_loan_payment | Banka kredileri, türetilmiş ödeme planı, taksit kaydı (ADR-056) |

## 10.4 Edge Functions

| **Fonksiyon**                | **Görev**                                                                                 |
|------------------------------|-------------------------------------------------------------------------------------------|
| invite-open                  | Token’ı doğrular, minimum bilgiyi döner (oluşturanın adı).                                |
| invite-otp-send              | Turnstile + rate limit kontrolü, hedef numaraya OTP gönderir.                             |
| invite-otp-verify            | OTP’yi doğrular, kısa ömürlü (15 dk) onay oturumu verir.                                  |
| invite-decide                | Onay oturumuyla decide_agreement çağırır; olay kaydına web kanalı ve kanıt bilgisi yazar. |
| link-pending-invites         | Yeni kayıt olan kullanıcının numarasına bekleyen davetleri hesaba bağlar.                 |
| dispatch-notifications       | Outbox’tan push gönderir; geçersiz token’ları temizler.                                   |
| schedule-reminders (pg_cron) | Her gün 08:00’de vadesi yaklaşan/geçen taksitler için hatırlatma üretir.                  |
| expire-invites (pg_cron)     | Süresi dolan davetleri kapatır, anlaşmayı personal’a döndürür.                            |
| send-sms-hook                | Supabase Auth OTP’sini yerli SMS sağlayıcıya iletir.                                      |

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

| **Tehdit**                                       | **Önlem**                                                                                             |
|--------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| Link tahmini                                     | 256-bit rastgele token (base64url). Veritabanında yalnızca SHA-256 hash’i.                            |
| Linkin başkasına iletilmesi                      | Link tek başına yetki vermez; davetteki hedef numaraya giden OTP zorunlu.                             |
| OTP öncesi bilgi sızıntısı                       | Doğrulamadan önce yalnızca oluşturanın adı gösterilir.                                                |
| Mesajlaşma uygulamalarının link önizleme botları | GET hiçbir durumu değiştirmez; tüm kararlar POST + CSRF token ile.                                    |
| OTP kaba kuvvet                                  | Davet başına 5 deneme, OTP 5 dakika geçerli, aşımda davet kilitlenir.                                 |
| SMS pumping                                      | Yalnızca +90 numaralar; Turnstile; IP ve numara başına rate limit; günlük SMS bütçe alarmı.           |
| Onaylanan içeriğin değişmesi                     | Karar versiyon numarası + terms_hash ile gönderilir; uyuşmazsa reddedilir.                            |
| Tekrar kullanım                                  | Karar sonrası token consumed; süre sonunda expired.                                                   |
| Oltalama (sahte site)                            | Tek sabit alan adı; sayfa şifre veya kart bilgisi istemez; uygulama içinde kullanıcı bilgilendirilir. |
| Tarayıcı kaynaklı sızıntı                        | HTTPS + HSTS, Referrer-Policy: no-referrer, noindex, sıkı CSP, ayrı alt alan adı.                     |

## 11.3 Uygulama ve altyapı

- İstemci yalnızca anon anahtarı taşır; servis rolü anahtarı yalnızca edge function ortam değişkenlerinde.

- Storage: dekont bucket’ı özel; erişim kısa süreli imzalı URL ile ve yalnızca anlaşma taraflarına.

- Dekont yükleme: yalnızca görsel/PDF, en fazla 5 MB, sunucuda MIME doğrulama, EXIF temizleme.

- Tüm RPC’lerde girdi doğrulama (tutar \> 0, tarih aralığı, metin uzunluğu).

- Rate limit: kullanıcı başına dakikada işlem sınırı (RPC’lerde sayaç tablosu veya edge katmanında).

- Bağımlılık taraması (Dependabot), gizli anahtar taraması, migration’ların kod incelemesi.

- Yedekleme: Supabase günlük yedek + PITR (ücretli plan).

- Loglarda telefon numarası ve tutar maskelenir. ParamNet ID loglara ve analitik olaylarına yazılmaz.

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
| Üçüncü kişi verisi        | Kullanıcı, uygulamayı kullanmayan kişilerin adını, numarasını ve borç bilgisini giriyor. Veri minimizasyonu: numara isteğe bağlı; rehber sunucuya yüklenmez.   |
| Yurt dışına veri aktarımı | Supabase/Sentry/PostHog sunucularının konumu ve KVKK’daki yurt dışı aktarım kuralları. Gerekirse bölge seçimi veya yurt içi barındırma.                        |
| Silme hakkı               | Hesap silmede kullanıcının kişisel verisi silinir/anonimleştirilir. Karşı tarafın da taraf olduğu anlaşmalarda olay kaydının nasıl korunacağı netleştirilmeli. |
| Ödeme hizmeti kapsamı     | Uygulama para tutmaz, ödeme başlatmaz; 6493 sayılı Kanun kapsamındaki ödeme hizmeti sunulmaz. Bu sınır ürün kararı olarak korunmalı.                           |
| Faiz                      | Kişiler arası faizli borç kaydı ve hesaplaması sunulmaz (ilk sürüm).                                                                                           |
| Senet                     | Senet görseli ve bilgisi saklanabilir; uygulama e-senet düzenlemez ve kaydın hukuki geçerliliği hakkında iddiada bulunmaz.                                     |
| Kayıtların delil niteliği | Olay kaydı tarafların kendi kullanımı içindir; “resmi belge” olarak pazarlanmaz.                                                                               |
| Kullanım koşulları        | Kötüye kullanım (taciz amaçlı hatırlatma vb.) yasağı ve hesap kapatma hakkı.                                                                                   |

# 13. Analitik ve Başarı Ölçütleri

## 13.1 Kuzey yıldızı metriği

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Haftalık aktif anlaşma sayısı</strong></p>
<p>Son 7 günde en az bir olay (ödeme, onay, değişiklik) yaşayan anlaşma sayısı. Uygulama açılış sayısı yerine, borç ilişkilerinin gerçekten uygulamada yönetilip yönetilmediğini ölçer.</p></td>
</tr>
</tbody>
</table>

## 13.2 Huni ve davranış metrikleri

| **Metrik**               | **Tanım**                                                      | **Pilot hedefi**  |
|--------------------------|----------------------------------------------------------------|-------------------|
| Aktivasyon               | Kayıt olanların ilk anlaşmayı oluşturma oranı                  | %60+              |
| İlk kayıt süresi         | Uygulama açılışından ilk anlaşmaya                             | \< 90 sn          |
| Taksitli oran            | Oluşturulan anlaşmalardan taksitli olanlar                     | İzlenecek         |
| Paylaşım oranı           | Anlaşmalardan paylaşılanlar                                    | %25+              |
| Davet kabulü             | Paylaşımlardan onaylananlar (web + uygulama)                   | %50+              |
| Web’den uygulamaya geçiş | Web’de onaylayıp uygulamayı indirenler                         | İzlenecek         |
| Doğrulanan ödeme oranı   | Paylaşılan anlaşmalarda onaylanan ödemeler                     | İzlenecek         |
| Tekrar kullanım          | İlk anlaşması kapanan kullanıcıların ikinci anlaşma açma oranı | %30+              |
| Viral katsayı            | Davetle gelen kullanıcının kendi anlaşmasını oluşturma oranı   | İzlenecek         |
| Tutunma                  | D7 ve D30 aktif kullanıcı (bilgi amaçlı)                       | D7 %30+, D30 %15+ |

Hedefler sektör garantisi değil, pilot için konan karar eşikleridir. Ödemeler aylık olduğundan günlük açılış başarının doğru ölçüsü değildir.

## 13.3 Olay listesi

app_opened, signup_completed, agreement_created {kind, installments, mode}, agreement_shared, invite_opened {channel}, invite_otp_verified, agreement_decided {decision, channel}, payment_recorded {by_role}, payment_decided {decision}, amendment_proposed, amendment_decided, dispute_opened, agreement_settled, reminder_sent, reminder_opened.

Olaylara tutar aralığı dışında kişisel veri eklenmez (ad, numara, not gönderilmez).

# 14. Gelir Modeli

| **Ücretsiz (her zaman)**          | **Premium (sonra)**                           |
|-----------------------------------|-----------------------------------------------|
| Sınırsız kişisel anlaşma          | Anlaşma ve ödeme geçmişinin PDF çıktısı       |
| Taksit planı, kısmi ödeme, takvim | Gelişmiş raporlar ve dışa aktarma (Excel/CSV) |
| Paylaşım, davet, karşılıklı onay  | Çoklu para birimi ve altın bazlı borç         |
| Ödeme bildirimi ve doğrulama      | Aile paylaşımı / ortak görünüm                |
| Hatırlatmalar                     | Doğal dil ile hızlı kayıt (yüksek kota)       |
| Temel dekont ekleme               | İleride: kişisel finans modülleri             |

- İlke: Davet, onay ve hatırlatma asla ücret duvarı arkasında olmaz. Bunlar büyümenin motorudur.

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

Faz 2 — Karşılıklı akış (Hafta 5–7)

- Davet üretimi ve paylaşım ekranı.

- Universal Links / App Links yapılandırması.

- Web onay sayfası (W01–W04), Turnstile, OTP edge function’ları.

- Uygulama içi gelen paylaşım, ödeme doğrulama, değişiklik talebi, itiraz, karşılıklı iptal.

- Talepler ekranı, bildirim şablonları, outbox gönderici.

- Yeni kayıtta bekleyen davetleri bağlama.

**Çıkış ölçütü:** İki farklı cihazda (biri uygulamasız) uçtan uca senaryolar eksiksiz çalışıyor; iki taraf aynı bakiyeyi görüyor.

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
| 1.2       | Grup / ortak harcama, çoklu para birimi ve altın                                        |
| 2.0       | Kişisel finans: gelir-gider, hesaplar, kredi kartı ve kredi takibi (ledger mimarisiyle) |
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
| Domain (TS)     | Vitest                       | Plan üretimi, yuvarlama, ay sonu tarihleri, ödeme dağıtımı; özellik tabanlı testler (fast-check) ile “toplam her zaman eşit” değişmezleri |
| Veritabanı      | pgTAP                        | Her durum geçişi (izinli ve izinsiz), RLS politikaları, idempotency, eşzamanlı ödeme yarışları                                            |
| Edge Functions  | Deno test                    | Token doğrulama, OTP limitleri, karar akışı                                                                                               |
| Mobil bileşen   | React Native Testing Library | Formlar, durum etiketleri, boş durumlar                                                                                                   |
| Uçtan uca mobil | Maestro                      | Kayıt → anlaşma → paylaş → onay → ödeme → kapanış                                                                                         |
| Uçtan uca web   | Playwright                   | Web onay sayfası tüm senaryolar                                                                                                           |
| Tutarlılık işi  | pg_cron                      | Günlük: outstanding_minor ile ödemelerden hesaplanan bakiye karşılaştırması, sapma alarmı                                                 |

Kritik test senaryoları

1.  İki taraf aynı anda farklı ödemeler kaydeder: bakiye doğru, çakışma yok.

2.  Aynı ödeme isteği iki kez gelir: tek kayıt oluşur.

3.  Karşı taraf eski versiyonu onaylamaya çalışır (oluşturan bu arada değiştirmiş): reddedilir.

4.  Link önizleme botu linki açar: davet tüketilmez.

5.  Yanlış numarayla OTP denemesi: onay verilemez; 5 hatada kilit.

6.  Ödeme kalan borçtan fazla: reddedilir.

7.  31 Ocak başlangıçlı aylık plan: Şubat taksiti ayın son günü.

8.  Değişiklik kabul edildikten sonra geçmiş ödemeler korunur, yeni plan kalan tutara kurulur.

9.  Web’de onaylayan kişi sonra uygulamaya kaydolur: anlaşma hesabına bağlanır.

10. Hesap silme: karşı tarafın görünümünde anlaşma “silinmiş kullanıcı” ile korunur.

# 17. Riskler ve Önlemler

| **Risk**                                                     | **Etki**   | **Olasılık** | **Önlem**                                                              |
|--------------------------------------------------------------|------------|--------------|------------------------------------------------------------------------|
| İnsanlar borç onaylatmayı sosyal olarak rahatsız edici bulur | Yüksek     | Orta         | Faz 0 görüşmeleri; kolaylık odaklı dil; kişisel mod tek başına değerli |
| Davet kabul oranı düşük                                      | Yüksek     | Orta         | Uygulamasız web onayı; tek ekranlık karar; mesaj metni A/B testi       |
| Manuel giriş yorar, kullanım düşer                           | Yüksek     | Yüksek       | 90 sn hedefi; şablonlar; doğal dil kaydı 1.1’de                        |
| Bakiye tutarsızlığı güveni zedeler                           | Çok yüksek | Düşük        | Sunucu otoritesi, transaction, pgTAP, günlük tutarlılık işi            |
| SMS maliyeti ve kötüye kullanım                              | Orta       | Orta         | Turnstile, rate limit, bütçe alarmı, yalnızca +90                      |
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
> references/state-machines.md ← anlaşma, ödeme, davet geçiş tabloları (Bölüm 8)
>
> references/schema.md ← tablolar, RLS ilkeleri, RPC listesi (Bölüm 10)
>
> references/security.md ← davet/OTP tehdit modeli (Bölüm 11)

- **Tetiklenme:** migration, RLS, RPC, edge function, bakiye, taksit, ödeme dağıtımı, davet veya durum geçişi ile ilgili her iş.

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
> references/deep-links.md ← davet linki rotaları, Universal/App Links
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
| Web onay sayfası teknolojisi ve barındırma | Next.js / Astro; Vercel / Cloudflare                                                          | Faz 2 başı   |
| Analitik aracı                             | PostHog (AB) / kendi olay tablosu                                                             | Faz 1        |
| Supabase bölgesi                           | KVKK görüşmesine göre                                                                         | Faz 0 sonu   |
| Yayın sırası                               | iOS ve Android birlikte / önce Android                                                        | Faz 3        |
| Premium fiyatı                             | Pilot sonrası test                                                                            | 1.1          |

## 19.2 Hemen sonraki adımlar

1.  Bu dokümanı gözden geçir, kapsam ve kuralları onayla.

2.  Faz 0 görüşme rehberini hazırla ve görüşmelere başla.

3.  Bölüm 18’deki çekirdek skill setini kur; paramnet-domain ve paramnet-mobile proje skill’lerini bu dokümandan oluştur.

4.  Faz 0 sonucuna göre Faz 1’i başlat: şema, RLS ve durum makinesi testleri.
