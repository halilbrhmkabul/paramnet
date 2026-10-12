# Mağaza gizlilik beyanları (F3-07)

Cevaplar uygulamanın **gerçekte** topladığı veriye göre hazırlandı:
- şema (`supabase/migrations`);
- Sentry temizleyicisi (ADR-037);
- analitik tablosu (ADR-038);
- hesap silme ve dışa aktarma (ADR-039).

Kod değişince bu tablo da güncellenmeli. Hukuki onay: KVKK metinleriyle birlikte avukata.

Ortak cevaplar:
- **İzleme (tracking):** Hayır. Reklam yok; veri üçüncü taraflarla birleştirilmez veya satılmaz.
- **Paylaşım:** Hayır. Supabase (barındırma), Sentry (hata), SMS sağlayıcı ve Expo Push (bildirim) veri işleyen hizmet sağlayıcılardır; Google'ın tanımında "paylaşım" sayılmazlar.
- **Aktarımda şifreleme:** Evet (HTTPS/TLS).
- **Silme talebi:** Evet. Uygulama içinde: Profil → Hesabı sil. Web'den talep için bir sayfa gerekiyor (aşağıda).

## Apple — App Privacy

| Veri türü (Apple kategorisi) | Ne | Amaç | Kullanıcıya bağlı | İzleme |
|---|---|---|---|---|
| Contact Info → Phone Number | Hesabın telefon numarası | App Functionality | Evet | Hayır |
| Contact Info → Name | Görünen ad | App Functionality | Evet | Hayır |
| Contacts | Yalnızca kullanıcının seçtiği karşı tarafın adı/numarası; rehber yüklenmez | App Functionality | Evet | Hayır |
| Financial Info → Other Financial Info | Borç tutarları, taksit planı, ödeme kayıtları | App Functionality | Evet | Hayır |
| User Content → Other User Content | Notlar, değişiklik/itiraz gerekçeleri | App Functionality | Evet | Hayır |
| Identifiers → User ID | Hesap kimliği (UUID) | App Functionality, Analytics | Evet | Hayır |
| Identifiers → Device ID | Push bildirim anahtarı (Expo push token) | App Functionality | Evet | Hayır |
| Usage Data → Product Interaction | Uygulama açılışı, bildirim açılışı, davet açılışı | Analytics | Evet | Hayır |
| Diagnostics → Crash Data, Other Diagnostic Data | Sentry hata kayıtları (kişisel veri temizlenmiş, yalnızca kullanıcı kimliği) | App Functionality | Evet | Hayır |

Toplanmayanlar: konum, sağlık, ödeme kartı, e-posta, fotoğraf, arama/tarama geçmişi, reklam kimliği.

## Google Play — Veri güvenliği

| Kategori → tür | Toplanıyor | Paylaşılıyor | İsteğe bağlı mı | Amaç |
|---|---|---|---|---|
| Kişisel bilgiler → Ad | Evet | Hayır | Zorunlu | Uygulama işlevselliği, hesap yönetimi |
| Kişisel bilgiler → Telefon numarası | Evet | Hayır | Zorunlu | Uygulama işlevselliği, hesap yönetimi, dolandırıcılığı önleme (OTP) |
| Finansal bilgiler → Diğer finansal bilgiler | Evet | Hayır | Zorunlu | Uygulama işlevselliği |
| Kişiler | Evet (yalnızca seçilen kişi) | Hayır | İsteğe bağlı | Uygulama işlevselliği |
| Uygulama etkinliği → Uygulama içi işlemler | Evet | Hayır | Zorunlu | Analiz |
| Uygulama etkinliği → Diğer kullanıcı içeriği | Evet (notlar) | Hayır | İsteğe bağlı | Uygulama işlevselliği |
| Uygulama bilgileri ve performansı → Kilitlenme günlükleri, Diğer teşhis verileri | Evet | Hayır | Zorunlu | Uygulama işlevselliği |
| Cihaz veya diğer kimlikler | Evet (push anahtarı) | Hayır | İsteğe bağlı | Uygulama işlevselliği |

## Yayından önce eksik olanlar

- **Gizlilik politikası URL'si** (iki mağaza da ister). KVKK aydınlatma metninin web sürümü olabilir, alan adı kararına bağlı (`EXPO_PUBLIC_APP_DOMAIN`).
- **Hesap silme web sayfası (Google Play zorunluluğu).** Uygulamayı silmiş biri de silme isteyebilmeli. Sayfa uygulama içi adımları anlatır ve bir iletişim e-postası verir; alan adı ve destek e-postası belli olunca web-confirm'e eklenir.
- **İnceleme hesabı:** Üretim Supabase'inde Auth → Test OTP'ye bir inceleme numarası ve kodu tanımlanır. Değerler `store.config.json` → `review`'a yazılır; şu an yer tutucu.
- `store.config.json` ve `store/play-listing.json`'daki `example.com` adresleri gerçek adreslerle değiştirilir.
