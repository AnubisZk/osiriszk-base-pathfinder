# Sources

Every number in the planet layer comes from one of these, from the team brief, or is marked
*assumed*. In code the same list is `SOURCES` in `src/planet/profiles.js`; each parameter's
source key is in `PlanetEnvironment.parameters()`.

## Data and models

| Key | Source | Used for |
|---|---|---|
| `nasaFactSheet` | NASA NSSDCA, *Mars Fact Sheet* — https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html | mean surface gravity 3.73 m/s²; surface density ~0.016 ± 0.006 kg/m³; pressure 6.36 mb (4.0–8.7); average temperature ~214 K; scale height 11.0 km; mean molecular weight 43.49; composition (CO₂ 95.1 %, N₂ 2.59 %, Ar 1.94 %, O₂ 0.16 %, CO 0.06 %); Viking wind ranges |
| `nasaGlenn` | NASA Glenn Research Center, *Mars Atmosphere Model – metric units* (fit to Mars Global Surveyor data) — https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/mars-atmosphere-equation-metric/ | the `mars-glenn` profile as published; lapse rates of the layered Mars model (−0.998 K/km below 7 km, −2.22 K/km above) |
| `isa` | *U.S. Standard Atmosphere, 1976*, NASA-TM-X-74335 — https://ntrs.nasa.gov/citations/19770009539 | Earth profile (identical to ISA below 32 km); layered hydrostatic construction |
| `janafCO2` | NIST-JANAF Thermochemical Tables, *Carbon dioxide (C-095)* — https://janaf.nist.gov/tables/C-095.html | cp(T) of CO₂ → γ of the Mars mixture (minor species: 298.15 K JANAF values) |
| `sutherlandCO2` | Sutherland constants for CO₂ (μ₀ 1.370e-5 Pa·s, T₀ 273 K, S 222 K; White, *Viscous Fluid Flow*), as tabulated in COMSOL CFD Module Table 5-2 — https://doc.comsol.com/6.4/doc/com.comsol.help.cfd/cfd_ug_fluidflow_high_mach.08.46.html | Mars gas viscosity → Reynolds numbers |
| `sutherlandAir` | Sutherland (1893); constants for air (1.716e-5 Pa·s, 273.15 K, 110.4 K) — https://www.cfd-online.com/Wiki/Sutherland_law | Earth air viscosity |
| `ingenuityDensity` | H. Grip (JPL), *Flying on Mars Is Getting Harder and Harder*, NASA, 2021 — https://science.nasa.gov/missions/mars-2020-perseverance/ingenuity-helicopter/flying-on-mars-is-getting-harder-and-harder/ | Ingenuity design density range 0.0145–0.0185 kg/m³; low-season 0.012 kg/m³; rotor speeds 2 537 / 2 700 / 2 800 rpm (Phase 2) |
| `marsSound` | DLR, *The sound of Mars*, 2022 (SuperCam microphone) — https://www.dlr.de/en/latest/news/2022/02/20220401_the-sound-of-mars | validation: ~240 m/s (low pitch) and ~250 m/s (high pitch) |
| `brief` | OsirisZk development brief, Phase 1 starting values | `mars-brief` profile: g 3.71 m/s², ρ 0.020 kg/m³, −60 °C (cross-checked against the Fact Sheet in each note) |

Physical constants: molar gas constant R = 8.314462618 J/(mol·K) (exact, 2019 SI); molar masses
from IUPAC standard atomic weights; standard gravity 9.80665 m/s².

Engineering relations used without a single source: ideal-gas law, hydrostatic equation, momentum
theory hover power P = T^1.5/√(2ρA) (standard rotorcraft theory, e.g. Leishman, *Principles of
Helicopter Aerodynamics*), propeller and rotorcraft thrust-coefficient conventions.

## Rotors, vehicles, time, terrain (Phases 2–6)

