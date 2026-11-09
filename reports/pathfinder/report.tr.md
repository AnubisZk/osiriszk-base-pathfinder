# Mars Base Pathfinder — görev raporu

*Oluşturuldu: 2026-11-09T08:33:49.861Z · OsirisZk · maliyetler temsili oyun değerleridir; sentetik arazi ve varsayımlar etiketlidir*

## Cevap: “Where should humanity establish its first Mars research base, and why?”

**Arcadia Planitia** — TOPSIS yakınlık katsayısı C = 0.780; sonraki: Jezero Krateri C = 0.220.

**Neden** (ağırlıklı, normalize üstünlük; karşısında Jezero Krateri):

- Su buzu erişimi: 0.85 ± 0.15 *(varsayım)* karşı 0.10 ± 0.20 *(varsayım)* index 0–1 → lehine (0.193)
- Bilimsel araştırma değeri: 6.00 ± 1.00 *(varsayım)* karşı 9.00 ± 1.00 *(varsayım)* 1–9 → aleyhine (-0.050)
- Eğim ve iniş güvenliği: 96.33 ± 2.98 *(simülasyon)* karşı 75.38 ± 7.39 *(simülasyon)* % → lehine (0.034)
- Güneş enerjisi potansiyeli: 2536 ± 380.41 *(model)* karşı 3232 ± 484.73 *(model)* Wh/m²/sol → aleyhine (-0.024)

**Ne kadar sağlam**: her ağırlık şu aralıkta değiştikçe kazanan birinci kalıyor:

- Su buzu erişimi (şimdi 0.22): 0.06 – 1.00; dışında: Jezero Krateri
- Eğim ve iniş güvenliği (şimdi 0.20): 0.00 – 1.00
- Güneş enerjisi potansiyeli (şimdi 0.14): 0.00 – 0.56; dışında: Jezero Krateri
- Sıcaklık (şimdi 0.08): 0.00 – 0.82; dışında: Jezero Krateri
- Toz ve rüzgâr riski (şimdi 0.08): 0.00 – 0.99; dışında: Jezero Krateri
- Bilimsel araştırma değeri (şimdi 0.18): 0.00 – 0.46; dışında: Jezero Krateri
- Ulaşım ve haberleşme (şimdi 0.10): 0.00 – 1.00

Tohumlu Monte Carlo (2000 çekiliş): rastgele ağırlıklar 74 %, belirsizlik içindeki veri 99 %, ikisi birden 70 % çekilişte bu bölge birinci kalıyor.

**Neye dayanıyor**: 3 × Kullanıcı varsayımı, 1 × Dron simülasyonu, 3 × Model hesabı. Varsayımlar değiştirilebilir, NASA verisi içe aktarılabilir; karar yeniden hesaplanır.

*Mevcut veriyle bölgeleri ayırt etmeyen ölçütler: Toz ve rüzgâr riski.*

## 1. Görev bütçesi (temsili)

| Kalem | M USD |
|---|---:|
| Mars keşif dronu (gövde, motorlar, aviyonik) | 25 |
| Kamera (standart) | 10 |
| Enerji sistemi (standart batarya + güneş paneli) | 15 |
| Görev altyapısı (iniş platformu payı, röle, operasyon) | 20 |
| **Toplam** | **70** |
| 100 içinden kalan | 30 |

*Temsili oyun maliyetleridir; gerçek görev tahmini değildir.*

## 2. Keşif dronu

- Rotor: r50 · batarya: b2 · kamera: Standart 13 MP renkli (Ingenuity sınıfı) · gövde: carbon
- Kamera: 4208 × 3120 px, 1.12 µm, f = 3.4 mm, 0.2 kg, 3 W, σpx 0.5 (standart kameranın piksel sayısı Ingenuity basın kitinden; gerisi varsayım)
- Yalnız kütle, kütle merkezi, atalet ve sürükleme. Yapısal dayanım simüle edilmez: sonlu elemanlar analizi (FEA) ve test gerekir.

