# Paramnet — Kurulum ve Çalışma Rehberi (Halil için)

Bu dosya sana yöneliktir; Claude Code'un kuralları `CLAUDE.md`'de, görev listesi `docs/ROADMAP.md`'dedir.

---

## 1. Önkoşullar (bilgisayarında bir kez)

| Araç | Neden | Kontrol |
|---|---|---|
| Node.js 20+ LTS | Expo, pnpm, skills CLI | `node -v` |
| pnpm | Monorepo paket yöneticisi | `corepack enable` sonra `pnpm -v` |
| Git | Sürüm kontrolü | `git --version` |
| Docker Desktop | Yerel Supabase | Docker açık olmalı |
| Xcode (yalnızca macOS) | iOS simülatörü | `xcode-select -p` |
| Android Studio | Android emülatörü | Emülatör açılıyor mu |
| Telefonunda Expo Go | Hızlı deneme (prototip aşaması) | App Store / Play Store |
| GitHub hesabı + boş repo | CI ve yedek | |

Supabase CLI ayrıca kurulmaz; proje içinde `pnpm supabase ...` ile çalışacak (S-03 görevinde eklenir).

---

## 2. Klasörü hazırla

1. Boş bir klasör aç (ör. `paramnet`).
2. Bu paketin **içeriğini** klasörün köküne kopyala. Sonuç:
	```
	paramnet/
		CLAUDE.md
		KURULUM.md
		docs/
			PRODUCT_SPEC.md
			ROADMAP.md
			DECISIONS.md
			BACKLOG.md
			Paramnet_Urun_ve_Teknik_Tasarim.docx
		.claude/
			skills/
				paramnet-domain/
				paramnet-mobile/
	```
	`.claude` klasörü gizli olabilir; kopyalandığından emin ol.
3. Terminalde klasörde:
	```
	git init
	git add .
	git commit -m "chore: proje dokümanları ve Claude Code kuralları"
	```

---

## 3. Skill ve plugin'leri kur

**Proje skill'leri (`paramnet-domain`, `paramnet-mobile`) için bir şey yapman gerekmiyor.** `.claude/skills/` klasöründe oldukları için Claude Code klasörü açınca otomatik görür.

Diğerleri internetten indirilip kurulur. Komutları **klasörün içinde, terminalde** çalıştır. `--scope project` ile kurulanlar `.claude/settings.json`'a yazılır; repo ile birlikte gider ve başka bilgisayarda da aynı set olur.

### 3.1 Şimdi kur (Faz S ve Faz 1)

```bash
# Anthropic resmi marketplace
claude plugin marketplace add anthropics/claude-plugins-official
claude plugin install supabase@claude-plugins-official --scope project
claude plugin install expo@claude-plugins-official --scope project
claude plugin install superpowers@claude-plugins-official --scope project
claude plugin install code-review@claude-plugins-official --scope project

# Callstack React Native
claude plugin marketplace add callstackincubator/agent-skills
claude plugin install react-native-best-practices@callstack-agent-skills --scope project

# Apple HIG ve Material Design (yalnızca ios ve android)
npx skills add ehmo/platform-design-skills --skill ios --agent claude-code
npx skills add ehmo/platform-design-skills --skill android --agent claude-code
```

- `npx skills` komutu nereye kurulacağını sorarsa: **Claude Code** ve **proje (project)** seç.
- Bir komut hata verirse (sürüm farkı olabilir), Claude Code içinde `/plugin` yazıp menüden aynı plugin'i bulup kurabilirsin.
- `--scope project` parametresi kabul edilmezse parametresiz kur (kullanıcı geneline kurulur, sorun değil).

### 3.2 Faz 2 başında kur

```bash
npx -y skills add tovimx/maestro-mobile-testing-skill --skill maestro-mobile-testing --agent claude-code
claude plugin install claude-security@claude-plugins-official --scope project
```

### 3.3 Faz 3 başında kur

```bash
npx skills add eronred/aso-skills --skill aso-audit --agent claude-code
npx skills add eronred/aso-skills --skill android-aso --agent claude-code
npx skills add eronred/aso-skills --skill metadata-optimization --agent claude-code
npx skills add eronred/aso-skills --skill screenshot-optimization --agent claude-code
npx skills add eronred/aso-skills --skill onboarding-optimization --agent claude-code
npx skills add eronred/aso-skills --skill rating-prompt-strategy --agent claude-code
npx skills add eronred/aso-skills --skill retention-optimization --agent claude-code
```
Claude Code içinde: `/plugin marketplace add trailofbits/skills` → `/plugin menu` → `supply-chain-risk-auditor` ve `insecure-defaults`.

### 3.4 Kurulumu doğrula

Claude Code'u klasörde aç (`claude`), sonra:
1. `/reload-plugins`
2. `/plugin` → kurulu plugin'ler listede mi?
3. Şunu yaz: **"Bu projede hangi skill'ler yüklü? Listele ve paramnet-domain ile paramnet-mobile skill'lerinin açıklamalarını göster."**

Supabase plugin'i ilk kullanımda Supabase hesabına giriş isteyebilir. Geliştirme yerel Supabase ile yapılır; uzak projeye işlem için Claude zaten senden onay isteyecek (CLAUDE.md kuralı).

> **Önemli:** `/init` komutunu **çalıştırma**. `CLAUDE.md` hazır; `/init` onu yeniden yazmaya çalışır.

---

## 4. Çalışma ritmi (planlı ilerleme)

Her görev aynı döngüden geçer:

