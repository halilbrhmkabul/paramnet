# Ekranlar

Kaynak: `docs/PRODUCT_SPEC.md` Bölüm 5 ve 6.

## Navigasyon

- `(auth)` grubu: oturum yoksa.
- `(tabs)` grubu: Ana Sayfa · Kartlarım · İşlem (+) · Borçlarım · Takvim (F4-01). Ortadaki "+" İşlem merkezi sekmesidir (21, ADR-053).
- Talepler sekmesinde bekleyen iş sayısı rozeti.
- Ana Sayfa üst çubuğu: solda Ana menü (`/menu`), sağda zil → Bildirimler (`/inbox`, okunmamış sayısı). Selamlama (fotoğraf + ad) Profil'i (`/me`) açar.

## Ekran listesi

| ID | Ekran | Rota | Ana bileşenler | Not |
|---|---|---|---|---|
| S01 | Karşılama (01) | `(auth)/welcome` | Koyu orman zemin, dekoratif kart yığını, vaat, Hesap oluştur / Giriş yap | Her iki temada koyu |
| S01b | Tanıtım (31) | `(auth)/onboarding` | 3 slayt, sayaç, Atla, Devam / Başlayalım → Kayıt ol | |
| S02 | Giriş (02) | `(auth)/login?mode=signin\|signup` | Giriş yap / Kayıt ol sekmeleri; +90 numara; giriş: 6 haneli PIN (göster/gizle), Şifremi unuttum; kayıt: Kod gönder | Yüz tanıma gizli (BACKLOG) |
| S03 | OTP | `(auth)/otp` | 6 haneli kod, 60 sn sonra yeniden gönder, hata durumları; kayıt ve PIN yenileme | iOS otomatik SMS kod doldurma |
| S03b | PIN belirle | `(auth)/pin` | 6 hane iki kez; zayıf PIN ve eşleşmeme hatası; eski hesaba açıklama | ADR-046 |
| S04 | Profil kurulumu | `(auth)/profile` | Görünen ad, KVKK onayı, bildirim izni (gerekçeli) | Bekleyen davet varsa sonrasında Talepler |
| S05 | Ana Sayfa | `(tabs)/index` | Toplam alacak, toplam borç, bu ay ödenecek/tahsil edilecek, gecikenler, yaklaşan 5 vade, bekleyen işler bandı | Boş durum: 3 hızlı şablon |
| S06 | Kişiler | `(tabs)/contacts` | Arama, kişi listesi, net bakiye (bana borçlu / borçluyum) | |
| S07 | Kişi detay | `contact/[id]` | Net bakiye, anlaşmalar listesi, yeni kayıt | |
| S08 | Kayıt türü | `new/index` (modal) | 4 kart: Borç verdim, Borç aldım, Taksitle aldım, Taksitle sattım | |
| S09 | Kayıt formu | `new/form` | Dinamik alanlar, kişi seçici, AmountInput, tarih seçici, not | Türe göre alanlar spec 5.2 |
| S10 | Plan önizleme | `new/plan` | Taksit listesi, satır düzenleme, toplam kontrolü, Kaydet | Toplam ≠ kalan ise Kaydet kapalı |
| S11 | Anlaşma detay | `agreement/[id]/index` | Üst kart (karşı taraf, rol, kalan, toplam, ilerleme, durum etiketi), birincil aksiyon, taksitler, ödemeler, menü | Etiketler: Kişisel, Onay bekliyor, Aktif, Değişiklik bekliyor, İtirazlı, Kapandı, İptal |
| S12 | Ödeme ekle | `agreement/[id]/payment` | Tutar, tarih, yöntem, dekont, not, dağıtım önizlemesi | Borçlu shared'da: "Ödeme yaptım" (onaya gider) |
| S13 | Paylaş | `agreement/[id]/share` | Telefon / ParamNet ID seçimi; numara kontrolü, mesaj önizleme, sistem paylaşım menüsü; ID ile ad gösterimi ve uygulama içi paylaşım | Faz 2, ADR-050 |
| S14 | Gelen paylaşım | `invite/[token]` ve Talepler'den | Anlaşma özeti, Onayla / Düzeltme öner / Reddet | Faz 2 |
| S15 | Değişiklik talebi | `agreement/[id]/amend` | Mevcut vs önerilen plan karşılaştırması | Faz 2 |
| S16 | İtiraz | `agreement/[id]/dispute` | Gerekçe, ilgili ödeme seçimi | Faz 2 |
| S17 | Geçmiş | `agreement/[id]/history` | Olay zaman çizelgesi | |
| S18 | Takvim | `(tabs)/calendar` | Ay görünümü (nokta: vade, renk: durum), gün listesi | |
| S19 | Talepler | `(tabs)/requests` | Sekmeler: Paylaşımlar, Ödemeler, Değişiklikler | Faz 1'de boş durum |
| S20 | Profil (04) | `me/index` | Fotoğraf, ad, @kullanıcı adı, ParamNet ID kartı (Kopyala, Paylaş), Hesaplarım, Bildirim tercihleri, ID ile bulunabilirlik, dışa aktarma, Yasal metinler, Hesabı sil, Çıkış yap | Ayrı Ayarlar yok (ADR-051); QR, yüz tanıma gizli |
| S20a | Profili düzenle (35) | `me/edit` (modal) | Kamera/galeri/kaldır, Ad, Soyad, @kullanıcı adı (canlı denetim), salt okunur telefon ve ID | E-posta ve "Değiştirilemez" yok |
| S20b | ID ile bulunabilirlik | `me/discoverability` | Herkes / Kimse, Yeni ID al (30 günde bir, onaylı) | ADR-050 |
| S20c | Yasal metinler | `me/legal` | KVKK, Kullanım koşulları | |
| S21 | Ana menü (05) | `menu` (modal) | Ad + ID, Modüller (yalnızca yapılanlar), Uygulama kartı, para transferi notu, sürüm | ADR-051, ADR-052 |
| S22 | Bildirimler (06) | `inbox` | Filtre çipleri, gün grupları, okunmamış noktası, satır eylemleri, Tümünü okundu işaretle, hatırlatma tercihleri | ADR-051, ADR-052 |
| S23 | İşlem merkezi (21) | `(tabs)/add` (orta "+" sekmesi) | Gelir / Gider / Transfer kutucukları; Borç al, Borç ver, Elden taksit ekle | Yapılmamış modüller gizli (ADR-053) |
| S24 | Gider / Gelir / Transfer (22) | `transaction/new?kind=&account=` (modal), `transaction/[id]/edit` | Tür seçici, tutar tuş takımı, kategori çipleri, hesap / kart (kartta taksit; transferde Nereden/Nereye, hedef kart olabilir), tarih, açıklama, not | Hesap yoksa "Önce bir hesap ekle" |
| S25 | Hesaplar (29) | `accounts/index` | Toplam Nakit, Hesap ekle / Transfer / Bakiye düzelt, hesap listesi, seçili hesabın bu ayki hareketleri | "Manuel kayıt · banka verisi değildir" |
| S26 | Hesap ekle (33) | `accounts/new`, `accounts/[id]/edit` (modal) | Tür (banka, nakit, birikim, diğer), ad, banka, açılış bakiyesi (eksi olabilir), Toplam Nakit'e dahil et; düzenlemede Hesabı arşivle | IBAN yok |
| S26a | Bakiye düzelt | `accounts/[id]/adjust` (modal) | Şu anki bakiye, gerçek bakiye, fark | Fark gelir/gider sayılmaz |
| S27 | İşlem geçmişi (36) | `transactions` | Ay seçici, arama, Tümü/Gelir/Gider/Transfer, ay geliri/gideri, gün grupları | "Planlı & bekleyen" F4-10 |
| S28 | İşlem detayı (37) | `transaction/[id]` | Tutar, rozetler, bilgi satırları, etki notu, Düzenle / Sil (alt panel, 10 sn Geri al), oluşturma ve son düzenleme | Düzeltme düzenlenmez |
| S29 | Tekrarlayan işlemler (38) | `recurring/index`, `recurring/new` ve `recurring/[id]` (modal) | Onay bekleyenler (Onayla / Atla), aktif kurallar; form: tür, ad, tutar, kategori, hesap, sıklık, ilk tarih, sonraki 3 tarih, her seferinde onay; düzenlemede Durdur / Sürdür / Sil | ADR-054 |
| S30 | Bütçe (39) | `budget` | Özet (harcanan / bütçe, kalan gün, günlük pay), Tüm / Dikkat gerekenler, kategori satırları ve uyarı rozetleri; sınır ekleme/düzenleme/kaldırma paneli | |
| S31 | Aylık rapor (27) | `reports` | Ay seçici (son tamamlanan ay), Gelir / Gider / Net, 6 aylık sütunlar, kategori dağılımı, borç ve alacak dengesi | Dışa aktarma yok (BACKLOG) |
| S32 | Kartlarım (07) | `(tabs)/cards` | Toplam borç / kullanılabilir / limit, "limitler Toplam Nakit'e eklenmez" notu, kart yüzü + ekstre, asgari, son ödeme rozeti, kullanılabilir limit | ADR-055 |
| S33 | Kart ekle (32) | `cards/new`, `cards/[id]/edit` (modal) | Önizleme kartı, renk, banka, ad, son 4 hane, limit, güncel borç, kesim günü, son ödeme günü, asgari oran (önerili); düzenlemede arşivle | CVV / tam numara yok |
| S34 | Kart detayı (08) | `cards/[id]` | Toplam borç; Ekstre (durum, asgari çizgisi, kalan, son ödeme, Ödeme kaydet, dönem içi, kart bilgileri) / Taksitler / Geçmiş (ekstreler, ödemeler) | Faiz simülasyonu F4-07 |
| S35 | Kart ödemesi (09) | `cards/[id]/pay` (modal) | Tamamı / asgari / başka tutar, kaynak hesap, tarih, kalan ve yeni bakiye, kısmi ödeme uyarısı | Ödeme = hesaptan karta transfer |
| S36 | Ödeme kaydedildi (11) | `cards/[id]/paid` (modal) | Tutar, kalan ekstre, hesap önce → sonra, tarih, kayıt no, "gider sayılmadı" notu, Ana sayfaya dön / Geri al | |
| S37 | Banka kredileri | `loans/index` | Kalan anapara, bu ayki taksitler, kredi panelleri | Tasarımda yok; birden çok kredi için |
| S38 | Kredi detayı (28) | `loans/[id]` | Kalan anapara paneli (taksit hücreleri), Taksit ödedim kaydet, kredi bilgileri, ödeme planı tablosu (tümünü göster), ödenen taksitler | ADR-056 |
| S39 | Kredi ekle (34) | `loans/new`, `loans/[id]/edit` (modal) | Banka, tür, tutar, aylık faiz, ilk taksit, vade çipleri, hesaplanan taksit / toplam / faiz / son taksit, bankanın taksiti, ödeme hesabı; düzenlemede arşivle | |
| S40 | Taksit ödemesi | `loans/[id]/pay` (modal) | Sıradaki taksit, ödeme hesabı, tarih, yeni bakiye | Transfer, gider değil |
| S41 | Faiz simülasyonu (10) | `interest?card=` / `interest?loan=` / `interest` (seçim) | "Bu bir tahmindir" notu; kart: asgari/kısmi/tamamı, tahmini faiz + KKDF + BSMV, hesaplama satırı, parametreler, Ödeme kaydet; kredi: erken kapama tutarı, ücret, kazanç | Kayıt yazılmaz (ADR-057) |