| Bölge | kütle kg | ρ kg/m³ | T/W | asılı W | planlanan enerji Wh | kullanılabilir Wh | menzil m | kontroller |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Jezero Krateri | 2.98 | 0.0185 | 1.48 | 498 | 66.2 | 82.6 | 2448 | ✓ |
| Arcadia Planitia | 2.98 | 0.0213 | 1.72 | 450 | 59.8 | 82.6 | 2714 | ✓ |
| Mawrth Vallis | 2.98 | 0.0185 | 1.47 | 496 | 66.0 | 82.6 | 2455 | ✓ |

## 3. Aday bölgeler ve verileri

| Ölçüt | Jezero Krateri | Arcadia Planitia | Mawrth Vallis |
|---|---|---|---|
| Su buzu erişimi (index 0–1, yüksek iyi) | 0.10 ± 0.20 *(varsayım)* | 0.85 ± 0.15 *(varsayım)* | 0.15 ± 0.20 *(varsayım)* |
| Eğim ve iniş güvenliği (%, yüksek iyi) | 75.38 ± 7.39 *(simülasyon)* | 96.33 ± 2.98 *(simülasyon)* | 43.98 ± 7.36 *(simülasyon)* |
| Güneş enerjisi potansiyeli (Wh/m²/sol, yüksek iyi) | 3232 ± 484.73 *(model)* | 2536 ± 380.41 *(model)* | 3142 ± 471.34 *(model)* |
| Sıcaklık (K, yüksek iyi) | 206.67 ± 15.00 *(model)* | 194.52 ± 15.00 *(model)* | 205.23 ± 15.00 *(model)* |
| Toz ve rüzgâr riski (τ, düşük iyi) | 0.50 ± 0.20 *(varsayım)* | 0.50 ± 0.20 *(varsayım)* | 0.50 ± 0.20 *(varsayım)* |
| Bilimsel araştırma değeri (1–9, yüksek iyi) | 9.00 ± 1.00 *(varsayım)* | 6.00 ± 1.00 *(varsayım)* | 8.00 ± 1.00 *(varsayım)* |
| Ulaşım ve haberleşme (Pa, yüksek iyi) | 803.87 ± 120.58 *(model)* | 871.76 ± 130.76 *(model)* | 796.66 ± 119.50 *(model)* |
| latitude | 18.445 *(yayın)* | 42.000 ± 0.000 *(varsayım)* | 22.600 ± 0.000 *(varsayım)* |
| longitude | 77.451 *(yayın)* | 192.000 ± 0.000 *(varsayım)* | 343.500 ± 0.000 *(varsayım)* |
| elevation | -2600 ± 300 *(varsayım)* | -3500 ± 400 *(varsayım)* | -2500 ± 400 *(varsayım)* |

**Her değerin kaynağı**

*Jezero Krateri*

