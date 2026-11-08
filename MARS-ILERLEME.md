# OsirisZk · Mars Aerial Explorer · İlerleme

NASA Space Apps Challenge 2026 Ankara (14–15 Kasım 2026). Takım: OsirisZk.
Talimat: "OSIRISZK – MARS AERIAL EXPLORER – Claude Code Ana Geliştirme Talimatı".

## Kısa durum (8 Kasım 2026, akşam)

- **9 aşamanın hepsinde çalışan bir sürüm var.** 99 test geçiyor, çekirdeğin 5" uçuş izi hâlâ birebir aynı.
- Gerçek zamanlı uygulama `npm run dev:app` ile açılıyor; arayüz İngilizce ve Türkçe. Deneyler `npm run experiments` ile çalışıyor.
- Sıradaki iş yüksek çözünürlük:
  - gerçek Jezero DTM'si (`tools/import-dtm.mjs`)
  - daha ayrıntılı dokular ve LOD
  - GPU'lu bilgisayarda 120 FPS ölçümü

## İlk durum (8 Kasım 2026, öğle)

- **Aşama 1 (Mars fizik motoru) tamam ve testli.** 76 test geçiyor: çekirdeğin 46 testi ve 30 yeni test. 5" referans uçuş izi birebir aynı.
- Çekirdek dosyalarına dokunulmadı. Mars katmanı `src/planet/` altında ayrı modül olarak duruyor.
- Bulgu: Mars'ta (ρ 0,012–0,020) altı çekirdek dronun hiçbiri havalanamıyor. Askıda kalmak için ses üstü pal ucu gerekiyor, pal Reynolds sayısı ~2–7 bin. Sayılar `reports/planet-compare.csv` dosyasında.
- Sıradaki iş Aşama 2: Re/Mach'a bağlı rotor modeli, Ingenuity doğrulaması, eş eksenli araç, motor ve batarya.

## Temel karar: hangi çekirdek?

İki aday vardı. **Rapier tabanlı ZSK uçuş çekirdeği** seçildi.

- **ZSK çekirdeği:**
  - Talimatın tarif ettiği sistem bu (Three.js + Rapier, FPV, çok rotorlu).
  - Hareket gerçek kuvvet ve torkla üretiliyor: her motorun itkisi kendi noktasına kuvvet olarak uygulanıyor, ayrıca yaw tepki torku ve sürükleme var.
  - 240 Hz sabit adım, çizimden bağımsız. Uçuş izi SHA-256 ile kilitli. Testleri Node'da çalışıyor.
- **BVLOS deposundaki UH-60 helikopter modeli:**
  - Rotor aerodinamiği daha ayrıntılı (pal elemanı, sıkıştırılabilirlik).
  - Ama tek ana rotorlu, 10 tonluk bir helikopter için yazılmış. Kendi entegratörü var, Rapier yok.
  - Gökyüzü projesinin Apache-2.0 NOTICE yükümlülüğünü taşıyor.
  - Fikirleri Aşama 2'de kaynak gösterilerek kullanılabilir; kodu taşınmadı.

## Talimatın istediği rapor (7 başlık)

### 1. Mevcut mimari

- **Fizik** (`src/physics/FlightPhysics.js`, 190 satır):
  - Tek Rapier dünyası ve tek dinamik gövde. Kütle ve atalet açıkça veriliyor.
  - Motor itkisi `addForceAtPoint` ile motor noktalarına, yaw tepkisi `addTorque` ile uygulanıyor.
  - Sürükleme gövde eksenlerinde doğrusal ve karesel. Çarpışma ve hasar olayları, isteğe bağlı batarya var.
  - Konum ve dönüş yalnız sıfırlama ve yeniden doğmada yazılıyor.
- **Kontrolcü** (`FlightController.js`): ANGLE, ACRO ve KONUM modlarında PID. Çıktısı tork isteği. Karıştırıcı (`mixMotors`) bu isteği motor itkilerine çeviriyor.
- **Zaman:** `FixedStepper`, 1/240 sn. Çizim önceki ve son durum arasında interpolasyonla yapılıyor.
- **Kumanda:** klavye, standart kumanda, FPV vericisi; profiller, eğitim gazı.
- **Telemetri:** `FlightRecorder` CSV çıkarıyor, `GhostLap` hayalet turu oynatıyor.
- **Arazi:** çekirdekte yok. Çarpışma API'si kutu, silindir ve üçgen ağı kabul ediyor.
- **Ses ve görsel:** yalnız fiziği okuyor.
- **Referans performans** (Node, değişiklik öncesi, `reports/baseline-core.json`): adım başına 15–58 µs, yani 240 Hz bütçesinin %0,4–1,4'ü.