Web onay ekranları (W01–W04) `apps/web-confirm`'dedir, bu skill kapsamında değil.

## Kayıt formu alanları (S09)

| Tür | Rol | Alanlar |
|---|---|---|
| Borç verdim | creditor | Kişi, tutar, verildiği tarih, geri ödeme (tek sefer / taksit), not |
| Borç aldım | debtor | Kişi, tutar, alındığı tarih, geri ödeme, not |
| Taksitle aldım | debtor | Satıcı (kişi veya serbest metin), ürün (başlık), toplam, peşinat, taksit sayısı, periyot, ilk ödeme tarihi |
| Taksitle sattım | creditor | Alıcı, ürün, toplam, peşinat, taksit planı |

Varsayılanlar: periyot aylık; ilk ödeme bugünden 1 ay sonra; son kullanılan kişi önde.

## Anlaşma detayında birincil aksiyon

| Durum | Kullanıcı rolü | Birincil aksiyon |
|---|---|---|
| personal | sahip | Ödeme ekle (ikincil: Paylaş) |
| pending | oluşturan | Hatırlat / Linki tekrar paylaş |
| pending | karşı taraf | Yanıtla (Onayla / Düzeltme öner / Reddet) |
| countered | oluşturan | Öneriyi incele |
| active | alacaklı | Ödeme aldım |
| active | borçlu | Ödeme yaptım |
| amendment_pending | diğer taraf | Değişikliği incele |
| disputed | herkes | İtirazı görüntüle |
| settled / cancelled | herkes | — (yalnızca görüntüleme) |
