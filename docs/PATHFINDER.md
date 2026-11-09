# Mars Base Pathfinder — teknik kılavuz (mentor için)

> **Soru:** *Where should humanity establish its first Mars research base, and why?*
> (İnsanlık ilk Mars araştırma üssünü nereye kurmalı ve neden?)
>
> Bu belge, oyunun her hesabının nereden geldiğini, hangi değerin gerçek veri, hangisinin model, simülasyon ya da varsayım olduğunu ve neyin henüz eksik olduğunu anlatır. Kod `src/pathfinder/` altında; arayüz `app/pathfinder/` altında.

**Bu deponun durumu.** Bu depo, OsirisZk Mars simülatörünün `v0.5.3-baseline` etiketli sürümünden türetilmiş, mentorun kişisel referans çalışmasıdır. NASA Space Apps 2026 teslimi değildir; yarışmada öğrenciler kendi depolarında, kendi commit'leriyle çalışır. Bu koddan yarışma deposuna kopya yapılırsa teslimde "Before the hackathon" altında beyan edilmelidir.

---

## 1. Çalıştırma

```bash
npm install
npm run dev:app            # tarayıcı: http://localhost:5173/pathfinder.html  (giriş sayfasında da kartı var)
npm run pathfinder         # başsız tam görev: reports/pathfinder/report.{en,tr}.md, data.csv, results.csv, mission.json
npm test                   # tüm testler (eski simülatörün testleri + Pathfinder testleri)
npm run build              # dist/ (iki sayfa: index.html ve pathfinder.html)
```

Arayüz İngilizce açılır, sağ üstten Türkçe seçilir (seçim simülatörlerle ortaktır).

## 2. Oyun döngüsü ve kod

| Adım | Ne olur | Kod |
|---|---|---|
| 1 Bütçe | 100 M USD; dron 25 + kamera 10 + standart enerji 15 + altyapı 20 = 70 M, kalan 30 M (temsili) | `design.js` → `budget()` |
| 2 Dron | Rotor yarıçapı, batarya, kamera, gövde seçilir; kütle, itki/ağırlık, güç, enerji, menzil her bölgenin havasında hesaplanır | `design.js` → `deriveVehicle()`, `validation.js` |
| 3 Bölgeler | 5 aday arasından 3 seçilir; her değer kaynağıyla görünür; varsayımlar düzenlenir; veri içe aktarılır | `sites.js`, `environment.js`, `adapters/` |
| 4 Güzergâh | Biçerdöver (lawnmower) tarama: alan, yükseklik, hız, bindirmeler; GSD, şerit, fotoğraf sayısı, enerji | `route.js`, `validation.js` |
| 5 Keşif | Her bölgede Rapier ile otonom uçuş (240 Hz), kamera çizgiler boyunca çeker | `survey.js` (tarayıcıda `app/pathfinder/worker.js`) |
| 6 Veri | Dron ölçümü (güvenli iniş alanı) NASA/model/varsayım değerleriyle aynı tabloda birleşir | `photogrammetry.js`, `decision.js` → `attachSurvey()` |
| 7 Karşılaştır | Önce zorunlu güvenlik koşulları, sonra TOPSIS; ağırlıklar kaydırıcı ya da AHP ile | `safety.js`, `mcdm.js`, `decision.js` |
| 8 Öneri | Kazanan, nedenleri, duyarlılık aralıkları, Monte Carlo sağlamlığı | `mcdm.js` → `sensitivity()`, `monteCarlo()`, `explain()` |
| 9 Rapor | Sorunun cevabı sayılarla; Markdown, CSV, JSON, veri paketi | `report.js` |

## 3. Mevcut simülatöre dokunulan yerler

Brief "mevcut simülatörü bozma" diyor; değişiklikler yalnız ekleme ve geriye uyumlu:

- `src/vehicles/presets.js`: `registerVehicle()` — türetilmiş araçlar çalışma anında kaydedilir; hazır araçlar dondurulmuş ve değişmemiş kalır.
- `src/aero/rotors.js`: `registerRotor()` — ölçeklenmiş rotorlar için aynı mantık.
- `src/vehicles/build.js`: rotor yarıçapı `ROTORS[...]` yerine `getRotor(...)` ile okunur (kayıtlı rotorları da bulsun diye).
- `app/landing.js`, `app/index.html`: giriş sayfasına Pathfinder kartı.
- `app/vite.config.js`: iki sayfalı derleme; `app/public/_redirects`: `/pathfinder` kısa bağlantısı.
- `package.json`: ad/sürüm, `geotiff` artık çalışma bağımlılığı (tarayıcıda raster okumak için), iki yeni komut.