### 2. Korunacak modüller

Bunlar olduğu gibi kalıyor: FlightPhysics, FlightController, mixMotors, FixedStepper, Wind, InputManager ve profiller, TrainingThrottle, FlightRecorder, DroneTypes, DroneModel/Effects, MotorSound, flighttrace.

### 3. Değiştirilecekler

Değişiklikler çekirdeğin üstüne katman olarak geliyor; çekirdek dosyası düzenlenmiyor.

- Rapier yerçekimi gezegenden geliyor: `world.gravity`.
- İtki, tork ve sürükleme yerel yoğunlukla ölçekleniyor: `planetizeDrone`.
- Kontrolcünün 9,81 sabiti Mars araçları için yeni kontrolcüde ele alınacak (Aşama 2).
- Batarya yük modelinin yerini elektrik güç modeli alacak (Aşama 2).

### 4. Dosya yapısı

```
src/planet/atmosphere.js           atmosfer modelleri, CO₂ gaz verisi
src/planet/profiles.js             Dünya/Mars profilleri: değer, birim, durum, kaynak
src/planet/PlanetEnvironment.js    MarsEnvironment / EarthEnvironment
src/planet/PlanetPhysics.js        MarsPhysics: gezegen yerçekimi + aerodinamik kuvvet/tork
src/planet/PlanetFlightPhysics.js  çekirdek dron gezegende
src/planet/rotorDiagnostics.js     CT tanımları, uç Mach, pal Re, askı devri ve gücü
examples/planet/                   Dünya/Mars uçuş demosu (EN/TR)
tools/planet-compare.mjs           karşılaştırma → reports/*.json, *.csv
tools/physics-bench.mjs            fizik adımı maliyeti
docs/SOURCES.md                    kaynak listesi
```

Aşama 2'de eklenecekler: `src/planet/rotor/` (pal elemanı ve momentum teorisi, kanat profili verisi), `src/planet/vehicles/` (eş eksenli araç, Mars dörtlüsü), `src/planet/power/` (motor ve batarya).

### 5. Bilimsel doğrulama planı

- **Aşama 1 testleri (tamam)** `tests/planet-*.test.js` dosyalarında:
  - ISA tablo değerleri.
  - Mars ölçek yüksekliği ve mol kütlesi (NASA).
  - Ses hızı (SuperCam ölçümü).
  - Hidrostatik denge ve ideal gaz yasası.
  - Serbest düşüş ve Mars/Dünya süre oranı.
  - Kütle–ağırlık (zemin temas kuvveti = m·g).
  - Terminal hız ve tanh çözümü.
  - Enerji dengesi.
  - Açısal momentum (Dzhanibekov dönüşü).
  - 30/60/144/240 Hz'de aynı durum.
  - Aynı seed, aynı uçuş.
  - Dünya'da çekirdekle bit düzeyinde eşitlik.
  - Mars'ta askı dengesi.
- **Aşama 2:**
  - Ingenuity askı verisi: kütle 1,8 kg, rotor 1,21 m, 2537–2800 dev/dk; Cuyler & Dull (NASA Ames). Kaynakta yayımlanan değerle karşılaştırılacak.
  - Momentum teorisi alt sınırı.
  - CT'nin Re ve Mach ile değişiminin yayımlanmış düşük Re profil verisiyle karşılaştırılması (kaynak aranacak).
- **Kural:** yayımlanmış veriyle doğrulanmayan her parametre kodda, raporda ve arayüzde "varsayımsal" olarak görünüyor.

### 6. Riskler

- **Süre:** yarışmaya 6 gün var. Eş eksenli helikopterin kontrolü (iki rotorda kolektif ve çevrimsel) en zor iş. Önce askı ve dikey uçuş, sonra ileri uçuş.
- **Düşük Re profil verisi:** Mars Re aralığı için güvenilir CL/CD verisi bulunmazsa model "varsayımsal" etiketiyle kalır.
- **Lisans:** çekirdeğin lisansı belirtilmemiş. Space Apps açık lisans istiyor (varsayılan Apache-2.0); teslimden önce takım karar vermeli.
- **Önceki çalışma:** kurallar önceki çalışmayı yasaklamıyor, ama kaynak ve şeffaflık istiyor. Etkinlik öncesi ve sırasında yapılanlar ayrı belgelenmeli.
- **Rapier 32 bit hassasiyet:** km ölçekli görevlerde kayan orijin gerekebilir. 10 km'de çözünürlük ~1 mm.
- **Gerçek Mars arazisi** (HiRISE/USGS DTM): boyut ve performans sorunu çıkabilir; LOD gerekir. Rastgele arazi NASA verisi gibi gösterilmeyecek.

