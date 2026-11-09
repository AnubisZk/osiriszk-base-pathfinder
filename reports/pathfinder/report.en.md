# Mars Base Pathfinder — mission report

*Generated: 2026-11-09T09:15:16.869Z · OsirisZk · costs are representative game values; synthetic terrain and assumptions are labelled*

## Answer: “Where should humanity establish its first Mars research base, and why?”

**Arcadia Planitia** — TOPSIS closeness C = 0.780; next: Jezero Crater C = 0.220.

**Why** (weighted, normalised advantage over Jezero Crater):

- Water-ice access (index 0–1): 0.85 ± 0.15 *(assumption)* vs 0.10 ± 0.20 *(assumption)* → in favour (+0.193)
- Scientific value (1–9): 6.00 ± 1.00 *(assumption)* vs 9.00 ± 1.00 *(assumption)* → against (-0.050)
- Slope and landing safety (%): 96.3 ± 3.0 *(simulation)* vs 75.4 ± 7.4 *(simulation)* → in favour (+0.034)
- Solar energy potential (Wh/m²/sol): 2536 ± 380 *(model)* vs 3232 ± 485 *(model)* → against (-0.024)

**How robust**: the winner stays first while each weight moves within:

- Water-ice access (now 0.22): 0.06 – 1.00; outside it: Jezero Crater
- Slope and landing safety (now 0.20): 0.00 – 1.00
- Solar energy potential (now 0.14): 0.00 – 0.56; outside it: Jezero Crater
- Temperature (now 0.08): 0.00 – 0.82; outside it: Jezero Crater
- Dust and wind risk (now 0.08): 0.00 – 0.99; beyond it the sites tie (this criterion does not separate them)
- Scientific value (now 0.18): 0.00 – 0.46; outside it: Jezero Crater
- Transport and communication (now 0.10): 0.00 – 1.00

Seeded Monte Carlo (2000 draws each): this site stays first in 74 % of draws with random weights, 99 % with the data varied within their uncertainties, 70 % with both.

**What it rests on**: 3 × User assumption, 1 × Drone simulation, 3 × Model (computed). Assumptions can be edited and NASA data imported; the decision is recomputed.

*Criteria that do not separate the sites with the current data: Dust and wind risk.*

## 1. Mission budget (representative)

| Item | M USD |
|---|---:|
| Mars scout drone (airframe, motors, avionics) | 25 |
| Camera (standard) | 10 |
| Energy system (standard battery + solar panel) | 15 |
| Mission infrastructure (landing platform share, relay, operations) | 20 |
| **Total** | **70** |
| Remaining of 100 | 30 |

*Representative game costs, not real mission estimates.*

## 2. Scout drone

- Rotor: 0.50 m rotors (standard) · battery: Standard: 6S2P Li-ion (12 cells) · camera: Standard 13 MP colour (Ingenuity class) · frame: Conventional carbon fibre
- Camera: 4208 × 3120 px, 1.12 µm, f = 3.4 mm, 0.2 kg, 3 W, σpx 0.5 (pixel count of the standard camera from the Ingenuity press kit; the rest assumed)
- Mass, centre of mass, inertia and drag only. Structural strength is not simulated: finite-element analysis (FEA) and tests are required.

| Site | mass kg | ρ kg/m³ | T/W | hover W | planned energy Wh | available Wh | range m | checks |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Jezero Crater | 2.98 | 0.0185 | 1.48 | 498 | 66.2 | 82.6 | 2448 | ✓ |
| Arcadia Planitia | 2.98 | 0.0213 | 1.72 | 450 | 59.8 | 82.6 | 2714 | ✓ |
| Mawrth Vallis | 2.98 | 0.0185 | 1.47 | 496 | 66.0 | 82.6 | 2455 | ✓ |

## 3. Candidate sites and their data