Görev yürütücüsü (`Mission.js`), fizik, kontrol, arazi, sahne ve Dünya/Mars simülatörleri değişmedi; eski testlerin hepsi geçiyor.

## 4. Veri kökeni: her sayı bir "datum"

`src/pathfinder/provenance.js`. Her değer şu alanlarla taşınır: değer, birim, **tür**, kaynak, çözünürlük, tarih, belirsizlik (1σ), koordinat sistemi, işleme adımları, not, gerekçe.

| Tür | Anlamı | Örnek |
|---|---|---|
| `nasa` | Kullanıcının içe aktardığı NASA (ya da ortak ajans) verisi | SWIM GeoTIFF'inden örneklenen buz tutarlılığı |
| `published` | Yayında ya da resmî sayfada basılı sayı | Perseverance iniş koordinatları |
| `model` | Bu koddaki fiziksel modelin hesabı | Yıllık güneş enerjisi, basınç |
| `simulation` | Simüle dronun simüle arazide ölçtüğü | Güvenli iniş alanı oranı |
| `synthetic` | Gerçek yeri anlatma iddiası olmayan örnek | Test tablosundaki değerler |
| `assumption` | Gerekçesi yazılı takım varsayımı; oyuncu değiştirebilir | Buz indeksi, bilim puanı |

Kurallar (kodda zorunlu):
- Türü olmayan değer oluşturulamaz; belirsizlik negatif olamaz.
- Yalnız `assumption` elle değiştirilebilir; diğerleri ancak veri içe aktararak değişir.
- Bir ölçütte bölgeler farklı türde değerlerle karşılaştırılıyorsa karar ekranı ve rapor uyarır ("aynı ölçütte farklı türde değerler").
- Bir ölçüt mevcut veriyle bölgeleri ayırmıyorsa (hepsi eşit) bu da yazılır (şu an toz).
- Buz indeksi hiçbir zaman `simulation` türünde olamaz (testle güvence altında).

## 5. Aday bölgeler

`src/pathfinder/sites.js`. Koordinat türleri: Jezero, Gale, Utopia/Zhurong iniş noktaları **yayımlanmış**; Arcadia ve Mawrth için bölge içinde seçilmiş **temsilî nokta (varsayım)**.

| Bölge | Enlem, boylam (°D) | Yükseklik (varsayım) | Buz indeksi (varsayım) | Bilim (varsayım) | Gerekçe özeti |
|---|---|---|---|---|---|
| Jezero | 18.44, 77.45 (yayın) | −2600 ± 300 m | 0.10 ± 0.20 | 9 | Ekvatora yakın; sığ buz beklenmez; delta, numune deposu |
| Gale | −4.59, 137.44 (yayın) | −4500 ± 300 m | 0.05 ± 0.20 | 8 | Ekvatoral; Sharp Dağı katmanları |
| Arcadia Planitia | 42.0, 192.0 (temsilî) | −3500 ± 400 m | 0.85 ± 0.15 | 6 | Piqueux 2019: bazı kesimlerde buz ~30 cm derinde |
| Mawrth Vallis | 22.6, 343.5 (temsilî) | −2500 ± 400 m | 0.15 ± 0.20 | 8 | Kalın kil katmanları; 2015 Keşif Bölgesi önerisi |
| Utopia (Zhurong) | 25.07, 109.93 (yayın) | −4100 ± 300 m | 0.25 ± 0.20 | 6 | Orta enlem buz birikimlerinin güneyi |

Toz optik derinliği her bölgede τ = 0.5 ± 0.2 (varsayım): bölgeye özel toz iklimi içe aktarılana kadar bu ölçüt bölgeleri ayırmaz. Bunu bilerek böyle bıraktık; uydurma bir fark koymadık.