### 7. Geliştirme sırası (öneri)

| Gün | İş |
|---|---|
| 8 Kas | Aşama 1 ✓ |
| 9–10 Kas | Aşama 2a: pal elemanı rotor modeli (Re/Mach), Ingenuity karşılaştırması, motor ve batarya gücü |
| 10–11 Kas | Aşama 2b: eş eksenli araç ve kontrolcüsü, Mars'a uygun dörtlü örneği; Aşama 3 kütle/atalet hesabı |
| 11–12 Kas | Aşama 4: Jezero yükselti verisi; Aşama 5: güzergâh, Dünya–Mars gecikmesi, otonom mod |
| 12–13 Kas | Aşama 6: deney modülü, grafik, CSV/JSON; Aşama 7: görev paneli EN/TR |
| 13 Kas | Sunum, demo kaydı, README |

## Kayıt

### 8 Kasım 2026 · Aşama 1: Mars fizik motoru

- **Referans:** çekirdek `npm run check` sonucu 46/46 test ve iz AYNI. Fizik adımı ölçümü `reports/baseline-core.json` dosyasında.
- **Atmosfer** (`atmosphere.js`):
  - Katmanlı hidrostatik ideal gaz modeli. Dünya'da ISA'yı birebir veriyor.
  - Mars katmanları NASA Glenn sıcaklık eğimiyle.
  - NASA Glenn MGS eğrisi yayımlandığı gibi ayrı profil olarak var.
  - Sabit yoğunluklu (uniform) model, deneylerde kontrol değişkeni olarak.
  - CO₂ karışımı için γ(T) NIST-JANAF'tan, viskozite Sutherland yasasıyla.
- **Profiller:** mars-brief (talimat), mars-nasa, mars-glenn, Ingenuity tasarım alt/üst ve düşük mevsim, earth-isa. Her parametre için birim, durum (kaynaklı / talimat / varsayımsal / türetilmiş / senaryo) ve kaynak tutuluyor.
- **MarsEnvironment:** senaryo parametreleri değiştirilebilir ve doğrulanıyor; hatalı değer anlaşılır hata mesajı veriyor. Değişmez nesne. Parametre tablosu TR/EN.
- **MarsPhysics:**
  - Gezegen yerçekimli Rapier dünyası.
  - Yerel yoğunluk ve rüzgâra göre sürükleme kuvveti ve dönme sönümü torku.
  - Yer yüksekliği (site elevation) destekleniyor.
  - Enerji muhasebesi ve temas kuvveti ölçümü.
  - Gezegen değişimi bir sonraki adımda geçerli oluyor.
- **PlanetFlightPhysics:**
  - Çekirdek dron gezegende uçuyor: yerçekimi, ρ'ya bağlı itki/tork/sürükleme, askı gazı ve itki/ağırlık yeniden hesaplanıyor.
  - İrtifa değişince yoğunluk güncelleniyor.
  - Dünya/Mars geçişi yalnız motorlar kapalıyken yapılıyor.
- **Tanılama** (`rotorDiagnostics`): pervane ve rotor CT tanımları ayrı veriliyor (π³/4 farkı). Uç Mach, %75 yarıçapta pal Re, askı devri ve uç Mach'ı, momentum teorisi ideal askı gücü hesaplanıyor. Uyarılar TR/EN.
- **Demo** (`npm run dev:planet`): gezegen, drone ve dil seçimi var; HUD'da itki/ağırlık görünüyor. Headless Chromium'da sınandı:
  - Mars'ta %30 gazda yerde kalıyor.
  - Dünya'da 3 sn'de 14 m tırmanıyor.
  - Hata yok.
- **Test sırasında bulunanlar:**
  - Serbest düşüş hatası düz Euler'in ~1/8'i. Bu, Rapier'in adımı çözücü yineleme sayısı (8) kadar alt adıma bölmesiyle uyumlu (ölçümden çıkarım).
  - Rapier 32 bit çalışıyor; test toleransları buna göre ayarlandı.
  - Rapier jiroskopik etkiyi modelliyor (Dzhanibekov dönüşü görülüyor); bu Aşama 2'deki eş eksenli rotor için önemli.