| Key | Source | Used for |
|---|---|---|
| `nasaMarsHeliCapabilities` | NASA Ames, *Mars helicopter capabilities* (Ingenuity, Mars Science Helicopter), Tables 1–6 — https://rotorcraft.arc.nasa.gov/Publications/files/MarsHeliCapabilities_Final_Update.pdf | clf5605 anchor (Re 2·10⁴, M 0.6, cl/cd 19.9 at cl 0.91, α 2.5°); Ingenuity R 0.605 m, σ 0.148, M_tip 0.7, 2575 rpm, CT/σ 0.10, 0.36 kW; MSH 20.8 kg, R 0.64 m, 6×6 blades, σ 0.25, 2435 rpm; Re 5 000–30 000 |
| `nasaGeometry` | Koning et al., *Ingenuity rotor geometry*, NASA TM 2024 — https://ntrs.nasa.gov/api/citations/20240001510/downloads/1699_Koning_TM_082124.pdf | blade area 0.170 m², σ 0.14782, rotor spacing 0.099 m, twist 16.3° / 17.6° / 0°, chord c/R 0.2021 at 0.3429 R and 0.0123 at the tip, 2600–2800 rpm |
| `jplPressKit` | NASA/JPL Ingenuity press kit — https://www.jpl.nasa.gov/news/press_kits/ingenuity/landing/mission/spacecraft | 1.8 kg, 1.2 m rotors, ≈ 2400 rpm, ≈ 350 W in flight (calibration target), six Li-ion cells, fuselage 13.6 × 19.5 × 16.3 cm, legs 0.384 m, clearance 0.13 m |
| `grip2021` | H. Grip (JPL), 2021 (see above) | 2537 rpm flown, 2700–2800 rpm in low density |
| `jplApproxPos` | JPL SSD, *Approximate positions of the planets*, Table 1 (1800–2050) — https://ssd.jpl.nasa.gov/planets/approx_pos.html | Earth–Moon barycentre and Mars elements → Earth–Mars distance and light time |
| `mars24` | Allison & McEwen (2000), *Planet. Space Sci.* 48, 215–235; NASA GISS Mars24 (https://www.giss.nasa.gov/tools/mars24/); coefficients checked against pyMarsTime (https://github.com/ashima/pyMarsTime) | Ls, MSD, MTC, equation of time, declination, local solar time, Sun elevation/azimuth |
| `golombek1997` | Golombek & Rapp (1997), *JGR* 102(E2) — https://doi.org/10.1029/96JE03319 | rock size–frequency model F(D) = k e^(−qD), q = 1.79 + 0.152/k |
| `jplSolarArray` | NASA/JPL, *Mars Helicopter's Solar Array (PIA24545)* — https://www.jpl.nasa.gov/images/pia24545-mars-helicopters-solar-array-as-seen-by-perseverances-mastcam-z/ | panel 425 × 165 mm; energy used for night heaters and flight; ≈ 350 W in flight |
| `appelbaum1989` | Appelbaum & Flood, *Solar radiation on Mars*, NASA-TM-102299 (1989) — https://ntrs.nasa.gov/citations/19890018252 | trend of global irradiance with optical depth (shape of the assumed diffuse-light term) |
| `noaaSolar` | NOAA Global Monitoring Laboratory, *General Solar Position Calculations* (Fourier series of J. W. Spencer, 1971, *Search* 2(5), 172) — https://gml.noaa.gov/grad/solcalc/solareqns.PDF | Earth simulator: Sun declination, equation of time, Earth–Sun distance (TOA irradiance 1361 W/m² × (r₀/r)²), Sun elevation/azimuth at Ankara (`src/earth/sun.js`); checked against solstice noon elevations and the equation-of-time extremes |
| `isa` (again) | U.S. Standard Atmosphere 1976 | Earth simulator air at the Ankara site (938 m, the city's approximate elevation, assumed) |
| `sanchezLavega2023` | Sánchez-Lavega et al. (2023), *Mars 2020 Perseverance rover studies of the Martian atmosphere over Jezero from pressure measurements*, JGR Planets 128, e2022JE007480 — https://doi.org/10.1029/2022JE007480 | real-conditions presets and model check: sol-averaged MEDA pressure 625 Pa (sol 306, Ls 101°) to 761 Pa (sol 105, Ls 55°), MY36; diurnal peak-to-peak ~20–50 Pa |
| `nasaMedaRelease` | NASA, *NASA's First Weather Report from Jezero Crater on Mars* (2021) — https://www.nasa.gov/directorates/stmd/nasas-first-weather-report-from-jezero-crater-on-mars/ ; JPL release on MEDA temperatures (air −83 … −23 °C) | MEDA air temperature range used with the published pressures; first pressure reading 718 Pa |
| `mars2020Weather` | NASA/JPL Mars 2020 weather feed (Perseverance MEDA, outreach product) — `https://mars.nasa.gov/rss/api/?feed=weather&category=mars2020&feedtype=json` | live "real conditions" in the Mars simulator: latest sol's air high/low (°C) and pressure (Pa); fetched in the browser, never stored |
| `nasaPower` | NASA POWER (Prediction Of Worldwide Energy Resources), Langley Research Center, hourly point API — https://power.larc.nasa.gov/docs/tutorials/service-data-request/api/ | live "real conditions" in the Earth simulator: T2M (°C), PS (kPa), WS10M (m/s), WD10M (°) at Ankara, 2–7 days behind real time |
| `nasaEpic` | NASA EPIC (Earth Polychromatic Imaging Camera on NOAA's DSCOVR), natural-colour API — https://epic.gsfc.nasa.gov/ | landing page: the day's full-disk Earth photo centred nearest Ankara's longitude (fetched in the browser; disk size from DSCOVR's distance and the 0.61° field of view) |
| `hirise` | HiRISE DTMs — https://www.uahirise.org/dtm/ | real terrain import (tools/import-dtm.mjs) |
| textbooks | Leishman, *Principles of Helicopter Aerodynamics*; Cheeseman & Bennett (1955) ground effect; Pitt & Peters dynamic inflow; Lock's drag-rise law; Prandtl tip loss; White, *Fluid Mechanics* (cylinder Cd ≈ 1 + 10/Re^(2/3)); Hoerner (flat plate Cd 1.17) | standard rotorcraft and fluid relations |

## Software

| Package | License | Role |
|---|---|---|
| ZSK flight core (`src/` outside `src/planet/`) | team's own code | rigid-body flight, controller, airframes, input |
| `@dimforge/rapier3d-compat` 0.21.0 | Apache-2.0 | physics engine |
| `three` 0.186.1 | MIT | math classes, rendering in the demo |
| `vite` 8.3.4 | MIT | development server / build (dev only) |
| `geotiff` 3.0.5 | MIT | DTM import tool (dev only) |

## Images

All NASA images below are public domain (NASA media guidelines); credit lines are shown on the page.

| File | Used for | Credit |
|---|---|---|
| `app/public/img/earth-blue-marble.webp` | landing page, Earth card when EPIC is unreachable | NASA, Apollo 17 crew, 7 Dec 1972, "Blue Marble" (AS17-148-22727) |
| EPIC photo (not stored) | landing page, Earth card | NASA EPIC / DSCOVR, date and time shown on the card |
| `app/public/img/mars-viking.webp` | landing page, Mars globe | sent by the team; identified as the Viking Orbiter colour mosaic (NASA/JPL/USGS) — confirm the source page |
| `app/public/img/ankara-road.webp` | landing page, Earth card background; reference for the Earth ground colour | sent by the team (a road through the steppe near Ankara, 678 × 452 px); photographer and licence to be added |
| `app/public/img/jezero-mastcamz.webp` | landing page, Mars card background; reference for the Mars scene colours | NASA/JPL-Caltech/ASU, Perseverance Mastcam-Z at Jezero (raw frame sent by the team; sol to be added). Raw frames are not radiometrically calibrated, so the colour match is to what the camera recorded |