| Criterion | Jezero Crater | Arcadia Planitia | Mawrth Vallis |
|---|---|---|---|
| Water-ice access (index 0–1, higher better) | 0.10 ± 0.20 *(assumption)* | 0.85 ± 0.15 *(assumption)* | 0.15 ± 0.20 *(assumption)* |
| Slope and landing safety (%, higher better) | 75.4 ± 7.4 *(simulation)* | 96.3 ± 3.0 *(simulation)* | 44.0 ± 7.4 *(simulation)* |
| Solar energy potential (Wh/m²/sol, higher better) | 3232 ± 485 *(model)* | 2536 ± 380 *(model)* | 3142 ± 471 *(model)* |
| Temperature (K, higher better) | 207 ± 15 *(model)* | 195 ± 15 *(model)* | 205 ± 15 *(model)* |
| Dust and wind risk (τ, lower better) | 0.50 ± 0.20 *(assumption)* | 0.50 ± 0.20 *(assumption)* | 0.50 ± 0.20 *(assumption)* |
| Scientific value (1–9, higher better) | 9.00 ± 1.00 *(assumption)* | 6.00 ± 1.00 *(assumption)* | 8.00 ± 1.00 *(assumption)* |
| Transport and communication (Pa, higher better) | 804 ± 121 *(model)* | 872 ± 131 *(model)* | 797 ± 119 *(model)* |
| Latitude (°N) | 18.445 *(published)* | 42.000 *(assumption)* | 22.600 *(assumption)* |
| Longitude (°E) | 77.451 *(published)* | 192.000 *(assumption)* | 343.500 *(assumption)* |
| Elevation, MOLA datum (m) | -2600 ± 300 *(assumption)* | -3500 ± 400 *(assumption)* | -2500 ± 400 *(assumption)* |

**Provenance of each value**

*Jezero Crater*

- **Water-ice access**: 0.10 ± 0.20 *(assumption)* — source: —; rationale: 18° N: near-surface ice is not expected this close to the equator (ez2015, piqueux2019); water would come from hydrated minerals
- **Slope and landing safety**: 75.4 ± 7.4 *(simulation)* — source: drone survey; resolution: 1 m grid · GSD 6.8 mm/px · 144 photos; steps: stereo heights from photo pairs, σZ = (H/B)·GSD·σpx = 13.7 mm → slope over 2 m ≤ 10° and no rock ≥ 0.5 m (rocks seen when ≥ 3 px) → uncertainty: sampling 2.8 % ⊕ threshold 6.9 %; Measured over the SYNTHETIC terrain of this site (assumed relief and rocks); load a DTM for real slopes
- **Solar energy potential**: 3232 ± 485 *(model)* — source: Allison & McEwen (2000), Mars24 solar time algorithm (NASA GISS); steps: Sun position over one Mars year (Mars24), latitude 18.44° (published) → beam exp(−τ/μ) + assumed diffuse term, τ = 0.50 (assumption) → mean over 67 sampled sols, 15-min steps; ±15 %: diffuse-light shape and dust season not resolved
- **Temperature**: 207 ± 15 *(model)* — source: NASA Mars Fact Sheet (NSSDCA); steps: radiative balance T = ((1 − A)·Ī / (ε σ))^¼ with A = 0.25, ε = 0.95 (assumed) → Ī = 131.0 W/m² from the insolation model; Annual mean surface temperature; no atmosphere greenhouse, no thermal inertia (±15 K)
- **Dust and wind risk**: 0.50 ± 0.20 *(assumption)* — source: —; rationale: No site-specific dust climatology imported: global annual mean τ ≈ 0.5 assumed at every site, so this criterion does not separate the sites until data are imported
- **Scientific value**: 9.00 ± 1.00 *(assumption)* — source: —; rationale: Delta and lake sediments with organics potential; Perseverance cached samples; MEDA weather record
- **Transport and communication**: 804 ± 121 *(model)* — source: NASA Mars Fact Sheet (NSSDCA); steps: p = 636 Pa · exp(−h / 11.1 km), h = -2600 m (assumption); Annual mean; seasonal swing about ±25 % (Fact Sheet 4.0–8.7 mb)
- **Latitude (°N)**: 18.4 *(published)* — source: NASA GISS, Mars lander missions (coordinates of Mars landing sites), via Wikipedia "Octavia E. Butler Landing"
- **Elevation, MOLA datum (m)**: -2600 ± 300 *(assumption)* — source: —; rationale: Approximate; replace with a MOLA MEGDR sample (raster adapter)

*Arcadia Planitia*

