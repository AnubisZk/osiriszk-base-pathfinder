# OsirisZk · Earth & Mars rotorcraft simulators

Two real-time, physics-based simulators on one core: **Mars Aerial Explorer** for designing Mars
exploration rotorcraft, planning their missions at Jezero and comparing designs in reproducible
experiments, and **Earth Flight Lab** for flying and testing the same vehicles over hills near
Ankara. Built for the NASA Space Apps Challenge 2026 (Ankara) by team **OsirisZk** on the team's own
FPV flight core (Rapier rigid-body physics, fixed 240 Hz step).

```bash
npm install
npm run check        # 105 tests + the 5" core reference trace (must print "AYNI")
npm run dev:app      # landing page → Earth or Mars simulator (English / Türkçe)
npm run experiments  # all 14 experiments (9 Mars, 5 Earth) → reports/experiments/*.json|csv
npm run build        # static site in dist/ (any static host; Netlify short links included)
```

## Two simulators

| | Earth Flight Lab (`?world=earth`, `/earth`) | Mars Aerial Explorer (`?world=mars`, `/mars`) |
|---|---|---|
| Site | Ankara 39.93°N 32.85°E, 938 m | Jezero 18.44°N 77.45°E |
| Air and gravity | ISA (U.S. Standard Atmosphere 1976), 9.81 m/s² | Mars profiles (brief, NASA Fact Sheet, NASA Glenn, Ingenuity design range), 3.71 m/s² |
| Sun | NOAA / Spencer (1971) equations | Mars24 |
| Pilot link | on site, no delay | from Earth with the real light time (3–22 min), or hypothetical on-site FPV |
| Wind | core Earth levels: calm, 3, 6, 9 m/s | Viking ranges: calm, summer, fall, dust storm |
| Terrain | procedural hills, no craters, sparse rocks — labelled *not survey or map data* | procedural craters and Golombek–Rapp rocks — labelled *not NASA data*; real DTM import |
| Energy | battery only (the multi-sol solar model is Mars-specific) | battery + solar charging and night heating over sols |
| Default vehicle | 5" FPV quad | Ingenuity-like coaxial helicopter |
| Experiments | vehicles, payload, wind, frames, route, Earth vs Mars | frames, density, vehicles, payload, wind, route, solar, panel, Earth vs Mars |

Opening the site without a world shows a landing page with both. The header's Earth | Mars switch
changes world and keeps the language and other settings. All vehicles are available in both worlds.

### Controls (both simulators)

| | Keyboard | Xbox / standard controller (Mode 2) |
|---|---|---|
| Climb / descend | W / S | left stick up / down |
| Yaw | A / D | left stick left / right |
| Pitch / roll | arrow keys | right stick |
| Launch mission | button in the Mission panel | A |
| Land now | L | B |
| Camera (chase → navigation → orbit) | C | Y |
| Control mode (before launch) | Mission or Flight panel | X |
| Reset | button in the Mission panel | Menu |

Sticks fly the vehicle in the FPV modes; in autonomous mode the vehicle flies its waypoints. On
Mars, FPV-from-Earth input is delayed by the light time (the vehicle lands on failsafe); on-site
FPV is direct. Browsers expose a controller only after its first button press; the HUD then shows
"🎮 … controller connected".

### Deploying (Netlify)

`npm run build` writes a static site to `dist/` with relative paths and a `_redirects` file, so
`https://<site>.netlify.app/earth` and `/mars` open the two simulators directly. Drag `dist/` into
Netlify, or set the build command to `npm run build` and the publish directory to `dist`.

## What it does