- **Çekirdek parametre tutarsızlığı:** çekirdek drone değerlerinin ima ettiği CT (pervane tanımı) türden türe çok değişiyor: freestyle5 0,279, whoop3 0,311, tiny65 0,317, race5 0,142, longrange7 0,122, hex 0,052. Gerçek pervanelerde bu değer ≈0,08–0,15. Mars sonucu (havalanamaz) bundan etkilenmiyor, çünkü gerçekçi CT ile itki daha da düşük çıkar. Aşama 2'de CT geometriden hesaplanacak.
- **Örnekteki hata:** çekirdeğin `examples/minimal` örneğinde R tuşundan ya da drone değişiminden sonra klavye gaz kilidi açılmıyor (`releaseThrottleLock` çağrılmıyor). Mars demosunda düzeltildi; çekirdek örneğine dokunulmadı.
- **Depo:** `KOMUT.md` başka bir projenin talimatıydı; bu depodan çıkarıldı, özgün zip'te duruyor. Çekirdek README'si `docs/flight-core.md` dosyasına taşındı.
- **Performans** (`npm run bench`): gezegen katmanı adım başına 20–24 µs, çekirdekle aynı düzeyde. 8 aerodinamik gövdeli dünya 50 µs.

### 8 Kasım 2026 · Aşama 2–9

- **Rotor (aero/):**
  - Kanat profili Reynolds ve Mach sayısına bağlı; clf5605'in NASA'da yayımlanmış noktasına bağlandı.
  - Pal elemanı rotor modeli: momentum ve dinamik akış, Prandtl uç kaybı, yer etkisi, eş eksenli girişim.
  - Durağan çözücü ikiye bölme yöntemiyle çalışıyor, her durumda yakınsıyor.
  - Gerçek zamanlı adım tek geçişte bitiyor (~3 µs).
- **Ingenuity rotoru:** NASA geometri raporundan (yarıçap, pal sayısı, rotor aralığı, burulma uçları, kiriş tepe ve uç değerleri); iç kiriş şekli varsayımsal.
- **Kalibrasyon:** Profil kaybı katsayısı 3,0'a kalibre edildi; Ingenuity'nin askı gücü Rapier'de 350 W ± %8 çıkıyor (JPL ≈ 350 W). Kalibrasyonsuz model ≈ 200 W veriyor; uygulamada iki mod arasında geçiş var.
- **Güç (power/):**
  - BLDC motor ve devir regülatörü, yarı örtük entegrasyonla.
  - Li-ion batarya: voltaj düşümü, 1 sn gecikmeli düşük voltaj kesmesi.
  - Rotorlar dakikada 400 devirlik yumuşak kalkışla hızlanıyor.
- **Gövdeler (frames/):** kesin kütle özellikleri ve asal eksenler. Karbon, C60 kafes (60 düğüm, 90 çubuk) ve altıgen bal peteği kabuk. Her gövdede FEA notu var.
- **Araçlar:**
  - Ingenuity benzeri (1,8 kg).
  - OsirisZk Mars dörtlüsü (kavram, 3 kg).
  - NASA MSH altılısı (20,8 kg).
  - 5" FPV (0,65 kg).

  Araçlar Rapier'de yalnız kuvvet ve torkla uçuyor: rotor itkisi ve H-kuvveti, motor tepki torku, göbek momenti, jiroskop, Reynolds sayısına bağlı gövde sürüklemesi.
- **Kontrol:** kademeli yapı (konum → hız → tutum → açısal hız). Yerçekimi ve yoğunluk ortamdan geliyor. Eş eksenli araçta toplam açı stall sınırına göre kısıtlı. Uçuş öncesi rotor devri trim bulunan bir değere ayarlanıyor.
- **Mars zamanı:** Mars24 (pyMarsTime ile aynı sonuç), güneş yüksekliği ve azimutu, JPL efemerisiyle 3,1–21,9 dk ışık süresi.
- **Arazi:**
  - Prosedürel arazi, her zaman "NASA verisi değil" etiketiyle.
  - Kraterler ve Golombek–Rapp kaya modeli; Rapier yükseklik alanıyla sapma ≤ 0,25 m.
  - GeoTIFF DTM içe aktarma aracı.