- **Water-ice access**: 0.85 ± 0.15 *(assumption)* — source: —; rationale: Piqueux et al. 2019: ice within ~30 cm of the surface in parts of Arcadia Planitia, "the most tempting target"
- **Slope and landing safety**: 96.3 ± 3.0 *(simulation)* — source: drone survey; resolution: 1 m grid · GSD 6.7 mm/px · 144 photos; steps: stereo heights from photo pairs, σZ = (H/B)·GSD·σpx = 13.4 mm → slope over 2 m ≤ 10° and no rock ≥ 0.5 m (rocks seen when ≥ 3 px) → uncertainty: sampling 1.2 % ⊕ threshold 2.7 %; Measured over the SYNTHETIC terrain of this site (assumed relief and rocks); load a DTM for real slopes
- **Solar energy potential**: 2536 ± 380 *(model)* — source: Allison & McEwen (2000), Mars24 solar time algorithm (NASA GISS); steps: Sun position over one Mars year (Mars24), latitude 42.00° (assumption) → beam exp(−τ/μ) + assumed diffuse term, τ = 0.50 (assumption) → mean over 67 sampled sols, 15-min steps; ±15 %: diffuse-light shape and dust season not resolved
- **Temperature**: 195 ± 15 *(model)* — source: NASA Mars Fact Sheet (NSSDCA); steps: radiative balance T = ((1 − A)·Ī / (ε σ))^¼ with A = 0.25, ε = 0.95 (assumed) → Ī = 102.8 W/m² from the insolation model; Annual mean surface temperature; no atmosphere greenhouse, no thermal inertia (±15 K)
- **Dust and wind risk**: 0.50 ± 0.20 *(assumption)* — source: —; rationale: No site-specific dust climatology imported: global annual mean τ ≈ 0.5 assumed at every site, so this criterion does not separate the sites until data are imported
- **Scientific value**: 6.00 ± 1.00 *(assumption)* — source: —; rationale: Ice and recent-climate record; younger, less diverse geology than the crater sites
- **Transport and communication**: 872 ± 131 *(model)* — source: NASA Mars Fact Sheet (NSSDCA); steps: p = 636 Pa · exp(−h / 11.1 km), h = -3500 m (assumption); Annual mean; seasonal swing about ±25 % (Fact Sheet 4.0–8.7 mb)
- **Latitude (°N)**: 42.0 *(assumption)* — source: —; rationale: Representative point inside the shallow-ice part of Arcadia Planitia (team choice; region from piqueux2019)
- **Elevation, MOLA datum (m)**: -3500 ± 400 *(assumption)* — source: —; rationale: Approximate; replace with a MOLA MEGDR sample (raster adapter)

*Mawrth Vallis*

- **Water-ice access**: 0.15 ± 0.20 *(assumption)* — source: —; rationale: 22° N: no shallow ice expected; abundant hydrated clays as a water source
- **Slope and landing safety**: 44.0 ± 7.4 *(simulation)* — source: drone survey; resolution: 1 m grid · GSD 6.8 mm/px · 128 photos; steps: stereo heights from photo pairs, σZ = (H/B)·GSD·σpx = 13.7 mm → slope over 2 m ≤ 10° and no rock ≥ 0.5 m (rocks seen when ≥ 3 px) → uncertainty: sampling 3.2 % ⊕ threshold 6.6 %; Measured over the SYNTHETIC terrain of this site (assumed relief and rocks); load a DTM for real slopes
- **Solar energy potential**: 3142 ± 471 *(model)* — source: Allison & McEwen (2000), Mars24 solar time algorithm (NASA GISS); steps: Sun position over one Mars year (Mars24), latitude 22.60° (assumption) → beam exp(−τ/μ) + assumed diffuse term, τ = 0.50 (assumption) → mean over 67 sampled sols, 15-min steps; ±15 %: diffuse-light shape and dust season not resolved
- **Temperature**: 205 ± 15 *(model)* — source: NASA Mars Fact Sheet (NSSDCA); steps: radiative balance T = ((1 − A)·Ī / (ε σ))^¼ with A = 0.25, ε = 0.95 (assumed) → Ī = 127.4 W/m² from the insolation model; Annual mean surface temperature; no atmosphere greenhouse, no thermal inertia (±15 K)
- **Dust and wind risk**: 0.50 ± 0.20 *(assumption)* — source: —; rationale: No site-specific dust climatology imported: global annual mean τ ≈ 0.5 assumed at every site, so this criterion does not separate the sites until data are imported
- **Scientific value**: 8.00 ± 1.00 *(assumption)* — source: —; rationale: One of the thickest and most diverse clay sequences on Mars; proposed Exploration Zone (ez2015)
- **Transport and communication**: 797 ± 119 *(model)* — source: NASA Mars Fact Sheet (NSSDCA); steps: p = 636 Pa · exp(−h / 11.1 km), h = -2500 m (assumption); Annual mean; seasonal swing about ±25 % (Fact Sheet 4.0–8.7 mb)
- **Latitude (°N)**: 22.6 *(assumption)* — source: —; rationale: Representative point near the candidate landing ellipses (team choice)
- **Elevation, MOLA datum (m)**: -2500 ± 400 *(assumption)* — source: —; rationale: Approximate; replace with a MOLA MEGDR sample (raster adapter)

## 4. Survey flights (Rapier, autonomous)

Route: 80 m × 80 m, 20 m AGL, 4 m/s, overlap 75 / 60 %.

