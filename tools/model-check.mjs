// Model check against real Jezero conditions and at the highest terrain resolution.
//   node tools/model-check.mjs  →  reports/model-check.json + reports/model-check.md
// 1. Air density from the published MEDA pressure range and air temperature range at several local
//    times, against the brief's 0.020 kg/m³ and Ingenuity's design/flown range.
// 2. The Ingenuity-like helicopter flying the standard mission in those real conditions.
// 3. The same missions on terrain grids of 512², 1024² and 2048² cells (convergence).
import {mkdirSync,writeFileSync} from 'node:fs';
import {initializeRapier} from '../src/physics/FlightPhysics.js';
import {PlanetEnvironment} from '../src/planet/PlanetEnvironment.js';
import {Simulation} from '../src/sim/Simulation.js';
import {ProceduralTerrain} from '../src/terrain/terrain.js';
import {MEDA_PUBLISHED,marsConditions} from '../src/realdata/nasa.js';
import {EARTH_BASE} from '../src/experiment/presets.js';

await initializeRapier();
const r4=v=>+v.toFixed(4),r2=v=>+v.toFixed(2),M=MEDA_PUBLISHED;
const env=new PlanetEnvironment('mars-brief'),air={minTempC:M.airTemperature.minC,maxTempC:M.airTemperature.maxC};

// 1 — densities
const density=[];
for(const [season,P] of [['low',M.pressureMin],['high',M.pressureMax]])for(const lst of [6,9,12,15]){
  const c=marsConditions({...air,pressurePa:P.value},lst,env);density.push({season,pressurePa:P.value,ls:P.ls,lst,temperatureK:r2(c.temperature),density:r4(c.density)});
}
const brief={density:r4(env.density(0)),pressurePa:Math.round(env.surface.pressure),temperatureK:env.surface.temperature};

// 2 — Ingenuity in real conditions (midday, the flight window)
const fly=(spec,terrain)=>{const sim=new Simulation(spec,{terrain});sim.start();const r=sim.run();
  const o={success:r.success,reason:r.reason,energyWh:r2(r.energyWh),flightTime:r2(r.flightTime),maxTilt:r2(r.maxTilt),
    rpm:Math.round(sim.control.rpmSetpoint??NaN),thrustMargin:sim.control.trim?.thrustMax?r2(sim.control.trim.thrustMax/sim.control.W):null,meanPower:Math.round(sim.telemetry.stats('power').mean),landing:r2(Math.hypot(sim.vehicle.position.x,sim.vehicle.position.z))};
  sim.dispose();return o;};
const terrain512=new ProceduralTerrain({seed:2026,cells:[512,512]});
const flights=[];
for(const [label,ov] of [['brief 0.020',{}],
  ['MEDA high season, 12 h',marsConditions({...air,pressurePa:M.pressureMax.value},12,env).overrides],
  ['MEDA low season, 12 h',marsConditions({...air,pressurePa:M.pressureMin.value},12,env).overrides]]){
  const e=env.with(ov);flights.push({label,density:r4(e.density(0)),...fly({vehicle:'ingenuity-like',overrides:ov},terrain512)});
}

// 3 — terrain resolution
const resolution=[];
for(const cells of [512,1024,2048])for(const [world,spec] of [['mars',{vehicle:'ingenuity-like'}],['earth',{...EARTH_BASE}]]){
  const t0=performance.now(),terrain=new ProceduralTerrain({seed:2026,cells:[cells,cells],planet:world});const gen=performance.now()-t0;
  resolution.push({world,cells,cellSize:r2(1200/cells),generateMs:Math.round(gen),...fly(spec,terrain)});
}

const out={tool:'osiriszk-model-check',date:new Date().toISOString(),sources:{pressure:'Sánchez-Lavega et al. 2023, JGR Planets 128, e2022JE007480',
  airTemperature:'NASA/JPL MEDA release (air −83 … −23 °C)',ingenuity:'Grip 2021 (design 0.0145–0.0185, flown ≈ 0.012 kg/m³)'},
  note:'Temperature at a local time uses the simulator\'s diurnal shape between the published low and high (assumed).',brief,density,flights,resolution};
mkdirSync('reports',{recursive:true});writeFileSync('reports/model-check.json',JSON.stringify(out,null,1));
const md=[`# Model check (${out.date.slice(0,10)})`,'',
  `Sources: ${out.sources.pressure}; ${out.sources.airTemperature}; ${out.sources.ingenuity}. ${out.note}`,'',
  `## Air density at Jezero from published MEDA ranges`,'',`Brief profile: ${brief.density} kg/m³ (${brief.pressurePa} Pa, ${brief.temperatureK} K).`,'',
  '| Season | p (Pa) | Ls | LTST (h) | T (K) | ρ (kg/m³) |','|---|---|---|---|---|---|',
  ...density.map(d=>`| ${d.season} | ${d.pressurePa} | ${d.ls}° | ${d.lst} | ${d.temperatureK} | ${d.density} |`),'',
  `## Ingenuity-like helicopter, standard mission`,'','| Conditions | ρ | Result | rpm | Max thrust / weight | Mean power (W) | Energy (Wh) | Time (s) |','|---|---|---|---|---|---|---|---|',
  ...flights.map(f=>`| ${f.label} | ${f.density} | ${f.success?'success':'failed: '+f.reason} | ${f.rpm} | ${f.thrustMargin} | ${f.meanPower} | ${f.energyWh} | ${f.flightTime} |`),'',
  `## Terrain resolution (same analytic terrain, finer sampling)`,'','| World | Cells | Cell (m) | Generate (ms) | Result | Energy (Wh) | Time (s) | Max tilt (°) | Landing offset (m) |','|---|---|---|---|---|---|---|---|---|',
  ...resolution.map(r=>`| ${r.world} | ${r.cells}² | ${r.cellSize} | ${r.generateMs} | ${r.success?'success':'failed'} | ${r.energyWh} | ${r.flightTime} | ${r.maxTilt} | ${r.landing} |`),''].join('\n');
writeFileSync('reports/model-check.md',md);console.log(md);