| Phase | In this repository |
|---|---|
| 1 Mars physics | Earth/Mars environments with sourced parameters, hydrostatic atmosphere, CO₂ gas properties; Rapier gravity per planet; aerodynamic forces and torques on rigid bodies |
| 2 Rotors and flight | Blade-element rotor model with Reynolds- and Mach-dependent airfoil polars, momentum and dynamic inflow, tip loss, ground effect, coaxial interference; BLDC motors with speed governor; Li-ion battery; four vehicles flying only by forces and torques |
| 3 Frames | Conventional carbon, C60 (truncated icosahedron) lattice, hexagonal honeycomb shell. Exact mass, centre of mass and inertia tensor, drag areas, effect on flight and energy (no stress analysis: FEA is still required) |
| 4 Mars surface | Mars24 Sun position, dust optical depth, procedural crater terrain with the Golombek–Rapp rock model (always labelled *not NASA data*), importer for real HiRISE/USGS DTMs |
| Energy over sols | Solar panel (Mars24 Sun, dust optical depth τ, Beer–Lambert beam + assumed diffuse light), diurnal temperature (Viking 1 range), night heater, panel dust loss; "can we fly today?" look-ahead; flights per 10 sols |
| 5 Mission game | Vehicle/frame/payload design, waypoint map, pre-flight energy budget, autonomous flight, FPV from Earth with the real light-time delay (fails; the vehicle lands on failsafe), telemetry, results |
| 6 Experiments | Full-factorial runner with fixed seeds (frame, mass, rotor system, density, wind, route, planet); summary statistics, charts, CSV/JSON |
| 7 Interface | Mission control panels: environment, design lab, mission, flight, telemetry, experiments, report (EN/TR) |
| 8 Performance | Physics decoupled from rendering (interpolated), instancing, quality presets, in-app FPS/CPU/physics/GPU-timer HUD and a 10 s benchmark export; optional WebGPU path (`?renderer=webgpu`) |
| 9 Validation | 105 automated tests (46 core + 59 new; below) |
| Earth simulator | Ankara site, ISA air, NOAA Sun, local pilot, Earth winds, procedural Earth terrain, Earth experiments, Xbox controller in both worlds |

### Key results (default settings, `reports/`)

- A standard 5" FPV quad cannot take off on Mars at any motor speed. The Ingenuity-like coaxial
  helicopter hovers at ≈ 350 W, matching the published figure.
- The same Ingenuity-like vehicle cannot lift off on Earth: its motors reach their current limit
  before Earth hover torque. Its rotors were built for Mars air.
- The C60 lattice frame adds 113 g and costs 3 % more energy on the same mission. The hexagonal
  shell adds 144 g and costs 4 % more.
- At a fixed rotor speed, energy is lowest at 0.0145–0.0165 kg/m³ and rises in both thinner and
  denser air.
- Energy: a solar panel cannot power flight directly. Ingenuity's 425 × 165 mm panel gives ≈ 5–8 W at noon against ≈ 350 W in flight. It recharges the battery instead: ≈ 52 Wh/sol at τ 0.5 against ≈ 25 Wh of night heating and sleep (both partly assumed). That allows a flight every clear sol. At τ 4 only 2 flights in 10 sols are possible and the battery is drained, which is the dust-storm risk. The OsirisZk quad needs ≈ 0.25 m² of panel at τ 1.
- From Earth the one-way light time is 3–22 min (11 min on 14 Nov 2026), so real-time FPV is
  impossible. Commands arrive after the vehicle's failsafe has landed it.
- Earth (Ankara, 938 m): the 5" quad flies the two-target survey on 2.2 Wh; the OsirisZk Mars quad
  and the Mars Science Helicopter concept hexacopter also fly (their large rotors meet dense air); the Ingenuity-like
  helicopter still cannot lift off (motor current limit). Wind up to 9 m/s raises the 5" quad's
  energy by ≈ 8 %.

## Validation (tests/)

- Atmosphere:
  - ISA table values.
  - Mars scale height and molar mass (NASA Fact Sheet).
  - Mars speed of sound (SuperCam).
  - Hydrostatic balance and the ideal-gas law.
  - NASA Glenn fit.
- Mechanics:
  - Free fall on Earth and Mars, and the fall-time ratio.
  - Mass–weight consistency (contact force = m·g).
  - Terminal velocity (tanh solution).
  - Energy balance with drag work.
  - Angular momentum (Dzhanibekov flip).
- Physics step:
  - 30/60/144/240 Hz rendering gives an identical state.
  - The same wind seed gives the same flight.
- Rotor:
  - The published airfoil point is reproduced exactly.
  - CT falls with Reynolds number; drag rises past the critical Mach number.
  - FM < 1; induced power ≥ the ideal value.
  - Static and dynamic inflow agree.
  - NASA Ingenuity geometry: blade area, solidity, tip Mach 0.70, CT/σ 0.10 design point.
  - End-to-end hover power in Rapier is 350 W ± 8 %.
- Frames: closed-form inertias; C60 topology (60 / 90 / 32, Euler); published masses (1.8 kg, 20.8 kg, 0.65 kg).
- Vehicles: every Mars-capable vehicle holds 5 m in Rapier; the 5" quad stays on the ground.
- Mars time: Mars24 reference values (Ls, MTC, MSD); solar noon; morning Sun in the east; light time 3–22.5 min.
- Terrain: deterministic; the Rapier heightfield agrees with the height function; the rock model holds; DTM import keeps the slopes.
- Missions: autonomous mission and budget; identical telemetry on repeat; FPV through the light-time link fails; FPV with no delay succeeds.
- Energy over sols: the irradiance model's limits; Viking 1 temperature extremes; the battery ledger closes; dust-storm and panel-area trends; the fly/no-fly policy.
- Experiments: deterministic runs, summary and CSV; terrain generated per planet.
- Earth simulator: Ankara solstice noon Sun elevations (90° − φ ± 23.44°), equation-of-time extremes, perihelion/aphelion irradiance ratio; ISA density at 938 m; no light delay and no Mars energy model on Earth; Earth terrain has no craters and flyable slopes; the 5" quad flies the Earth survey autonomously and with an on-site FPV pilot; the Ingenuity-like rotorcraft cannot lift off; world URLs and defaults; every English UI string has a Turkish one.