| Site | result | s | Wh | photos | stereo cover | GSD mm | σZ mm | safe area % | truth (synthetic) % | DEM RMSE mm | hazard rocks |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Jezero Crater | ✓ complete | 477 | 65.8 | 144 | 95 % | 6.8 | 13.7 | 75.4 ± 7.4 | 75.7 | 13.7 | 62 / 62 |
| Arcadia Planitia | ✓ complete | 476 | 59.7 | 144 | 95 % | 6.7 | 13.4 | 96.3 ± 3.0 | 96.5 | 13.5 | 7 / 7 |
| Mawrth Vallis | ✓ complete | 474 | 65.5 | 128 | 95 % | 6.8 | 13.7 | 44.0 ± 7.4 | 44.2 | 13.7 | 59 / 59 |

*The drone measures the surface only: slopes and rocks from stereo photos. Subsurface ice, radiation and climate are never shown as drone measurements. Terrain is synthetic unless a DTM was loaded, so the "truth" column checks the method, not Mars.*

## 5. Mandatory safety conditions

| Rule | threshold | Jezero Crater | Arcadia Planitia | Mawrth Vallis |
|---|---|---|---|---|
| Latitude within ±50° (published) | 50 ° | ✓ 18.4 | ✓ 42.0 | ✓ 22.6 |
| Low enough for entry, descent and landing (assumption) | -1000 m | ✓ -2600 | ✓ -3500 | ✓ -2500 |
| Landing area surveyed by the drone (assumption) | 60 % | ✓ 95.1 | ✓ 95.1 | ✓ 95.1 |
| Enough safe landing ground (assumption) | 50 % | ✓ 75.4 | ✓ 96.3 | ✗ 44.0 |

- Latitude within ±50°: NASA 2015 Exploration Zone guideline for the first human missions
- Low enough for entry, descent and landing: Team assumption: heavy landers need the thicker air of the lowlands (MOLA elevation ≤ −1 km)
- Landing area surveyed by the drone: No site is certified without a landing-scale survey; at least this share of the area seen in stereo
- Enough safe landing ground: Team assumption: at least half of the surveyed ground must be safe (slope and rocks)

## 6. Decision matrix and TOPSIS

| Criterion | weight | direction | Jezero Crater | Arcadia Planitia |
|---|---:|---|---:|---:|
| Water-ice access | 0.220 | benefit (higher better) | 0.100 | 0.850 |
| Slope and landing safety | 0.200 | benefit (higher better) | 75.378 | 96.335 |
| Solar energy potential | 0.140 | benefit (higher better) | 3232 | 2536 |
| Temperature | 0.080 | benefit (higher better) | 206.674 | 194.525 |
| Dust and wind risk | 0.080 | cost (lower better) | 0.500 | 0.500 |
| Scientific value | 0.180 | benefit (higher better) | 9.000 | 6.000 |
| Transport and communication | 0.100 | benefit (higher better) | 803.866 | 871.760 |
| D⁺ | | | 0.1959 | 0.0554 |
| D⁻ | | | 0.0554 | 0.1959 |
| **C** | | | **0.220** | **0.780** |
| rank | | | 2 | 1 |

Steps: r = x / √Σx² · v = w r · ideal v⁺ and anti-ideal v⁻ per criterion · D± = √Σ(v − v±)² · C = D⁻/(D⁺ + D⁻).

## 7. Model checks

- Jezero pressure model 804 Pa vs MEDA sol-averaged 625–761 Pa (published); the model uses the Fact Sheet mean-radius pressure and an approximate elevation.
- Jezero temperature model 206.7 K vs MEDA air 190.1–250.1 K (mid-range 220.1 K).
- Models: p = 636 Pa · exp(−h / 11.1 km); T = ((1 − 0.25)·Ī / (0.95 σ))^¼; insolation from the Mars24 Sun with Beer–Lambert dust attenuation.

## 8. Assumptions and limitations

- All money values are representative game costs.
- The local terrain of each site is synthetic (assumed relief, craters and rocks) unless a DTM is loaded; the landing-safety number then tests the method, not the real site.
- Ice index, dust τ, science score and the elevations are assumptions with written rationale until NASA rasters are imported (SWIM, MOLA).
- Solar, temperature and pressure are first-order models (±15 %), not climate data.
- TOPSIS treats criteria as independent; solar, temperature and dust are physically linked, so their combined weight counts the Sun more than once.
- Surveying three sites with one drone design is a game simplification: a real campaign would need a landing at each site.
- No structural analysis of the frames; the mass and inertia changes are applied, strength is not claimed.
- The energy plan adds a turn time per waypoint calibrated against this simulator (3.5 s + 2 s per m/s).

## 9. Sources

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