- **ice**: 0.10 ± 0.20 *(varsayım)* — kaynak: —; gerekçe: 18° N: near-surface ice is not expected this close to the equator (ez2015, piqueux2019); water would come from hydrated minerals
- **safeArea**: 75.38 ± 7.39 *(simülasyon)* — kaynak: drone survey; çözünürlük: 1 m grid · GSD 6.8 mm/px · 144 photos; adımlar: stereo heights from photo pairs, σZ = (H/B)·GSD·σpx = 13.7 mm → slope over 2 m ≤ 10° and no rock ≥ 0.5 m (rocks seen when ≥ 3 px) → uncertainty: sampling 2.8 % ⊕ threshold 6.9 %; Measured over the SYNTHETIC terrain of this site (assumed relief and rocks); load a DTM for real slopes
- **solar**: 3232 ± 484.73 *(model)* — kaynak: Allison & McEwen (2000), Mars24 solar time algorithm (NASA GISS); adımlar: Sun position over one Mars year (Mars24), latitude 18.44° (published) → beam exp(−τ/μ) + assumed diffuse term, τ = 0.50 (assumption) → mean over 67 sampled sols, 15-min steps; ±15 %: diffuse-light shape and dust season not resolved
- **temperature**: 206.67 ± 15.00 *(model)* — kaynak: NASA Mars Fact Sheet (NSSDCA); adımlar: radiative balance T = ((1 − A)·Ī / (ε σ))^¼ with A = 0.25, ε = 0.95 (assumed) → Ī = 131.0 W/m² from the insolation model; Annual mean surface temperature; no atmosphere greenhouse, no thermal inertia (±15 K)
- **dust**: 0.50 ± 0.20 *(varsayım)* — kaynak: —; gerekçe: No site-specific dust climatology imported: global annual mean τ ≈ 0.5 assumed at every site, so this criterion does not separate the sites until data are imported
- **science**: 9.00 ± 1.00 *(varsayım)* — kaynak: —; gerekçe: Delta and lake sediments with organics potential; Perseverance cached samples; MEDA weather record
- **pressure**: 803.87 ± 120.58 *(model)* — kaynak: NASA Mars Fact Sheet (NSSDCA); adımlar: p = 636 Pa · exp(−h / 11.1 km), h = -2600 m (assumption); Annual mean; seasonal swing about ±25 % (Fact Sheet 4.0–8.7 mb)
- **latitude**: 18.44 *(yayın)* — kaynak: NASA GISS, Mars lander missions (coordinates of Mars landing sites), via Wikipedia "Octavia E. Butler Landing"
- **elevation**: -2600 ± 300.00 *(varsayım)* — kaynak: —; gerekçe: Approximate; replace with a MOLA MEGDR sample (raster adapter)

*Arcadia Planitia*

- **ice**: 0.85 ± 0.15 *(varsayım)* — kaynak: —; gerekçe: Piqueux et al. 2019: ice within ~30 cm of the surface in parts of Arcadia Planitia, "the most tempting target"
- **safeArea**: 96.33 ± 2.98 *(simülasyon)* — kaynak: drone survey; çözünürlük: 1 m grid · GSD 6.7 mm/px · 144 photos; adımlar: stereo heights from photo pairs, σZ = (H/B)·GSD·σpx = 13.4 mm → slope over 2 m ≤ 10° and no rock ≥ 0.5 m (rocks seen when ≥ 3 px) → uncertainty: sampling 1.2 % ⊕ threshold 2.7 %; Measured over the SYNTHETIC terrain of this site (assumed relief and rocks); load a DTM for real slopes
- **solar**: 2536 ± 380.41 *(model)* — kaynak: Allison & McEwen (2000), Mars24 solar time algorithm (NASA GISS); adımlar: Sun position over one Mars year (Mars24), latitude 42.00° (assumption) → beam exp(−τ/μ) + assumed diffuse term, τ = 0.50 (assumption) → mean over 67 sampled sols, 15-min steps; ±15 %: diffuse-light shape and dust season not resolved
- **temperature**: 194.52 ± 15.00 *(model)* — kaynak: NASA Mars Fact Sheet (NSSDCA); adımlar: radiative balance T = ((1 − A)·Ī / (ε σ))^¼ with A = 0.25, ε = 0.95 (assumed) → Ī = 102.8 W/m² from the insolation model; Annual mean surface temperature; no atmosphere greenhouse, no thermal inertia (±15 K)
- **dust**: 0.50 ± 0.20 *(varsayım)* — kaynak: —; gerekçe: No site-specific dust climatology imported: global annual mean τ ≈ 0.5 assumed at every site, so this criterion does not separate the sites until data are imported
- **science**: 6.00 ± 1.00 *(varsayım)* — kaynak: —; gerekçe: Ice and recent-climate record; younger, less diverse geology than the crater sites
- **pressure**: 871.76 ± 130.76 *(model)* — kaynak: NASA Mars Fact Sheet (NSSDCA); adımlar: p = 636 Pa · exp(−h / 11.1 km), h = -3500 m (assumption); Annual mean; seasonal swing about ±25 % (Fact Sheet 4.0–8.7 mb)
- **latitude**: 42.00 ± 0.00 *(varsayım)* — kaynak: —; gerekçe: Representative point inside the shallow-ice part of Arcadia Planitia (team choice; region from piqueux2019)
- **elevation**: -3500 ± 400.00 *(varsayım)* — kaynak: —; gerekçe: Approximate; replace with a MOLA MEGDR sample (raster adapter)

