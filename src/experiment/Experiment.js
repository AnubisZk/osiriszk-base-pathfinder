import {Simulation} from '../sim/Simulation.js';
import {ProceduralTerrain} from '../terrain/terrain.js';
import {solarPlan,DEFAULT_MISSION} from '../mission/Mission.js';
import {getProfile} from '../planet/profiles.js';

/**
 * Scientific experiment runner: the same mission under controlled conditions, one or more
 * independent variables varied, every combination repeated over fixed seeds. Results are
 * deterministic: the same experiment definition gives the same numbers (tests/experiment.test.js).
 *
 * Independent variables (key → mission field):
 *   vehicle, frame, payload (kg), density (kg/m³ → overrides.surfaceDensity), wind (level),
 *   route (name of a route preset), profile
 * Dependent variables (per run): liftOff, canHover, success, flightTime, energyWh, energyPerKm,
 *   distance, observations, maxTilt, tiltRms, hoverRateRms, positionErrorRms, budgetEnergyWh, budgetError
 */
export const ROUTES=Object.freeze({
  short:{label:{en:'Short scouting hop (≈ 100 m)',tr:'Kısa keşif sıçraması (≈ 100 m)'},waypoints:[{x:0,z:-40,action:'observe',dwell:4,name:'Outcrop A'}],returnHome:true},
  standard:{label:{en:'Two science targets (≈ 150 m)',tr:'İki bilimsel hedef (≈ 150 m)'},waypoints:[{x:0,z:-40,action:'observe',dwell:4,name:'Outcrop A'},{x:30,z:-60,action:'observe',dwell:4,name:'Crater rim B'}],returnHome:true},
  survey:{label:{en:'Crater survey loop (≈ 330 m)',tr:'Krater tarama turu (≈ 330 m)'},waypoints:[{x:-40,z:-50,action:'observe',dwell:3,name:'S1'},{x:40,z:-90,action:'observe',dwell:3,name:'S2'},{x:80,z:-20,action:'observe',dwell:3,name:'S3'}],returnHome:true},
});
export const VARIABLES=Object.freeze({
  vehicle:{label:{en:'Vehicle',tr:'Araç'},apply:(m,v)=>({...m,vehicle:v})},
  frame:{label:{en:'Frame',tr:'Gövde'},apply:(m,v)=>({...m,frame:v})},
  payload:{label:{en:'Payload (kg)',tr:'Yük (kg)'},apply:(m,v)=>({...m,payload:+v})},
  density:{label:{en:'Air density (kg/m³)',tr:'Hava yoğunluğu (kg/m³)'},apply:(m,v)=>({...m,overrides:{...m.overrides,surfaceDensity:+v}})},
  wind:{label:{en:'Wind',tr:'Rüzgâr'},apply:(m,v)=>({...m,wind:{...m.wind,level:v}})},
  route:{label:{en:'Route',tr:'Güzergâh'},apply:(m,v)=>({...m,...ROUTES[v]})},
  profile:{label:{en:'Planet profile',tr:'Gezegen profili'},apply:(m,v)=>({...m,profile:v})},
  opticalDepth:{label:{en:'Dust optical depth τ',tr:'Toz optik derinliği τ'},apply:(m,v)=>({...m,opticalDepth:+v})},
  panelArea:{label:{en:'Solar panel area (m²)',tr:'Güneş paneli alanı (m²)'},apply:(m,v)=>({...m,panelArea:+v})},
});
export const DEPENDENT=Object.freeze(['liftOff','canHover','success','flightTime','energyWh','energyPerKm','distance','observations','maxTilt','tiltRms','hoverRateRms','positionErrorRms','budgetEnergyWh','budgetError','mass','flightsPer10Sols','harvestWhPerSol','nightWhPerSol','minSoC10Sols']);

/** All combinations of the variable values × seeds. */
export function plan(def){
  const vars=def.variables??[],seeds=def.seeds??[1];let combos=[{}];
  for(const v of vars)combos=combos.flatMap(c=>v.values.map(x=>({...c,[v.key]:x})));
  return combos.flatMap(c=>seeds.map(seed=>({conditions:c,seed})));
}