**Yerel arazi (sentetik).** Dronun uçtuğu 300 m × 300 m arazi her bölge için `ProceduralTerrain` ile üretilir (0,59 m ızgara). Rölyef, ≥ 10 m krater yoğunluğu ve Golombek kaya bolluğu k **takım varsayımıdır** (düz ova → az rölyef/kaya; katmanlı arazi → engebeli). Gerçek eğim için bir HiRISE DTM `tools/import-dtm.mjs` ile yüklenip `runSurvey(…,{terrain})` olarak verilebilir.

| Bölge | Rölyef (m) | Krater/km² | Kaya k |
|---|---|---|---|
| Jezero | 5 | 60 | 0.08 |
| Gale | 4.5 | 50 | 0.09 |
| Arcadia | 2.5 | 30 | 0.03 |
| Mawrth | 7.5 | 50 | 0.07 |
| Utopia | 3.5 | 40 | 0.05 |

## 6. Bölge modelleri (`environment.js`)

- **Güneş enerjisi:** Mars24 Güneş konumu (mevcut `time.js`), bir Mars yılı boyunca 67 sol, sol içinde 15 dakikalık adım; yatay yüzeyde doğrudan ışın `I0 μ exp(−τ/μ)` + varsayılan saçılmış ışık (mevcut `solar.js`). Sonuç Wh/m²/sol, ±%15.
- **Sıcaklık:** ışınım dengesi `T = ((1 − A)·Ī / (ε σ))^¼`, A = 0,25, ε = 0,95 (varsayım); sera etkisi ve termal eylemsizlik yok, ±15 K.
- **Basınç (ulaşım ölçütü):** `p = 636 Pa · exp(−h / 11,1 km)` (NASA Mars Fact Sheet: ortalama yarıçapta 6,36 mb, ölçek yüksekliği 11,1 km). Alçak yer = iniş için daha çok atmosfer, aynı zamanda daha kalın radyasyon kalkanı (gösterge, doz değil).
- **Uçuş havası:** yıllık ortalama basınç ve yıllık ortalama sıcaklık + 20 K (geç sabah uçuşu, varsayım) → yoğunluk. Uçuş yerel saat 11:00'de (`utcForLocalTime`).

Varsayılan senaryoda: Jezero 3232 Wh/m²/sol, 206,7 K, 804 Pa; Arcadia 2536, 194,5 K, 872 Pa; Mawrth 3142, 205,2 K, 797 Pa.

**Model kontrolü (Jezero):** basınç modeli 804 Pa, MEDA'nın yayımlanmış sol ortalamaları 625–761 Pa (model ~%6–25 yüksek: Fact Sheet sabiti ortalama yarıçaba göre, Jezero yüksekliği de yaklaşık). Sıcaklık modeli 206,7 K, MEDA hava sıcaklığı aralığı 190–250 K içinde. Rapor bu karşılaştırmayı her seferinde yazar.

## 7. Dron tasarımı, bütçe ve doğrulama

Taban: mevcut `osiris-mars-quad` kavram aracı (tüm değerleri varsayım). Seçenekler (`design.js`):

| Seçim | Seçenekler | Ek maliyet (M USD, temsili) |
|---|---|---|
| Rotor | 0,45 / 0,50 (standart) / 0,55 / 0,60 m | 0 / 0 / 3 / 6 |
| Batarya | 6S2P (standart) / 6S3P / 6S4P | 0 / 5 / 9 |
| Kamera | Standart 13 MP / 20 MP 1" / 12 MP global deklanşör haritalama | 0 / 4 / 7 |
| Gövde | Karbon / altıgen hücre / C60 kafes | 0 / 1 / 2 |

Ölçekleme kuralları (varsayım, kodda yazılı): rotor c/R dağılımı korunur; pal kütlesi ∝ R², rotor ataleti ∝ R⁴; kollar komşu rotorlar arasında %5 boşluk kalacak kadar uzar (kol ≥ 1,485 R); batarya aynı hücrelerle paralel sayısı artar; kamera 0,20 kg bilim kamerasının yerini alır, gücü aviyonik yüküne eklenir. Standart kameranın piksel sayısı Ingenuity basın kitinden (13 MP); diğer kamera değerleri varsayım.