*Mawrth Vallis*

- **ice**: 0.15 ± 0.20 *(varsayım)* — kaynak: —; gerekçe: 22° N: no shallow ice expected; abundant hydrated clays as a water source
- **safeArea**: 43.98 ± 7.36 *(simülasyon)* — kaynak: drone survey; çözünürlük: 1 m grid · GSD 6.8 mm/px · 128 photos; adımlar: stereo heights from photo pairs, σZ = (H/B)·GSD·σpx = 13.7 mm → slope over 2 m ≤ 10° and no rock ≥ 0.5 m (rocks seen when ≥ 3 px) → uncertainty: sampling 3.2 % ⊕ threshold 6.6 %; Measured over the SYNTHETIC terrain of this site (assumed relief and rocks); load a DTM for real slopes
- **solar**: 3142 ± 471.34 *(model)* — kaynak: Allison & McEwen (2000), Mars24 solar time algorithm (NASA GISS); adımlar: Sun position over one Mars year (Mars24), latitude 22.60° (assumption) → beam exp(−τ/μ) + assumed diffuse term, τ = 0.50 (assumption) → mean over 67 sampled sols, 15-min steps; ±15 %: diffuse-light shape and dust season not resolved
- **temperature**: 205.23 ± 15.00 *(model)* — kaynak: NASA Mars Fact Sheet (NSSDCA); adımlar: radiative balance T = ((1 − A)·Ī / (ε σ))^¼ with A = 0.25, ε = 0.95 (assumed) → Ī = 127.4 W/m² from the insolation model; Annual mean surface temperature; no atmosphere greenhouse, no thermal inertia (±15 K)
- **dust**: 0.50 ± 0.20 *(varsayım)* — kaynak: —; gerekçe: No site-specific dust climatology imported: global annual mean τ ≈ 0.5 assumed at every site, so this criterion does not separate the sites until data are imported
- **science**: 8.00 ± 1.00 *(varsayım)* — kaynak: —; gerekçe: One of the thickest and most diverse clay sequences on Mars; proposed Exploration Zone (ez2015)
- **pressure**: 796.66 ± 119.50 *(model)* — kaynak: NASA Mars Fact Sheet (NSSDCA); adımlar: p = 636 Pa · exp(−h / 11.1 km), h = -2500 m (assumption); Annual mean; seasonal swing about ±25 % (Fact Sheet 4.0–8.7 mb)
- **latitude**: 22.60 ± 0.00 *(varsayım)* — kaynak: —; gerekçe: Representative point near the candidate landing ellipses (team choice)
- **elevation**: -2500 ± 400.00 *(varsayım)* — kaynak: —; gerekçe: Approximate; replace with a MOLA MEGDR sample (raster adapter)

## 4. Keşif uçuşları (Rapier, otonom)

Güzergâh: 80 m × 80 m, 20 m AGL, 4 m/s, bindirme 75 / 60 %.

| Bölge | sonuç | s | Wh | foto | stereo kapsama | GSD mm | σZ mm | güvenli alan % | gerçek (sentetik) % | DEM RMSE mm | tehlikeli kaya |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Jezero Krateri | ✓ complete | 477 | 65.8 | 144 | 95 % | 6.8 | 13.7 | 75.4 ± 7.4 | 75.7 | 13.7 | 62 / 62 |
| Arcadia Planitia | ✓ complete | 476 | 59.7 | 144 | 95 % | 6.7 | 13.4 | 96.3 ± 3.0 | 96.5 | 13.5 | 7 / 7 |
| Mawrth Vallis | ✓ complete | 474 | 65.5 | 128 | 95 % | 6.8 | 13.7 | 44.0 ± 7.4 | 44.2 | 13.7 | 59 / 59 |

