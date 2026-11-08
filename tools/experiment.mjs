// Deney koşucusu: node tools/experiment.mjs <ad|all> [--out reports/experiments]
// Aynı tanım + aynı seed'ler = aynı sonuçlar. Çıktı: <ad>.json (tanım, satırlar, özet) ve <ad>.csv
import {writeFileSync,mkdirSync} from 'node:fs';
import {initializeRapier} from '../src/physics/FlightPhysics.js';
import {runExperiment,toCSV} from '../src/experiment/Experiment.js';
import {EXPERIMENTS as MARS_EXPERIMENTS,EARTH_EXPERIMENTS} from '../src/experiment/presets.js';
const EXPERIMENTS={...MARS_EXPERIMENTS,...EARTH_EXPERIMENTS};
await initializeRapier();
const name=process.argv[2]??'all',i=process.argv.indexOf('--out'),out=i>0?process.argv[i+1]:'reports/experiments';
const list=name==='all'?Object.keys(EXPERIMENTS):[name];
mkdirSync(out,{recursive:true});
for(const id of list){
  const def=EXPERIMENTS[id];if(!def){console.error('Bilinmeyen deney:',id,Object.keys(EXPERIMENTS).join(', '));process.exit(1);}
  const t0=Date.now();
  const res=runExperiment(def,{onProgress:(d,n)=>process.stdout.write(`\r${id}: ${d}/${n}`)});
  writeFileSync(`${out}/${id}.json`,JSON.stringify({...res,generated:new Date().toISOString()},null,1)+'\n');
  writeFileSync(`${out}/${id}.csv`,toCSV(res.rows));writeFileSync(`${out}/${id}-summary.csv`,toCSV(res.summary));
  console.log(`\r${id}: ${res.rows.length} koşu, ${((Date.now()-t0)/1000).toFixed(1)} sn`);
  console.table(res.summary.map(s=>({...Object.fromEntries((def.variables).map(v=>[v.key,s[v.key]])),success:s.success,lift:s.liftOff,E_Wh:+s.energyWh.toFixed(2),t_s:+s.flightTime.toFixed(1),maxTilt:+s.maxTilt.toFixed(1),mass:+s.mass.toFixed(3),flights10:+s.flightsPer10Sols.toFixed(1),harvest:+s.harvestWhPerSol.toFixed(1),night:+s.nightWhPerSol.toFixed(1),minSoC:+s.minSoC10Sols.toFixed(2)})));
}
