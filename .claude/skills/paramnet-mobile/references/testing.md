# Mobil Test Kuralları

Kaynak: `docs/PRODUCT_SPEC.md` Bölüm 16.

## Katmanlar

| Katman | Araç | Konum |
|---|---|---|
| Bileşen ve ekran | Jest + React Native Testing Library (jest-expo preset) | `apps/mobile/src/**/__tests__/` |
| Uçtan uca | Maestro | `apps/mobile/.maestro/` |
| Domain | Vitest | `packages/shared` (mobilde tekrar test edilmez) |

## testID adlandırma

Biçim: `ekran.öğe[.ek]`, küçük harf, camelCase parçalar, İngilizce.

```
home.newAgreement.button
home.overdue.list
newForm.amount.input
newForm.contact.picker
plan.row.3.amount.input
plan.save.button
agreement.primaryAction.button
agreement.installment.2.row
payment.amount.input
payment.save.button
split.create.button
split.expense.save.button
```

- Listelerde sıra numarası veya kararlı ID kullanılır (`agreement.installment.<seq>.row`).
- testID metinden türetilmez; metin değişince testler kırılmaz.
- Seçicilerde önce testID, sonra `accessibilityLabel`; görünen metinle seçim yalnızca son çare.

## RNTL kuralları

- Her ekran için: yükleniyor, boş, hata, veri durumları render testi.
- Birincil aksiyonun doğru durumda görünür/etkin olduğu test edilir (screens.md "birincil aksiyon" tablosu).
- API katmanı sahte adaptörle verilir (`EXPO_PUBLIC_API_MODE=mock` veya test sağlayıcısı); ağ çağrısı yok.
- Tutar ve tarih biçimi için anlık görüntü (snapshot) yerine açık metin beklentisi (`12.000,00 TL`).

## Maestro akışları

| Dosya | Akış | Faz |
|---|---|---|
| `onboarding.yaml` | Karşılama → telefon → OTP (test kodu) → profil | 1 |
| `create-loan.yaml` | Borç verdim, tek seferlik → detay | 1 |
| `create-installment.yaml` | Taksitle aldım: 28.000 / 8.000 / 5 taksit → plan önizleme değerleri | 1 |
| `record-payment.yaml` | Kısmi ödeme → taksit `partial` → tam ödeme → kapandı | 1 |
| `split-group.yaml` | Grup oluştur → harcama ekle → bakiyeler → ödeşme → ödeşildi | 5 |

Ortak alt akışlar: `subflows/login.yaml`, `subflows/create-agreement.yaml`. Oturum açık/kapalı başlangıç durumları için `maestro-mobile-testing` skill'indeki desenler kullanılır.

## Faz kapısı test listesi

Spec 16 "Kritik test senaryoları" — her faz kapısında hangilerinin otomatik test edildiği ROADMAP notuna yazılır.