*Dron yalnız yüzeyi ölçer: stereo fotoğraflardan eğim ve kaya. Yer altı buzu, radyasyon ve iklim hiçbir zaman dron ölçümü olarak gösterilmez. DTM yüklenmediyse arazi sentetiktir; "gerçek" sütunu Mars'ı değil yöntemi doğrular.*

## 5. Zorunlu güvenlik koşulları

| Kural | eşik | Jezero Krateri | Arcadia Planitia | Mawrth Vallis |
|---|---|---|---|---|
| Enlem ±50° içinde (yayın) | 50 ° | ✓ 18.4 | ✓ 42.0 | ✓ 22.6 |
| Giriş-iniş için yeterince alçak (varsayım) | -1000 m | ✓ -2600 | ✓ -3500 | ✓ -2500 |
| İniş alanı dronla tarandı (varsayım) | 60 % | ✓ 95.1 | ✓ 95.1 | ✓ 95.1 |
| Yeterli güvenli iniş alanı (varsayım) | 50 % | ✓ 75.4 | ✓ 96.3 | ✗ 44.0 |

- Enlem ±50° içinde: NASA 2015 Keşif Bölgesi kılavuzu (ilk insanlı görevler)
- Giriş-iniş için yeterince alçak: Takım varsayımı: ağır iniş araçları alçak bölgelerin kalın havasına ihtiyaç duyar (MOLA ≤ −1 km)
- İniş alanı dronla tarandı: İniş ölçeğinde tarama olmadan bölge onaylanmaz; alanın en az bu kadarı stereo görülmeli
- Yeterli güvenli iniş alanı: Takım varsayımı: taranan zeminin en az yarısı güvenli olmalı (eğim ve kaya)

## 6. Karar matrisi ve TOPSIS

| Ölçüt | ağırlık | yön | Jezero Krateri | Arcadia Planitia |
|---|---:|---|---:|---:|
| Su buzu erişimi | 0.220 | benefit | 0.100 | 0.850 |
| Eğim ve iniş güvenliği | 0.200 | benefit | 75.378 | 96.335 |
| Güneş enerjisi potansiyeli | 0.140 | benefit | 3232 | 2536 |
| Sıcaklık | 0.080 | benefit | 206.674 | 194.525 |
| Toz ve rüzgâr riski | 0.080 | cost | 0.500 | 0.500 |
| Bilimsel araştırma değeri | 0.180 | benefit | 9.000 | 6.000 |
| Ulaşım ve haberleşme | 0.100 | benefit | 803.866 | 871.760 |
| D⁺ | | | 0.1959 | 0.0554 |
| D⁻ | | | 0.0554 | 0.1959 |
| **C** | | | **0.220** | **0.780** |
| sıra | | | 2 | 1 |

Adımlar: r = x / √Σx² · v = w r · her ölçütte ideal v⁺ ve en kötü v⁻ · D± = √Σ(v − v±)² · C = D⁻/(D⁺ + D⁻).

## 7. Model kontrolleri

- Jezero basınç modeli 804 Pa karşı MEDA sol ortalaması 625–761 Pa (yayın); model Fact Sheet ortalama yarıçap basıncını ve yaklaşık yüksekliği kullanır.
- Jezero sıcaklık modeli 206.7 K karşı MEDA hava 190.14999999999998–250.14999999999998 K (aralık ortası 220.1 K).
- Modeller: p = 636 Pa · exp(−h / 11.1 km); T = ((1 − 0.25)·Ī / (0.95 σ))^¼; Mars24 Güneşi ve Beer–Lambert toz sönümüyle güneşlenme.

## 8. Varsayımlar ve sınırlar