## Calibration and assumptions

- Mars rotor airfoil:
  - Anchored at the published clf5605 point (Re 2·10⁴, M 0.6: cl/cd 19.9 at cl 0.91).
  - The shape around it is assumed.
  - A lumped profile-loss factor of 3.0 is calibrated so the Ingenuity-like vehicle needs the published ≈ 350 W in hover. The uncalibrated model gives ≈ 200 W; the in-app switch shows both.
- Ingenuity rotor: radius, blades, spacing, twist endpoints, peak and tip chord are from the NASA geometry report; the inner chord shape is assumed.
- Solar and thermal: cell efficiency (0.28), packing, charge efficiency, diffuse-light shape, thermal conductance, sleep power and panel dust loss (0.2 %/sol) are assumed. The panel size is sourced (JPL) and the temperature range is sourced (Viking 1); every value is editable in the app.
- Vehicles: component masses, motors and batteries are assumed unless stated. A calibration mass makes published totals (1.8 kg, 20.8 kg, 0.65 kg) exact.
- Not modelled:
  - Rotor flapping blow-back in edgewise flow.
  - Dust effects on sensors.
  - Battery temperature.
  - Structural strength.
- Every value is labelled *sourced / brief / derived / assumed / scenario* in code, the app and reports.

## Real NASA terrain

The app ships with labelled procedural terrain. To fly over real terrain:

1. Download a Jezero DTM GeoTIFF, from the [HiRISE DTM](https://www.uahirise.org/dtm/) page or the USGS Mars 2020 TRN HiRISE mosaic.
2. Convert it:
   `node tools/import-dtm.mjs jezero.tif --name jezero --size 1200 --cells 512 --title "Jezero HiRISE DTM" --credit "NASA/JPL/UArizona/USGS"`.
3. Open the app with `?terrain=jezero`.

## Architecture

```
src/physics, drone, controllers, flight   ZSK flight core (unchanged; docs/flight-core.md)
src/planet/      environments, atmosphere, MarsPhysics (Rapier world), core-on-a-planet adapter
src/aero/        airfoil polars, blade-element rotor, rotor definitions
src/power/       motor + governor, battery
src/frames/      mass properties, carbon / C60 / hex-cell frames
src/vehicles/    vehicle presets, assembly, RotorcraftVehicle (forces and torques in Rapier)
src/control/     cascaded flight control and allocation (coaxial, multirotor)
src/mars/        Mars24 time and Sun, Earth–Mars light time
src/earth/       Earth Sun (NOAA / Spencer), Ankara site
src/terrain/     procedural and DTM terrain, Rapier heightfield
src/mission/     mission spec, energy budget, executive, delayed link
src/sim/         Simulation, telemetry, planet wind
src/experiment/  experiment runner and presets
app/             landing page, world configs (worlds.js), mission control UI, rendering, worker, report
tools/           experiments, comparison, benchmarks, DTM import, core trace
```

## Sources

Full list with what each is used for: [`docs/SOURCES.md`](docs/SOURCES.md). The main ones:

- [NASA Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)
- [NASA Glenn Mars atmosphere model](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/mars-atmosphere-equation-metric/)
- [NASA Ames: Mars helicopter capabilities](https://rotorcraft.arc.nasa.gov/Publications/files/MarsHeliCapabilities_Final_Update.pdf)
- [NASA TM 2024: Ingenuity rotor geometry](https://ntrs.nasa.gov/api/citations/20240001510/downloads/1699_Koning_TM_082124.pdf)
- [JPL Ingenuity press kit](https://www.jpl.nasa.gov/news/press_kits/ingenuity/landing/mission/spacecraft)
- [JPL approximate planetary positions](https://ssd.jpl.nasa.gov/planets/approx_pos.html)
- Mars24 (Allison & McEwen 2000)
- Golombek & Rapp (1997)

Software: Rapier (Apache-2.0), three.js (MIT), Vite (MIT), geotiff.js (MIT, import tool only).

## License

To be decided by the team before submission. Space Apps requires openly available materials; the
challenge default is Apache-2.0.