**Doğrulama** (`validation.js`), uçuşun kullanacağı aynı araç modeli ve kontrol trimiyle, her bölgenin kendi hava yoğunluğunda:
- bütçe ≤ 100 M; aşılırsa hata;
- en büyük itki < ağırlık → "Your drone cannot take off…" (Türkçesiyle) + düzeltme önerileri (rotoru büyüt, kütleyi azalt, daha alçak bölge);
- itki/ağırlık < 1,3 → uyarı (varsayılan pay);
- enerji: planlanan enerji > bataryanın %15 yedekten sonra verebileceği → hata + öneriler (alanı küçült, yüksekten uç, yan bindirmeyi azalt, büyük batarya);
- menzil ve hareket bulanıklığı.

**Kalibrasyon notu:** mevcut planlama tahmini (`energyBudget`) çizgi sonlarında yavaşlama-durma-dönüş süresini içermiyor. Simülatöre karşı ölçtük (2–6 m/sn): ara nokta başına ≈ 3,5 sn + her m/sn için 2 sn, asılı kalma gücünde. Bu eklenince 80 m taramada plan 66,2 Wh, uçuş 65,8 Wh (Jezero).

Varsayılan tasarımla: kütle 2,98 kg; itki/ağırlık Jezero 1,48, Arcadia 1,72, Mawrth 1,47; asılı güç ≈ 450–500 W. Rotor boyunun etkisi (aynı batarya ve kamera; itki aynı devirde kabaca R⁴ ile büyür):

| Rotor | kütle kg | T/W Jezero | T/W Arcadia | T/W Mawrth | sonuç |
|---|---:|---:|---:|---:|---|
| 0,45 m | 2,89 | 0,97 | 1,13 | 0,97 | Jezero ve Mawrth'ta kalkamaz → hata mesajı; Arcadia'da pay uyarısı |
| 0,50 m | 2,98 | 1,48 | 1,72 | 1,47 | geçer |
| 0,55 m | 3,11 | 2,14 | 2,49 | 2,13 | geçer (+3 M) |
| 0,60 m | 3,25 | 2,99 | 3,49 | 2,99 | geçer (+6 M) |

Arcadia'daki fark havadan gelir: daha alçak (−3,5 km) ve daha soğuk olduğu için yoğunluk 0,0213 kg/m³, Jezero ve Mawrth'ta 0,0185 kg/m³.

## 8. Güzergâh (`route.js`)

```
şerit   W = 2 H tan(FOV_enine / 2)          çizgi aralığı  s = W (1 − yan bindirme)
iz boyu L = 2 H tan(FOV_boyuna / 2)         fotoğraf aralığı (stereo taban) B = L (1 − ileri bindirme)
GSD = H · piksel aralığı / odak uzaklığı    bulanıklık = v · t_poz / GSD   (t_poz 1/1000 sn; global deklanşör 1/2000 sn, varsayım)
```

Varsayılan: 80 m × 80 m, 20 m yükseklik, 4 m/sn, %60 yan / %75 ileri bindirme → 9 çizgi, ≈ 144 fotoğraf, GSD 6,6 mm/piksel, B/H 0,26, 913 m güzergâh.

## 9. Keşif uçuşu (`survey.js`)

