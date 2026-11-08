# Model check (2026-11-08)

Sources: Sánchez-Lavega et al. 2023, JGR Planets 128, e2022JE007480; NASA/JPL MEDA release (air −83 … −23 °C); Grip 2021 (design 0.0145–0.0185, flown ≈ 0.012 kg/m³). Temperature at a local time uses the simulator's diurnal shape between the published low and high (assumed).

## Air density at Jezero from published MEDA ranges

Brief profile: 0.02 kg/m³ (815 Pa, 213.15 K).

| Season | p (Pa) | Ls | LTST (h) | T (K) | ρ (kg/m³) |
|---|---|---|---|---|---|
| low | 625 | 101° | 6 | 190.15 | 0.0172 |
| low | 625 | 101° | 9 | 223.48 | 0.0146 |
| low | 625 | 101° | 12 | 245.58 | 0.0133 |
| low | 625 | 101° | 15 | 244.26 | 0.0134 |
| high | 761 | 55° | 6 | 190.15 | 0.0209 |
| high | 761 | 55° | 9 | 223.48 | 0.0178 |
| high | 761 | 55° | 12 | 245.58 | 0.0162 |
| high | 761 | 55° | 15 | 244.26 | 0.0163 |

## Ingenuity-like helicopter, standard mission

| Conditions | ρ | Result | rpm | Max thrust / weight | Mean power (W) | Energy (Wh) | Time (s) |
|---|---|---|---|---|---|---|---|
| brief 0.020 | 0.02 | success | 2537 | 2.23 | 343 | 7.68 | 80.56 |
| MEDA high season, 12 h | 0.0162 | success | 2537 | 1.78 | 350 | 7.87 | 80.7 |
| MEDA low season, 12 h | 0.0133 | success | 2537 | 1.45 | 352 | 7.96 | 81.23 |

## Terrain resolution (same analytic terrain, finer sampling)

| World | Cells | Cell (m) | Generate (ms) | Result | Energy (Wh) | Time (s) | Max tilt (°) | Landing offset (m) |
|---|---|---|---|---|---|---|---|---|
| mars | 512² | 2.34 | 49 | success | 7.68 | 80.56 | 11.96 | 0.07 |
| earth | 512² | 2.34 | 40 | success | 2.2 | 68.14 | 25.57 | 0.05 |
| mars | 1024² | 1.17 | 136 | success | 7.68 | 80.56 | 11.96 | 0.07 |
| earth | 1024² | 1.17 | 105 | success | 2.2 | 68.15 | 25.54 | 0.06 |
| mars | 2048² | 0.59 | 512 | success | 7.68 | 80.56 | 11.96 | 0.06 |
| earth | 2048² | 0.59 | 457 | success | 2.21 | 68.14 | 25.51 | 0.05 |