/**
 * Run an experiment. def: {name, base (mission spec), variables [{key, values}], seeds [..], timeLimit}.
 * onProgress(done, total, row). Returns {definition, rows, summary}.
 */
export function runExperiment(def,{onProgress=null,terrainCache=new Map()}={}){
  const runs=plan(def),rows=[];
  runs.forEach((r,i)=>{
    let m={...def.base,seed:r.seed,timeLimit:def.timeLimit??def.base?.timeLimit??240};
    for(const [k,v] of Object.entries(r.conditions)){if(!VARIABLES[k])throw new RangeError(`Unknown variable '${k}'`);m=VARIABLES[k].apply(m,v);}
    const planet=getProfile(m.profile??DEFAULT_MISSION.profile).planet,tSeed=def.terrainSeed??m.seed,tKey=`${planet}:${tSeed}`;
    if(!terrainCache.has(tKey))terrainCache.set(tKey,new ProceduralTerrain({seed:tSeed,planet}));
    const sim=new Simulation(m,{terrain:terrainCache.get(tKey),record:true});
    sim.start();const res=sim.run();
    const lifted=sim.telemetry.stats('agl').max>.5;
    const row={run:i+1,seed:r.seed,...r.conditions,liftOff:lifted,canHover:sim.control.canHover,success:res.success,reason:res.reason,
      flightTime:res.flightTime,energyWh:res.energyWh,energyPerKm:res.distance>1?res.energyWh/(res.distance/1000):NaN,distance:res.distance,
      observations:res.observations,maxTilt:res.maxTilt,tiltRms:res.tiltRms,hoverRateRms:res.hoverRateRms,positionErrorRms:res.positionErrorRms,
      budgetEnergyWh:sim.budget.energyWh,budgetError:Number.isFinite(sim.budget.energyWh)&&res.success?(sim.budget.energyWh-res.energyWh)/res.energyWh:NaN,mass:sim.built.mass};
    // energy over 10 sols with the measured flight energy (only for missions that succeeded)
    const plan=res.success?solarPlan(sim,res.energyWh):null;
    Object.assign(row,{flightsPer10Sols:plan?plan.flights*10/plan.days.length:0,harvestWhPerSol:plan?.meanHarvestWh??NaN,nightWhPerSol:plan?.meanNightWh??NaN,minSoC10Sols:plan?.minSoC??NaN});
    rows.push(row);sim.dispose();onProgress?.(i+1,runs.length,row);
  });
  return {definition:def,rows,summary:summarize(def,rows)};
}

/** Mean and sample standard deviation of each dependent variable per condition. */
export function summarize(def,rows){
  const keys=(def.variables??[]).map(v=>v.key),groups=new Map();
  for(const r of rows){const id=JSON.stringify(keys.map(k=>r[k]));if(!groups.has(id))groups.set(id,[]);groups.get(id).push(r);}
  return [...groups.values()].map(g=>{
    const out=Object.fromEntries(keys.map(k=>[k,g[0][k]]));out.runs=g.length;
    for(const d of DEPENDENT){
      const xs=g.map(r=>typeof r[d]==='boolean'?+r[d]:r[d]).filter(Number.isFinite);
      const mean=xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:NaN,sd=xs.length>1?Math.sqrt(xs.reduce((s,x)=>s+(x-mean)**2,0)/(xs.length-1)):0;
      out[d]=mean;out[d+'Sd']=sd;
    }
    return out;
  });
}

export function toCSV(rows){
  if(!rows.length)return '';
  const cols=Object.keys(rows[0]),esc=v=>{if(typeof v==='number')return Number.isFinite(v)?String(+v.toPrecision(7)):'';const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
  return cols.join(',')+'\n'+rows.map(r=>cols.map(c=>esc(r[c])).join(',')).join('\n')+'\n';
}