Mevcut `Simulation` aynen kullanılır: Rapier katı cismi 240 Hz, bölge havasında rotor aerodinamiği, motor ve batarya modelleri, otonom görev yürütücüsü (Dünya'dan komut dakikalar geç gelirdi). Eklenen tek parça kamera tetikleyicisidir: dron bir tarama çizgisi üzerindeyken, eğimi ≤ 15° ve yüksekliği planın ±%30'u içindeyken, son fotoğraftan `B` metre uzaklaştıkça çeker. Uçuş tarayıcıda Web Worker içinde başsız koşar (3 bölge ≈ 40 sn); arayüz kaydedilen izle 3B tekrar oynatır.

Varsayılan senaryo: üç uçuş da tamamlandı, ≈ 477 sn, 60–66 Wh; Mawrth'ta engebe yüzünden 128 fotoğraf (diğerlerinde 144).

## 10. Fotogrametri (`photogrammetry.js`)

1 m ızgara; ≥ 2 fotoğrafın gördüğü hücre stereo kabul edilir ve yükseklik alır.

- **Yükseklik hassasiyeti (normal durum stereo):** `σZ = (H / B) · GSD · σpx` (σpx eşleştirme hassasiyeti, kamera özelliği, varsayım: 0,5 / 0,4 / 0,3 piksel).
- **Eğim:** yeniden kurulan yüksekliklerden 2 m tabanda merkezi farklar.
- **Kaya:** en az 3 piksel genişliğindeyse (D ≥ 3 GSD) ve ≥ 1 fotoğrafta görüldüyse bulunur.
- **Güvenli hücre:** eğim ≤ 10° ve D ≥ 0,5 m kayanın D/2 + 0,5 m yakınında olmamak (eşikler varsayım).
- **Belirsizlik:** örnekleme hatası (5 m korelasyon uzunluğu varsayımıyla etkin hücre sayısı) ⊕ eşik hatası (sınırın 2σ yakınındaki hücrelerin yarısı yön değiştirebilir).
- **Doğrulama:** arazi sentetik olduğu için gerçeği bilinir; aynı hesap gürültüsüz ve tüm kayalarla da yapılır ("truth"). Varsayılan senaryoda ölçüm/gerçek: Jezero 75,4 / 75,7 %, Arcadia 96,3 / 96,5 %, Mawrth 44,0 / 44,2 %; DEM hatası σZ ile uyumlu (≈ 13 mm). Bu satır Mars'ı değil **yöntemi** doğrular.

**Dronun ölçemedikleri:** yer altı buzu, radyasyon, yıllık sıcaklık, toz iklimi. Bunlar asla `simulation` türünde gösterilmez; yalnız NASA verisi, model ya da varsayım olabilir.

## 11. Zorunlu güvenlik koşulları (`safety.js`)

Ağırlıklandırmadan önce kontrol edilir; geçemeyen bölge sıralamaya hiç girmez:

| Kural | Eşik | Tür |
|---|---|---|
| Enlem | |φ| ≤ 50° | yayın (NASA 2015 Keşif Bölgesi kılavuzu) |
| Yükseklik | ≤ −1 km | varsayım (ağır iniş araçları kalın hava ister) |
| Dronla tarandı | uçuş tamamlandı ve stereo kapsama ≥ %60 | varsayım |
| Güvenli zemin | güvenli alan ≥ %50 | varsayım |

Varsayılan senaryoda Mawrth Vallis (%44) son kuraldan kalır.

## 12. Karar matematiği (`mcdm.js`)

**TOPSIS** (Hwang & Yoon 1981):
1. `r_ij = x_ij / √(Σ_i x_ij²)` (vektör normalizasyonu)
2. `v_ij = w_j r_ij` (Σw = 1)
3. her ölçütte ideal `v⁺` (fayda: en büyük; maliyet: en küçük) ve en kötü `v⁻`
4. `D_i^± = √(Σ_j (v_ij − v_j^±)²)`
5. `C_i = D_i⁻ / (D_i⁺ + D_i⁻)`; en büyük C birinci. Birinciler eşitse kazanan yok sayılır.

Elle çözülmüş örnek (testte): X = [[1,4],[3,2],[2,3]], w = [0,5; 0,5] → C = [0,410; 0,590; 0,500], sıra 2 > 3 > 1.

**AHP** (Saaty): ikili karşılaştırma matrisinin baş özvektörü (kuvvet yinelemesi), λmax, CI = (λmax − n)/(n − 1), CR = CI/RI; CR < 0,1 kabul. Ders kitabı matrisi [[1,3,5],[1/3,1,3],[1/5,1/3,1]] → ağırlıklar 0,637 / 0,258 / 0,105, CR ≈ 0,033 (testte). Arayüzde 21 çift için 1–9 ölçeği; CR ≥ 0,1 iken ağırlıklar kullanılamaz.

**Duyarlılık:** bir ağırlık 0 → 1 süpürülür, diğerleri oranları korunarak ölçeklenir; kazananın birinci kaldığı aralık ve aralık dışında kimin kazandığı raporlanır.

**Monte Carlo (tohumlu, tekrarlanabilir):** (a) ağırlıklar simplekste düzgün dağılımla (Dirichlet(1)), (b) veriler kendi belirsizlikleri içinde normal dağılımla, (c) ikisi birden; kazananın birinci kaldığı çekiliş payı.

Varsayılan sonuç: **Arcadia Planitia**, C = 0,780 (Jezero 0,220; Mawrth güvenlikten elendiği için sıralamada yok). Neden: su buzu erişimi (+0,193), iniş güvenliği (+0,034); aleyhine bilim değeri (−0,050) ve güneş (−0,024). Ağırlıklar rastgele olunca %74, veri belirsizliğiyle %99, ikisiyle %70 çekilişte birinci.

| Ölçüt (şimdiki ağırlık) | Arcadia'nın birinci kaldığı aralık | aralık dışında |
|---|---|---|
| Su buzu (0,22) | 0,06 – 1,00 | Jezero |
| İniş güvenliği (0,20) | 0,00 – 1,00 | — |
| Güneş (0,14) | 0,00 – 0,56 | Jezero |
| Sıcaklık (0,08) | 0,00 – 0,82 | Jezero |
| Toz (0,08) | 0,00 – 0,99 | 1,00'da bölgeler eşit (toz onları ayırmıyor) |
| Bilim (0,18) | 0,00 – 0,46 | Jezero |
| Ulaşım (0,10) | 0,00 – 1,00 | — | **Uyarı:** buz indeksi ve bilim puanı şu an varsayım; SWIM verisi içe aktarılınca sonuç değişebilir. Bu yüzden cevap "bu verilerle" verilir.

## 13. Veri içe aktarma

Arayüzde 3. adım "Veri içe aktar" ya da komut satırında araç.

- **CSV / JSON / GeoJSON** (`adapters/tables.js`): ayraç otomatik (`,` `;` sekme), ondalık virgül, tırnaklı alanlar; GeoJSON boylamları doğu 0–360'a çevrilir.
- **Alan eşleştirme** (`adapters/mapping.js`): her sütun için hedef (buz, yükseklik, τ, bilim, güneş, sıcaklık, basınç), tür, kaynak, tarih, ölçek/kaydırma, belirsizlik sütunu. Satırlar bölgeye ad/kimlikle ya da en yakın noktaya (km sınırıyla) eşlenir. "NASA verisi" türü kaynak yazılmadan kabul edilmez. Hiçbir şey sessizce içe alınmaz.
- **GeoTIFF** (`adapters/raster.js`): coğrafi (derece) ya da eşdikdörtgen (metre, Mars küresi R = 3 396 190 m) koordinatlar; bölgede en yakın piksel ya da yarıçap içindeki piksellerin ortalaması ± standart sapması. Dönüşüm: `swimConsistency` (c ∈ [−1, 1] → (c + 1)/2), `kmToM`.
- **Veri paketi:** içe aktarmaların taşınabilir hâli (`osiriszk-pathfinder-data/1`), kaynak alanlarıyla birlikte.

NASA verisini evde örneklemek (dosyalar büyük, depoda yok):

```bash
# SWIM buz tutarlılığı (https://swim.psi.edu/SWIM4MIMProducts.php)
node tools/sample-rasters.mjs --raster SWIM_ice_consistency.tif --key ice --transform swimConsistency \
     --unit index --source "SWIM ice consistency (PSI/JPL)" --date 2021 --radius 10 --out data/swim.json
# MOLA yükseklik (USGS Mars MGS MOLA DEM 463 m, eşdikdörtgen metre)
node tools/sample-rasters.mjs --raster Mars_MGS_MOLA_DEM_mosaic_global_463m.tif --key elevation --unit m \
     --source "MGS MOLA DEM 463 m (USGS/NASA)" --radius 5 --out data/mola.json
```

Çıkan JSON'u arayüzde "Veri içe aktar" ile yükleyin; değerler `nasa` türüyle, dosya adı, piksel boyu, örnekleme yarıçapı ve koordinat sistemiyle görünür. Yükseklik değişince basınç ve uçuş yoğunluğu da yeniden hesaplanır (taramayı yeniden uçmak gerekir; arayüz bunu söyler).

**Önemli:** raster koordinat sistemini GeoKey'lerden okuyoruz. Dosyanın meta verisi eksikse sonuç yanlış yere düşebilir; önce bilinen bir noktada (örneğin Jezero için yayımlanmış yükseklik) kontrol edin.

## 14. Rapor ve dışa aktarma

Rapor İngilizce ve Türkçe üretilir; başlıklar, tablolar ve açıklamalar iki dildedir, ama kaynak başlıkları ve her değerin gerekçe/işleme notları (kataloğun içindeki metinler) İngilizce kalır, çünkü atıf yapılan yayınlarla aynı dilde tutuldular. Rapor (`report.js`) sırasıyla: cevap (kazanan, C değerleri, nedenler, sağlamlık, neye dayandığı), bütçe, dron, bölgelerin verileri ve her değerin kaynağı, uçuşlar, güvenlik elemesi, karar matrisi ve TOPSIS adımları, model kontrolleri, varsayımlar ve sınırlar, kaynaklar. Cevap metnindeki hiçbir şey sabit yazılmaz; hepsi hesaptan gelir. Dışa aktarma: Markdown, kaynaklı veri CSV, sonuç CSV, tüm görev JSON, veri paketi.

## 15. Testler

`tests/pathfinder-core.test.js` (Rapier'siz), `tests/pathfinder-adapters.test.js`, `tests/pathfinder-mission.test.js` (Rapier ile). Başlıcaları:

- TOPSIS ve AHP elle çözülmüş örneklerle; duyarlılık geçiş noktası; eşitlik "kazanan yok"; Monte Carlo tekrarlanabilir.
- Her katalog değeri türlü; yayımlanmış değerlerin kaynağı var; varsayımların gerekçesi var; buz asla dron ölçümü değil.
- Bütçe: 100 M, 70 M taban, 30 M kalan; seçenek maliyetleri.
- Güzergâh geometrisi, GSD, bulanıklık uyarısı.
- Doğrulama mesajları: kalkamama, enerji yetmezliği, sayılarıyla ve önerileriyle.
- Gerçek uçuş: otonom tamamlanır, fotoğraflar çizgide, stereo kapsama > %80, DEM hatası σZ ile uyumlu, ölçülen güvenli alan gerçeğe ±5 puan içinde.
- Enerji bitince görev sonlanır.
- Tam döngü: güvenlikten kalan sıralanmaz, sonuç tekrarlanabilir, tüm ağırlık bilime verilince en yüksek bilim puanlı bölge kazanır, rapor soruyu sayılarla cevaplar.
- CSV / JSON / GeoJSON / GeoTIFF (coğrafi ve eşdikdörtgen) içe aktarma, veri paketi gidiş-dönüş.

## 16. Varsayımlar ve sınırlar (dürüst liste)

1. Tüm para değerleri temsili oyun maliyetleridir.
2. Yerel arazi sentetiktir (DTM yüklenmedikçe); güvenli alan sayısı yöntemi sınar, gerçek bölgeyi değil.
3. Buz indeksi, toz τ, bilim puanı ve yükseklikler NASA rasterleri içe aktarılana kadar gerekçeli varsayımdır.
4. Güneş, sıcaklık, basınç birinci dereceden modeldir (±%15), iklim verisi değildir.
5. TOPSIS ölçütleri bağımsız sayar; güneş, sıcaklık ve toz fiziksel olarak bağlıdır (Güneş birden çok kez sayılır).
6. Üç bölgeyi tek dron tasarımıyla taramak oyun basitleştirmesi: gerçek kampanyada her bölgeye ayrı iniş gerekir.
7. Gövdelerin yapısal analizi yok; kütle ve atalet uygulanır, dayanım iddia edilmez.
8. Fotogrametri modeli ideal: tek tip doku, aydınlatma ve gölge etkisi yok; gürültü hücreler arasında bağımsız.
9. Haberleşme ölçütü yalnız atmosfer (iniş) üzerinden; röle yörüngesi kapsaması modellenmedi (tüm adaylar için Dünya bağlantı süresi aynı).
10. Radyasyon ölçüt değil; yalnız atmosfer kolonu göstergesi var. Gerçek doz için MSL RAD gibi ölçümler gerekir.

## 17. Kaynaklar

`src/pathfinder/sources.js` içindeki liste raporun sonuna otomatik eklenir: Perseverance/Curiosity/Zhurong koordinatları, NASA 2015 Keşif Bölgesi çalıştayı (The Planetary Society), Piqueux ve diğ. 2019 (GRL), SWIM veri ürünleri (PSI/JPL), MOLA MEGDR (PDS), HiRISE DTM, NASA Mars Fact Sheet, MEDA (Sánchez-Lavega ve diğ. 2023), Mars24 (Allison & McEwen 2000), Appelbaum & Flood (1989), Golombek & Rapp (1997), Hwang & Yoon (1981), Saaty (1987), Ingenuity basın kiti.
