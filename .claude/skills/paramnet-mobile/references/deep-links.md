# Derin Bağlantılar

Paylaşılan link, davet, Universal Link ve App Link yoktur; `/i/` ve `/h/` rotaları kaldırıldı (ADR-064).

- Tek derin bağlantı kullanımı bildirime dokunmaktır: bildirim, uygulama içi kayıt ya da kredi rotasını açar.
- Uygulama özel şeması `paramnet://` yalnızca bu geçiş ve geliştirme içindir.
- Oturum yoksa önce `(auth)` akışı açılır, sonra hedef rotaya dönülür.
