# Ekranlar

Kaynak: `docs/PRODUCT_SPEC.md` Bölüm 5 ve 6.

## Navigasyon

- `(auth)` grubu: oturum yoksa.
- `(tabs)` grubu: Ana Sayfa · Borçlarım · İşlem (+) · Ortak · Takvim (ADR-064). Ortadaki "+" İşlem merkezi sekmesidir.
- Ana Sayfa üst çubuğu: solda Ana menü (`/menu`), sağda zil → Bildirimler (`/inbox`, okunmamış sayısı). Selamlama (fotoğraf + ad) Profil'i (`/me`) açar.

## Ekran listesi

| ID | Ekran | Rota | Ana bileşenler | Not |
|---|---|---|---|---|
| S01 | Karşılama (01) | `(auth)/welcome` | Koyu orman zemin, dekoratif kart yığını, vaat, Hesap oluştur / Giriş yap | Her iki temada koyu |
| S01b | Tanıtım (31) | `(auth)/onboarding` | 3 slayt, sayaç, Atla, Devam / Başlayalım → Kayıt ol | |
| S02 | Giriş (02) | `(auth)/login?mode=signin\|signup` | Giriş yap / Kayıt ol sekmeleri; +90 numara; giriş: 6 haneli PIN (göster/gizle), Şifremi unuttum; kayıt: Kod gönder | Yüz tanıma gizli (BACKLOG) |
| S03 | OTP | `(auth)/otp` | 6 haneli kod, 60 sn sonra yeniden gönder, hata durumları; kayıt ve PIN yenileme | iOS otomatik SMS kod doldurma |
| S03b | PIN belirle | `(auth)/pin` | 6 hane iki kez; zayıf PIN ve eşleşmeme hatası; eski hesaba açıklama | ADR-046 |
| S04 | Profil kurulumu | `(auth)/profile` | Görünen ad, KVKK onayı, bildirim izni (gerekçeli) | |
| S05 | Ana Sayfa | `(tabs)/index` | Toplam alacak, toplam borç, bu ay ödenecek/alınacak, gecikenler, yaklaşan vadeler | Boş durum: 3 hızlı şablon |
| S07 | Kişi detay | `contact/[id]` | Net bakiye, anlaşmalar listesi, yeni kayıt | |
| S09 | Kayıt formu | `new/form` | Dinamik alanlar, kişi seçici, AmountInput, tarih seçici, not. Taksitli alım/satış tasarım 23: satıcı/ürün, fiyat/peşinat, taksitlendirilecek tutar, sayı düğmeleri, ilk ödeme, sıklık, alış tarihi, hesaplanan taksit, geçmiş tarih notu | Türe göre alanlar spec 5.2; ADR-059 |
| S10 | Plan önizleme (24) | `new/plan`, `new/plan?edit=1` | Özet, salt okunur taksit listesi, geçmiş satırlarda "Ödendi", toplam eşitliği, hatırlatma kartı, Planı kaydet / Düzenle; düzenleme modunda satır düzenleme ve Eşit dağıt | Toplam ≠ kalan ise Kaydet kapalı |
| S11 | Anlaşma detay (13, 15; elden taksitte 25) | `agreement/[id]/index` | Üst kart (karşı taraf, rol, kalan, toplam, ilerleme, durum etiketi), birincil aksiyon, taksitler, ödemeler, menü (Düzenle, Borç sil, İptal et) | Etiketler: Açık, Kapandı, İptal |
| S12 | Ödeme ekle | `agreement/[id]/payment` | Tutar, tarih, yöntem, dekont, not, dağıtım önizlemesi | Ödeme doğrudan geçerli |
| S17 | Geçmiş | `agreement/[id]/history` | Olay zaman çizelgesi | |
| S18 | Takvim | `(tabs)/calendar` | Ay görünümü (nokta: vade, renk: durum), gün listesi | |
| S20 | Profil (04) | `me/index` | Fotoğraf, ad, @kullanıcı adı, Bildirim tercihleri, dışa aktarma, Yasal metinler, Hesabı sil, Çıkış yap | Ayrı Ayarlar yok (ADR-051) |
| S20a | Profili düzenle (35) | `me/edit` (modal) | Kamera/galeri/kaldır, Ad, Soyad, @kullanıcı adı (canlı denetim), salt okunur telefon | E-posta ve "Değiştirilemez" yok |
| S20c | Yasal metinler | `me/legal` | KVKK, Kullanım koşulları | |
| S21 | Ana menü (05) | `menu` (modal) | Ad, Banka kredileri, Kredi simülasyonu, Bildirimler, Profil, para transferi notu, sürüm | ADR-051, ADR-052 |
| S22 | Bildirimler (06) | `inbox` | Hatırlatma listesi, gün grupları, okunmamış noktası, Tümünü okundu işaretle, hatırlatma tercihleri | ADR-051, ADR-052 |
| S23 | İşlem merkezi (21) | `(tabs)/add` (orta "+" sekmesi) | Borç ver, Borç al, Elden taksit, Hesap böl, Kredi ekle | Gelir / Gider / Transfer yalnızca gizli modül açıkken |
| S24 | Gider / Gelir / Transfer (22) (gizli modül) | `transaction/new?kind=&account=` (modal), `transaction/[id]/edit` | Tür seçici, tutar tuş takımı, kategori çipleri, hesap / kart (kartta taksit; transferde Nereden/Nereye, hedef kart olabilir), tarih, açıklama, not | Hesap yoksa "Önce bir hesap ekle" |
| S25 | Hesaplar (29) (gizli modül) | `accounts/index` | Toplam Nakit, Hesap ekle / Transfer / Bakiye düzelt, hesap listesi, seçili hesabın bu ayki hareketleri | "Manuel kayıt · banka verisi değildir" |
| S26 | Hesap ekle (33) (gizli modül) | `accounts/new`, `accounts/[id]/edit` (modal) | Tür (banka, nakit, birikim, diğer), ad, banka, açılış bakiyesi (eksi olabilir), Toplam Nakit'e dahil et; düzenlemede Hesabı arşivle | IBAN yok |
| S26a | Bakiye düzelt (gizli modül) | `accounts/[id]/adjust` (modal) | Şu anki bakiye, gerçek bakiye, fark | Fark gelir/gider sayılmaz |
| S27 | İşlem geçmişi (36) (gizli modül) | `transactions` | Ay seçici, arama, Tümü/Gelir/Gider/Transfer, ay geliri/gideri, gün grupları | "Planlı & bekleyen" F4-10 |
| S28 | İşlem detayı (37) (gizli modül) | `transaction/[id]` | Tutar, rozetler, bilgi satırları, etki notu, Düzenle / Sil (alt panel, 10 sn Geri al), oluşturma ve son düzenleme | Düzeltme düzenlenmez |
| S29 | Tekrarlayan işlemler (38) (gizli modül) | `recurring/index`, `recurring/new` ve `recurring/[id]` (modal) | Onay bekleyenler (Onayla / Atla), aktif kurallar; form: tür, ad, tutar, kategori, hesap, sıklık, ilk tarih, sonraki 3 tarih, her seferinde onay; düzenlemede Durdur / Sürdür / Sil | ADR-054 |
| S30 | Bütçe (39) (gizli modül) | `budget` | Özet (harcanan / bütçe, kalan gün, günlük pay), Tüm / Dikkat gerekenler, kategori satırları ve uyarı rozetleri; sınır ekleme/düzenleme/kaldırma paneli | |
| S31 | Aylık rapor (27) (gizli modül) | `reports` | Ay seçici (son tamamlanan ay), Gelir / Gider / Net, 6 aylık sütunlar, kategori dağılımı, borç ve alacak dengesi | Dışa aktarma yok (BACKLOG) |
| S37 | Banka kredileri | `loans/index` | Kalan anapara, bu ayki taksitler, kredi panelleri | Tasarımda yok; birden çok kredi için |
| S38 | Kredi detayı (28) | `loans/[id]` | Kalan anapara paneli (taksit hücreleri), Taksit ödedim kaydet, kredi bilgileri, ödeme planı tablosu (tümünü göster), ödenen taksitler | ADR-056 |
| S39 | Kredi ekle (34) | `loans/new`, `loans/[id]/edit` (modal) | Banka, tür, tutar, aylık faiz, ilk taksit, vade çipleri, hesaplanan taksit / toplam / faiz / son taksit, bankanın taksiti; düzenlemede arşivle | |
| S40 | Taksit ödemesi | `loans/[id]/pay` (modal) | Sıradaki taksit, tarih, yeni bakiye; hesap yalnızca gizli modül açıkken | |
| S41 | Kredi simülasyonu (10) | `interest?loan=` / `interest` (seçim) | "Bu bir tahmindir" notu; erken kapama tutarı, ücret, kazanç | Kayıt yazılmaz (ADR-057) |
| S45 | Ortak | `(tabs)/split` | Gruplar, her grupta net bakiyen, Grup oluştur | ADR-064 |
| S46 | Grup oluştur / düzenle | `split/new`, `split/[id]/edit` (modal) | Ad, üyeler (isim ya da rehber) | Hesap, QR, link yok |
| S47 | Grup detay | `split/[id]` | Bakiyeler, kim kime ne kadar, harcamalar, ödeşmeler, geçmiş; Harcama ekle | "Yalnızca sen görüyorsun" notu |
| S48 | Harcama ekle / düzenle | `split/[id]/expense`, `split/[id]/expense/[expenseId]` (modal) | Başlık, tutar, tarih, ödeyen, dahil üyeler, eşit / tutar / yüzde, kuruş notu | |
| S49 | Ödeşme ekle | `split/[id]/settle` (modal) | Kimden, kime, tutar, tarih; öneriden doldurma | |

## Kayıt formu alanları (S09)

| Tür | Rol | Alanlar |
|---|---|---|
| Borç verdim | creditor | Kişi, tutar, verildiği tarih, geri ödeme (tek sefer / taksit), not |
| Borç aldım | debtor | Kişi, tutar, alındığı tarih, geri ödeme, not |
| Taksitle aldım | debtor | Satıcı (kişi veya serbest metin), ürün (başlık), toplam, peşinat, taksit sayısı, periyot, ilk ödeme tarihi |
| Taksitle sattım | creditor | Alıcı, ürün, toplam, peşinat, taksit planı |

Varsayılanlar: periyot aylık; ilk ödeme bugünden 1 ay sonra; son kullanılan kişi önde.

## Kayıt detayında birincil aksiyon

| Durum | Birincil aksiyon |
|---|---|
| personal | Ödeme ekle |
| settled / cancelled | — (yalnızca görüntüleme) |