- **Görev:**
  - Enerji bütçesi tahmini; simülasyonla farkı ±%35 içinde.
  - Otonom yürütücü.
  - Dünya'dan FPV'de gerçek ışık gecikmesi ve failsafe: görev başarısız oluyor. Gecikmesiz FPV'de başarılı.
- **Deneyler:** 7 hazır deney (45 uçuş, ~76 sn); çıktılar `reports/experiments/` klasöründe.
- **Arayüz:**
  - 7 panel, Web Worker'da deney, Markdown/JSON rapor.
  - Performans paneli: FPS, CPU, fizik ve GPU süresi, 10 sn ölçüm JSON'u.
  - `?renderer=webgpu` ile WebGPU denenebiliyor.
- **Bu ortamda (GPU yok):** yazılım çizimiyle 3 FPS; fizik adım başına ~35 µs. Gerçek GPU ölçümü takımın RTX 5060 Ti'sinde B tuşuyla yapılacak.
- **Bulgular:** Ingenuity benzeri araç Dünya'da motor akım sınırı nedeniyle kalkamıyor. Toz fırtınası rüzgârının etkisi küçük, çünkü 23 m/sn'de dinamik basınç yalnız 5,5 Pa. Pal çırpması (geri yatma) ve tozun sensörlere etkisi modelde yok.

### 8 Kasım 2026 akşam · Sol sol enerji ve grafik

- **Enerji modeli** (`src/power/solar.js`):
  - Panel gücü Mars24 güneşi ve toz optik derinliğinden (τ) hesaplanıyor. Doğrudan ışık Beer–Lambert yasasıyla; dağınık ışığın şekli varsayımsal, Appelbaum & Flood eğilimine göre seçildi.
  - Günlük sıcaklık Viking 1 aralığında (184–242 K).
  - Gece ısıtıcısı (G·ΔT), uyku gücü ve panel toz kaybı modelleniyor.
  - "Bugün uçabilir miyiz?" kararı ileriye bakarak veriliyor: uçuştan sonra batarya ertesi sabaha kadar hayatta kalmıyorsa uçulmuyor.
- **Ingenuity paneli:** 425 × 165 mm (JPL). Hücre verimi 0,28; ısıl iletkenlik 0,016 W/K; uyku gücü 0,25 W, hepsi varsayımsal.
- **Ingenuity sonuçları:**
  - τ 0,5'te günde ≈ 52 Wh toplanıyor, gece ≈ 25 Wh harcanıyor; her sol uçulabiliyor.
  - τ 2'de 10 solda 9 uçuş, ama batarya en düşük %14'e iniyor.
  - τ 4'te 10 solda yalnız 2 uçuş ve batarya tükeniyor.
- **OsirisZk dörtlüsü:** τ 1'de sürekli çalışmak için ≈ 0,25 m² panel gerekiyor.
- **Görev paneli:** panel alanı, toz kaybı, toplanan ve harcanan enerji, uçuş sayısı, sol sol SoC ve güç grafikleri. Rapora da işleniyor.
- **Deneyler:** `opticalDepth` ve `panelArea` bağımsız değişken oldu; bağımlı değişkenler 10 solda uçuş, toplanan enerji, gece tüketimi ve en düşük SoC. İki yeni hazır deney eklendi: `solar` ve `panel`.
- **Grafik:**
  - Arazi 512 × 512 hücre (2,3 m), aynı ızgara fizikte de kullanılıyor; ayrıntı kabartma haritası; tozlu düzlükler ve kayalık yamaçlar ayrı renkte.
  - Güneşe göre renklenen gökyüzü kubbesi (alçak güneşte mavimsi hale) ve güneş diski.
  - Kayalarda renk ve biçim çeşitliliği.
  - Rotor rüzgârının kaldırdığı toz, yalnız görsel.
  - Gölge sapma ayarı.
  - Orta kalitede 1,09 milyon üçgen ve 42 çizim çağrısı.

### 8 Kasım 2026 gece · İki simülatör (Dünya ve Mars) ve Xbox kumandası