- Tüm para değerleri temsili oyun maliyetleridir.
- DTM yüklenmedikçe her bölgenin yerel arazisi sentetiktir (varsayılan rölyef, krater, kaya); iniş güvenliği sayısı o zaman gerçek bölgeyi değil yöntemi sınar.
- Buz indeksi, toz τ, bilim puanı ve yükseklikler NASA rasterleri (SWIM, MOLA) içe aktarılana kadar gerekçeli varsayımlardır.
- Güneş, sıcaklık ve basınç birinci dereceden modellerdir (±%15), iklim verisi değildir.
- TOPSIS ölçütleri bağımsız sayar; güneş, sıcaklık ve toz fiziksel olarak bağlıdır, bu yüzden toplam ağırlıkları Güneş'i birden çok kez sayar.
- Üç bölgeyi tek dron tasarımıyla taramak bir oyun basitleştirmesidir: gerçek bir kampanyada her bölgeye ayrı iniş gerekir.
- Gövdelerin yapısal analizi yapılmadı; kütle ve atalet değişiklikleri uygulanır, dayanım iddia edilmez.
- Enerji planı her ara noktaya bu simülatöre göre kalibre edilmiş dönüş süresi ekler (3,5 sn + her m/sn için 2 sn).

## 9. Kaynaklar

- NASA GISS, Mars lander missions (coordinates of Mars landing sites), via Wikipedia "Octavia E. Butler Landing" — https://en.wikipedia.org/wiki/Octavia_E._Butler_Landing
- Bradbury Landing (Curiosity), Wikipedia — https://en.wikipedia.org/wiki/Bradbury_Landing
- Zhurong (rover), Wikipedia — https://en.wikipedia.org/wiki/Zhurong_(rover)
- The Planetary Society (2015), "Mars science and human spaceflight find common ground" — NASA First Landing Site / Exploration Zone workshop — https://www.planetary.org/articles/20151029-mars-science-hsf-common-ground
- Piqueux et al. (2019), Widespread shallow water ice on Mars at high and mid latitudes, GRL — https://doi.org/10.1029/2019GL083947
- Subsurface Water Ice Mapping (SWIM) project, Planetary Science Institute / JPL — data products — https://swim.psi.edu/SWIM4MIMProducts.php
- MGS MOLA Mission Experiment Gridded Data Records (MEGDR), NASA PDS — https://pds-geosciences.wustl.edu/missions/mgs/megdr.html
- HiRISE digital terrain models (University of Arizona / NASA PDS) — https://www.uahirise.org/dtm/
- NASA Mars Fact Sheet (NSSDCA) — https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
- Sánchez-Lavega et al. (2023), Mars 2020 Perseverance rover studies of the Martian atmosphere over Jezero from pressure measurements, JGR Planets 128; NASA MEDA release (air −83 … −23 °C) — https://doi.org/10.1029/2022JE007480
- Allison & McEwen (2000), Mars24 solar time algorithm (NASA GISS) — https://www.giss.nasa.gov/tools/mars24/help/algorithm.html
- Appelbaum & Flood (1989), Solar radiation on Mars, NASA TM-102299 — https://ntrs.nasa.gov/citations/19890018252
- Golombek & Rapp (1997), Size-frequency distributions of rocks on Mars and Earth analog sites, JGR — https://doi.org/10.1029/96JE03319
- Hwang & Yoon (1981), Multiple Attribute Decision Making: Methods and Applications (TOPSIS), Springer — https://doi.org/10.1007/978-3-642-48318-9
- Saaty (1987), The analytic hierarchy process — what it is and how it is used, Mathematical Modelling 9, 161–176 — https://doi.org/10.1016/0270-0255(87)90473-8
- Normal-case stereo photogrammetry: depth precision σZ = (H/B)·(H/f)·σpx (standard textbook relation, e.g. Kraus, Photogrammetry, de Gruyter)
- NASA/JPL Ingenuity landing press kit — 13-megapixel colour camera — https://www.jpl.nasa.gov/news/press_kits/ingenuity/landing/mission/spacecraft
