# Ekranlar

Kaynak: `docs/PRODUCT_SPEC.md` Bölüm 5 ve 6.

## Navigasyon

- `(auth)` grubu: oturum yoksa.
- `(tabs)` grubu: 4 sekme + ortada "+" (modal açar). Sıra: Ana Sayfa · Kişiler · [+] · Takvim · Talepler.
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
| S20 | Profil (04) | `me/index` | Fotoğraf, ad, @kullanıcı adı, ParamNet ID kartı (Kopyala, Paylaş), Bildirim tercihleri, ID ile bulunabilirlik, dışa aktarma, Yasal metinler, Hesabı sil, Çıkış yap | Ayrı Ayarlar yok (ADR-051); QR, Hesaplarım, yüz tanıma gizli |
| S20a | Profili düzenle (35) | `me/edit` (modal) | Kamera/galeri/kaldır, Ad, Soyad, @kullanıcı adı (canlı denetim), salt okunur telefon ve ID | E-posta ve "Değiştirilemez" yok |
| S20b | ID ile bulunabilirlik | `me/discoverability` | Herkes / Kimse, Yeni ID al (30 günde bir, onaylı) | ADR-050 |
| S20c | Yasal metinler | `me/legal` | KVKK, Kullanım koşulları | |
| S21 | Ana menü (05) | `menu` (modal) | Ad + ID, Modüller (yalnızca yapılanlar), Uygulama kartı, para transferi notu, sürüm | ADR-051, ADR-052 |
| S22 | Bildirimler (06) | `inbox` | Filtre çipleri, gün grupları, okunmamış noktası, satır eylemleri, Tümünü okundu işaretle, hatırlatma tercihleri | ADR-051, ADR-052 |

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