- **Giriş sayfası:** adres parametresiz açılınca iki kart çıkıyor: *Dünya Uçuş Laboratuvarı* ve *Mars Hava Kaşifi*. Kartlardaki sayılar modelden geliyor (yerçekimi, Ankara'da ISA yoğunluğu, bugünkü Dünya–Mars ışık süresi).
- **Adresler:** `?world=earth` ve `?world=mars`. Netlify'da `/earth` ve `/mars` kısa bağlantıları da çalışıyor (`app/public/_redirects`). Üst çubuktaki Dünya | Mars düğmesiyle geçiş yapılıyor; dil ve diğer ayarlar korunuyor.
- **Dünya simülatörü:**
  - Ankara, 39,93°K 32,85°D, 938 m. ISA atmosferi (rakım değiştirilebilir), 9,81 m/s².
  - Güneş NOAA / Spencer (1971) denklemleriyle hesaplanıyor (`src/earth/sun.js`); gündönümü öğle yükseklikleri ve zaman denklemi testle doğrulandı.
  - Pilot sahada, gecikme yok. Kontrol modları: otonom ve sahada FPV.
  - Rüzgâr seviyeleri çekirdeğin Dünya seviyeleri: sakin, 3, 6, 9 m/sn.
  - Arazi prosedürel Dünya arazisi: krater yok, yumuşak tepeler, seyrek kaya. "Harita/ölçüm verisi DEĞİL" etiketi taşıyor.
  - Sol sol güneş enerjisi modeli Mars'a özgü olduğu için Dünya'da gizli.
  - Varsayılan araç 5" FPV dörtlü. Gök mavi, alçak güneşte turuncu, gece koyu.
  - Dünya deneyleri: araçlar, yük, rüzgâr, gövde, güzergâh, Dünya–Mars karşılaştırması.
- **Mars simülatörü:** değişmedi. Tek düzeltme, gökyüzü ışığının renginin artık güneşe göre güncellenmesi (önceden bir yorum satırı bu kodu devre dışı bırakıyordu).
- **Deney koşucusu:** arazi önbelleği artık gezegene göre ayrılıyor. Önceden Dünya–Mars deneyinde Dünya koşuları Mars kraterleri üzerinde uçuyordu; düzeltildi ve sonuçlar yeniden üretildi.
- **Xbox kumandası (standart eşleme, iki dünyada da):**
  - Sol çubuk tırmanma ve dönüş, sağ çubuk eğim (Mod 2).
  - A görevi başlat, B in, Y kamera, X kontrol modu (kalkıştan önce), Menu sıfırla.
  - HUD'da "🎮 kumanda bağlı" satırı, Uçuş panelinde durum ve yardım metni.
  - Mars'ta Dünya'dan FPV çubuk komutları ışık süresi kadar gecikiyor; sahada FPV doğrudan.
  - Tarayıcı kumandayı ilk düğme basışından sonra görüyor.
- **Küçük düzeltmeler:** yörünge kamerası artık aracın içinden değil arkasından başlıyor ve zeminin altına inmiyor. Deney seçimi panel yenilenince sıfırlanmıyor. Telefonda üst çubuk sığıyor.
- **Testler:** 105 (yeni dosya `tests/earth-world.test.js`, 6 test). Çekirdek izi AYNI.

### 8 Kasım 2026 gece · En yüksek çözünürlük, model kontrolü ve gerçek NASA koşulları

- **RTX 5060 Ti ölçümü (takımdan, Mars, orta kalite, 1920 × 911):** kare 16,67 ms, yani 60 FPS'ye ekran yenilemesi kilitliyor. Asıl iş GPU'da 5,4 ms: 60 Hz bütçesinin üçte biri, 120 Hz bütçesinin (8,3 ms) üçte ikisi. 1,09 milyon üçgen, 42 çizim çağrısı. Bu payla daha yüksek seviyeler eklendi.
- **Kalite seviyeleri:**
  - Yüksek: arazi 1024² (1,2 m hücre, HiRISE DTM nokta aralığına yakın), gölge 2048.
  - Ultra: arazi 2048² (0,6 m hücre), piksel oranı en az 1,5 (aşırı örnekleme), gölge 4096, anizotropi 16.
  - Fizik ve çizim aynı ızgarayı kullanıyor. Seviye değişince aynı analitik arazi daha ince örnekleniyor.
  - Mars arazisi üretimi 2048²'de 8 sn'den 0,5 sn'ye indi: kraterler yalnız etki alanlarına basılıyor. Sonuç bit düzeyinde aynı (özetler değişmedi).
  - Arazi ağı doğrudan yükseklik ızgarasından kuruluyor. Çok büyük ağlarda CPU kopyaları GPU'ya yüklendikten sonra bırakılıyor.
- **Toplu ölçüm:** Uçuş panelinde ya da Shift+B ile tüm seviyeler 6'şar saniye ölçülüyor. Tek JSON iniyor: ortalama ve p95 GPU ve CPU ms, üçgen sayısı ve 60 Hz ile 120 Hz için önerilen en yüksek seviye.
- **Model kontrolü** (`npm run model-check`, `reports/model-check.md`):
  - **Gerçek Jezero yoğunluğu:** Yayımlanmış MEDA basınç aralığı (Sánchez-Lavega vd. 2023: 625 Pa, Ls 101° ile 761 Pa, Ls 55°) ve MEDA hava sıcaklığı aralığıyla (−83 … −23 °C) öğle yoğunluğu 0,0133 ile 0,0162 kg/m³ çıkıyor. Bu, Ingenuity'nin tasarlandığı ve uçtuğu aralığın (0,012–0,0185) içinde.
  - **Brief değeri:** 0,020 kg/m³ yüksek basınç mevsiminin şafak havasına (0,0209) denk geliyor, yani yoğun uç.
  - **Ingenuity benzeri araç:** Üç koşulda da standart görevi uçuyor. 2537 rpm'de itki payı 2,2'den 1,45 × ağırlığa düşüyor. NASA en ince havada rotor devrini 2700–2800 rpm'ye çıkarmıştı.
  - **Arazi çözünürlüğü:** 512², 1024² ve 2048² ızgaralarda enerji ve süre aynı (Mars 7,68 Wh, 80,6 sn; Dünya 2,2 Wh, 68,1 sn). Sonuçlar çözünürlüğe bağlı değil.
- **Araç modelleri:** Paller, aerodinamiğin kullandığı veter ve burulma tablolarından üretiliyor. Ingenuity'de NASA'nın kürek biçimi (en geniş veter 0,34 R'de), FPV'de pervane sarmal açısı görünüyor. Göbek kapağı eklendi.
- **Gerçek NASA koşulları (Ortam paneli):**
  - **Mars:** NASA/JPL Mars 2020 hava durumu akışının son solu: Perseverance MEDA, Jezero. Günün en yüksek/en düşük hava sıcaklığı ve basıncı ölçüm; görev saatindeki sıcaklık varsayımsal günlük eğriyle hesaplanıyor. Görev tarihi o sola, aynı yerel saate taşınıyor. Çevrimdışı iki kaynaklı hazır ayar var: MEDA düşük ve yüksek basınç mevsimi.
  - **Dünya:** NASA POWER saatlik veri: Ankara'da 2 m sıcaklık, yüzey basıncı, 10 m rüzgâr. ISA, 938 m'de ölçülen değerleri tam verecek şekilde ayarlanıyor; ölçülen rüzgâr "ölçülen" seviye oluyor.
  - Veri tarayıcıda alınıyor: önce sitenin `/nasa/` vekili (Netlify ve geliştirme sunucusu), sonra doğrudan. Saklanmıyor, uydurulmuyor. Ham JSON indirilebiliyor. Rapor kaynağı, zamanı ve değerleri yazıyor. Servis yoksa model değerleri kalıyor.
  - **Bu ortamdan erişim yok:** Buradaki ağ izin listesi mars.nasa.gov ve power.larc.nasa.gov'a izin vermiyor. Canlı veri yolu gerçek servisle denenemedi; ayrıştırıcılar belgelenmiş biçimdeki örneklerle test edildi. Takım evde düğmeye basıp ham JSON'u gönderirse doğrulanacak.
- **Düzeltme:** Rüzgâr yönü etiketi "geldiği yön" diyordu ama alan havanın aktığı yönü tutuyordu (çekirdek kuralı). Arayüz artık meteorolojik "geldiği yön"ü gösterip dönüştürüyor; fizik değişmedi.
- **Testler:** 111 (yeni dosya `tests/realdata.test.js`, 6 test). Çekirdek izi AYNI.

### 8 Kasım 2026 gece · Giriş sayfasında gerçek fotoğraflar

- Kartlardaki çizilmiş küreler kaldırıldı, yerlerine fotoğraf geldi.
- **Dünya kartı:** NASA EPIC'in o günkü fotoğrafı (DSCOVR uydusu, Güneş–Dünya L1 noktasından). Ankara'nın boylamına en yakın merkezli kare seçiliyor; çekim tarihi ve saati kartta yazıyor. Diskin boyutu uydunun uzaklığından hesaplanıp daireye oturtuluyor. EPIC'e ulaşılamazsa takımın gönderdiği Dünya görseli çıkıyor.
- **Mars kartı:** takımın gönderdiği fotoğraf. Viking yörünge aracı mozaiğine (NASA/JPL/USGS) benziyor; kaynak sayfası doğrulanmalı.
- Fotoğraflar gezegen diskine göre kırpıldı: 512 × 512 WebP, 47 KB ve 22 KB.
- EPIC isteği sitenin `/nasa/epic/` vekilinden, olmazsa doğrudan gidiyor. Bu ortamdan EPIC'e erişim yok; geçiş taklit veriyle denendi.
- Takımın Dünya görseli fotoğraf değil, büyük olasılıkla dijital çizim ve kaynağı belli değil. Yarışma sitesi için lisanslı bir NASA fotoğrafıyla değiştirilmesi öneriliyor (ör. Apollo 17 "Blue Marble"). Çoğu zaman EPIC fotoğrafı gösterileceği için yalnız yedek olarak duruyor.
- **Testler:** 112 (EPIC ayrıştırma, seçim, adres ve disk boyutu).

### 8 Kasım 2026 gece · Blue Marble, Jezero fotoğrafı ve renk kalibrasyonu

- **Dünya kartının yedeği:** Apollo 17'nin "Blue Marble" fotoğrafı (NASA, 7 Aralık 1972, AS17-148-22727). Kaynağı belli olmayan önceki görsel siteden kaldırıldı. EPIC'e ulaşılınca yine EPIC fotoğrafı gösteriliyor.
- **Mars kartı:** Viking küresi, Perseverance Mastcam-Z'nin Jezero'daki bir karesinin üzerinde duruyor (NASA/JPL-Caltech/ASU). Burası simülatörün bölgesi.
- **Renk kalibrasyonu:** Simülatörün öğle görüntüsü fotoğrafla karşılaştırıldı.

  | | Gökyüzü | Zemin |
  |---|---|---|
  | Mastcam-Z fotoğrafı | #f7d49a | #b99a71 |
  | Simülatör, önce | #dacdc2 (grimsi) | #9f653b (fazla kızıl) |
  | Simülatör, sonra | #efce98 | #b89b72 |

  - Zemin rengi üç adımda fotoğrafa oturtuldu.
  - Gökyüzü kubbesi artık ton eşlemesinden geçmiyor, fotoğraftaki renkle çiziliyor.
  - Kayalar gri-kahve yapıldı; toz bulutu ve görev haritası da aynı tonlara çekildi.
  - Ham Mastcam-Z kareleri radyometrik olarak kalibre edilmemiştir; eşleme kameranın kaydettiği renge göre yapıldı.
- **Mars renkleri neden değişti:** Önceki "kızıl Mars" görüntüsü gerçeğe uymuyordu. Jezero öğle saatinde açık kahve-bej zemin ve karamel rengi gökyüzüdür.
- **Değişmeyen:** fizik ve testler aynı.

### 8 Kasım 2026 gece · Ankara fotoğrafı ve Dünya renkleri

- **Dünya kartı:** takımın gönderdiği Ankara yakınındaki bozkır yolu fotoğrafı arka plan oldu. Kaynak satırı "kaynak eklenecek" diyor. Fotoğrafçı ve lisans bilgisi gelince eklenecek.
- **Dünya zemini:** simülatörde yeşil çayırdı (#646f46, kırmızı/yeşil 0,90). Fotoğraftaki güneş alan anız tarlalarına göre ayarlandı (#836539; kırmızı/yeşil 1,30, yeşil/mavi 1,78). Sonuç #826439, kasım bozkırı gibi sarı-kahve.
  - Görev haritası da aynı tonlara çekildi.
  - Daha önce gönderilen küçük bozkır fotoğrafı bunun yerine kaldırıldı.
- **Gökyüzü:** simülatörün gökyüzü fotoğraftakine zaten yakındı (simülatör #aebfd8, fotoğraf #96a6cb); değiştirilmedi.

## Açık kararlar (takımdan)

1. **Lisans:** Apache-2.0 öneriliyor; Space Apps varsayılanı bu.
2. **Depo:** GitHub'da yeni ve herkese açık bir depo, ör. `osiriszk-mars-explorer`. Bu oturuma bağlanırsa doğrudan gönderilebilir; bağlanmazsa yama ve zip ile devam edilir.
3. **`docs/flight-core.md`:** "askerî görev projeleri" paragrafı Space Apps deposunda kalsın mı?