```
Yeni oturum (/clear)  →  Plan modu  →  "Sıradaki görev" istemi
→  Claude plan sunar  →  Sen incelersin / düzeltirsin  →  Onay
→  Claude önce test, sonra kod yazar  →  Testleri çalıştırır
→  ROADMAP'i günceller  →  Rapor verir  →  Sen kontrol edersin
→  Commit onayı  →  Bitti
```

### Plan modu

Claude Code'da **Shift+Tab** ile modlar arasında geçilir. Alt satırda "plan mode" yazana kadar bas. Plan modunda Claude dosya değiştiremez, yalnızca okur ve plan sunar. Planı onaylayınca uygulamaya geçer.

İlk haftalarda "auto-accept edits" modunu kullanma; her dosya değişikliğini gör.

### Kurallar

- **Bir oturum = bir görev.** Görev bitince `/clear` ile temiz başla. Bağlam şişmez, Claude odaklı kalır.
- **Plan onaylanmadan kod yok.** Plan beğenmediğin bir şey içeriyorsa düzelttir, sonra onayla.
- **Büyük değişikliği kabul etme.** Bir görev 15–20 dosyadan fazlasını değiştiriyorsa böl dedirt.
- **Migration'ları sen oku.** Veritabanı değişiklikleri geri alınması en zor işlerdir.
- **Her görev sonunda commit.** Bir şey bozulursa bir önceki göreve dönebilirsin.
- **Yeni fikir gelirse** uygulatma, BACKLOG'a yazdır.

---

## 5. Hazır istemler (kopyala-yapıştır)

### 5.1 İlk oturum

```
Merhaba. Bu projede ilk oturumumuz.

1. CLAUDE.md, docs/ROADMAP.md ve docs/PRODUCT_SPEC.md'yi oku.
2. Yüklü skill ve plugin'leri listele; ROADMAP'te geçen ama yüklü olmayan bir skill varsa söyle.
3. Projeyi ve çalışma şeklini 10 maddeyi geçmeyecek şekilde özetle ki aynı şeyi anladığımızdan emin olalım.
4. Spec'te çelişkili, eksik veya belirsiz gördüğün noktaları listele.
5. S-01 görevi için plan sun. Kod yazma.
```

### 5.2 Standart görev (her oturumun başı)

```
docs/ROADMAP.md'deki sıradaki görevi al (veya: <GÖREV-ID> görevini al).
CLAUDE.md'deki çalışma şeklini uygula: ilgili spec bölümlerini ve skill'leri oku, planı sun, onayımı bekle.
```

### 5.3 Planı onaylarken

```
Plan onaylandı. Önce testleri yaz ve başarısız olduklarını göster, sonra uygula.
Bitince typecheck, lint ve testleri çalıştır, ROADMAP'i güncelle ve rapor ver. Commit'i ben onaylayacağım.
```

### 5.4 Faz kapısı

```
<FAZ> kapısı görevini yapacağız. Kabul kriterlerini tek tek kontrol et; her biri için nasıl doğruladığını (komut çıktısı veya test adı) göster.
Geçmeyen kriter varsa listele ve düzeltme planı sun. Kapı geçmeden sonraki faza geçmiyoruz.
Ayrıca docs/BACKLOG.md'yi gözden geçir ve önerilerini yaz.
```

### 5.5 Hata ayıklama

```
Şu hata var: <hata / ekran görüntüsü / adımlar>.
Düzeltmeye geçmeden önce kök nedeni bul: hatayı tekrar üreten bir test yaz, nedenini açıkla, sonra düzeltme planı sun.
```

### 5.6 Kapsam dışı fikir

```
Aklıma bir fikir geldi: <fikir>. Bunu şimdi uygulama; docs/BACKLOG.md'ye ekle ve hangi faza uygun olduğunu bir cümleyle yaz.
```

### 5.7 Spec değişikliği

```
Şu kararı değiştirmek istiyorum: <değişiklik>.
Önce etkisini analiz et: spec'te, ROADMAP'te, skill referanslarında ve mevcut kodda neler değişir? Onaylarsam
docs/PRODUCT_SPEC.md, ilgili skill referansları ve DECISIONS.md'yi güncelle.
```

### 5.8 Oturum ortasında yön kaybı

```
Dur. Şu ana kadar ne yaptın, görevin kabul kriterlerinden hangileri tamamlandı, hangileri kaldı? Kısa liste ver.
```

---

## 6. Önerilen sıra ve Faz 0 doğrulaması

ROADMAP, önce domain çekirdeğini (F1-01…F1-04), sonra sahte veriyle çalışan mobil prototipi (F1-05…F1-11) yaptırır. **F1-11 bitince prototipi telefonuna kurup 15–20 kullanıcı görüşmesini yap.** Görüşme sonuçlarına göre spec'i güncelle (istem 5.7), sonra gerçek backend'e (F1-12+) geç. Böylece backend'i doğrulanmamış bir akış için yazmamış olursun.

---

## 7. Sık karşılaşılan durumlar

| Durum | Ne yap |
|---|---|
| Claude kurala uymadı (ör. plan sunmadan kod yazdı) | "CLAUDE.md'deki çalışma şeklini tekrar oku ve ona uy." De, değişikliği geri aldır. |
| Skill devreye girmiyor | İstemde adını an: "paramnet-domain skill'ini kullanarak…" |
| Oturum çok uzadı, Claude karıştırıyor | Görevin durumunu ROADMAP'e not ettir, `/clear`, standart istemle devam et. |
| Spec ile kod çelişiyor | Claude sormalı; sormadıysa 5.7 istemini kullan. |
| Docker / Supabase başlamıyor | Docker Desktop açık mı? `pnpm supabase stop` sonra `start`. |
